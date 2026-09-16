/**
 * Google Business Profile API client guards:
 * 1) Rate limit — max ~5 requests/second (min spacing between calls)
 * 2) Exponential backoff on 429 / quota errors
 * 3) In-memory short TTL caches for rarely changing payloads
 */

const MIN_INTERVAL_MS = 220; // ≈ 4–5 req/s ceiling
const MAX_BACKOFF_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 2000; // 2s, 4s, 8s, 16s, 32s

type CacheEntry<T> = { value: T; expiresAt: number };

const memoryCache = new Map<string, CacheEntry<unknown>>();
let lastRequestAt = 0;
let chain: Promise<void> = Promise.resolve();

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Serialize + space out outbound Google HTTP calls. */
export async function acquireGoogleRateSlot(): Promise<void> {
  const run = async () => {
    const now = Date.now();
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - now);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
  };
  // Queue callers so parallel fetches don't burst
  chain = chain.then(run, run);
  await chain;
}

export function isGoogleQuotaError(message: string, status?: number): boolean {
  const m = (message || "").toLowerCase();
  return (
    status === 429 ||
    m.includes("quota exceeded") ||
    m.includes("rate limit") ||
    m.includes("resource_exhausted") ||
    m.includes("requests per minute") ||
    m.includes("too many requests")
  );
}

export function backoffDelayMs(attempt: number): number {
  // attempt 0 → 2s, 1 → 4s, … + jitter up to 25%
  const base = BASE_BACKOFF_MS * 2 ** attempt;
  const jitter = Math.floor(Math.random() * base * 0.25);
  return Math.min(base + jitter, 60_000);
}

export function humanizeGoogleQuotaError(message: string, status?: number): string {
  if (!isGoogleQuotaError(message, status)) {
    return message || `Google API ${status || "error"}`;
  }
  return (
    "Google API quota exceeded (requests per minute). " +
    "AtlasNow will back off automatically; if it still fails, wait 1–2 minutes then retry. " +
    "Use cached location list when possible (Refresh without Force). " +
    "In Google Cloud → Quotas for Account Management / Business Information APIs, " +
    "check RPM limits and billing. Avoid rapid Connect/Refresh clicks."
  );
}

export function cacheGet<T>(key: string): T | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(prefixOrKey: string): void {
  for (const k of memoryCache.keys()) {
    if (k === prefixOrKey || k.startsWith(prefixOrKey)) {
      memoryCache.delete(k);
    }
  }
}

/** Default: treat location list as fresh for 15 minutes unless force refresh. */
export const LOCATION_LIST_CACHE_TTL_MS = 15 * 60 * 1000;
export const ACCOUNT_LIST_CACHE_TTL_MS = 30 * 60 * 1000;

const syncLocks = new Map<string, Promise<unknown>>();

/** Prevent parallel LIST_LOCATIONS for the same connector. */
export async function withSyncLock<T>(
  connectorId: string,
  fn: () => Promise<T>
): Promise<T> {
  const prev = syncLocks.get(connectorId) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const next = prev.then(() => gate);
  syncLocks.set(connectorId, next);
  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (syncLocks.get(connectorId) === next) {
      syncLocks.delete(connectorId);
    }
  }
}
