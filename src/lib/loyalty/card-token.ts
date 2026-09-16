import { createHmac, timingSafeEqual } from "crypto";

const PREFIX = "an1";
const SIG_LEN = 22;

export type CardClaims = { tid: string; phone: string; exp: number };

/** Member card on the phone — years, not weeks. Till scan still checks exp. */
export const CARD_TTL_SEC = 60 * 60 * 24 * 365 * 5;
export const CARD_REFRESH_SEC = 60 * 60 * 24 * 365;

function secret() {
  return process.env.AUTH_SECRET || "atlasnow-dev-secret-change-me";
}

function b64url(buf: Buffer | string) {
  return (Buffer.isBuffer(buf) ? buf : Buffer.from(buf)).toString("base64url");
}

function signBody(body: string) {
  return b64url(createHmac("sha256", secret()).update(body).digest()).slice(0, SIG_LEN);
}

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || "https://atlasnow.co").replace(/\/$/, "");
}

export function signCardToken(tenantId: string, phone: string, ttlSec = CARD_TTL_SEC): string {
  const claims: CardClaims = {
    tid: tenantId,
    phone,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const body = b64url(JSON.stringify(claims));
  return `${PREFIX}.${body}.${signBody(body)}`;
}

export function inspectCardToken(
  token: string
): { ok: true; claims: CardClaims; expired: boolean } | { ok: false; error: string } {
  const parts = (token || "").trim().split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, error: "QR tidak valid" };
  const expect = signBody(parts[1]);
  const a = Buffer.from(expect);
  const b = Buffer.from(parts[2]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "QR tidak valid" };
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as CardClaims;
    if (!claims.tid || !claims.phone) return { ok: false, error: "QR tidak valid" };
    const expired = !claims.exp || claims.exp < Math.floor(Date.now() / 1000);
    return { ok: true, claims, expired };
  } catch {
    return { ok: false, error: "QR tidak valid" };
  }
}

export function verifyCardToken(token: string): { ok: true; claims: CardClaims } | { ok: false; error: string } {
  const r = inspectCardToken(token);
  if (!r.ok) return r;
  if (r.expired) return { ok: false, error: "QR kedaluwarsa. Minta buka kartu lagi." };
  return { ok: true, claims: r.claims };
}

export function cardTokenNeedsRefresh(claims: CardClaims): boolean {
  return claims.exp - Math.floor(Date.now() / 1000) < CARD_REFRESH_SEC;
}

export function brandLetter(name: string): string {
  const compact = (name || "").replace(/[^A-Za-z0-9]/g, "");
  return (compact.slice(0, 2) || "A").toUpperCase();
}

export function brandShortName(name: string): string {
  const t = (name || "Kartu").trim();
  return t.length <= 12 ? t : t.slice(0, 12).trim();
}

export function extractCardToken(raw: string): string {
  const t = (raw || "").trim();
  if (!t) return "";
  if (t.startsWith(`${PREFIX}.`)) return t;
  try {
    const u = new URL(t);
    const m = u.pathname.match(/\/card\/([^/?#]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch {
    /* not a url */
  }
  return t;
}

export function isJoinQr(raw: string): boolean {
  return /\/join\//i.test(raw || "");
}

export function cardPageUrl(token: string): string {
  return `${appBaseUrl()}/card/${encodeURIComponent(token)}`;
}

export function memberAppPath(slug: string, memberId: string): string {
  return `/c/${encodeURIComponent(slug)}/${encodeURIComponent(memberId)}`;
}

export function memberAppUrl(slug: string, memberId: string): string {
  return `${appBaseUrl()}${memberAppPath(slug, memberId)}`;
}

export function parseMemberAppPath(raw: string): { slug: string; memberId: string } | null {
  const t = (raw || "").trim();
  if (!t) return null;
  try {
    const u = t.includes("://") ? new URL(t) : new URL(t, "https://atlasnow.co");
    const m = u.pathname.match(/^\/c\/([^/]+)\/([^/]+)\/?$/);
    if (!m) return null;
    const slug = decodeURIComponent(m[1] || "");
    const memberId = decodeURIComponent(m[2] || "");
    if (!slug || !memberId) return null;
    return { slug, memberId };
  } catch {
    return null;
  }
}
