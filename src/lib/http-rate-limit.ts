/** In-process IP limiter for public POSTs (login / signup). One Atlas replica. */

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function clientIpFrom(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function takeRateToken(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): RateLimitResult {
  const hit = buckets.get(key);
  if (!hit || now >= hit.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (hit.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((hit.resetAt - now) / 1000)) };
  }
  hit.count += 1;
  return { ok: true };
}

/** Test helper. */
export function resetRateLimitBuckets() {
  buckets.clear();
}
