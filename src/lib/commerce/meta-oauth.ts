import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { resolvedAppBaseUrl, resolvedMetaApp } from "@/lib/integrations/service";
import { COMMERCE_META_SCOPES } from "@/lib/commerce/connection";
import { COMMERCE_GRAPH, scrubSecret } from "@/lib/commerce/meta-graph";

const PURPOSE = "commerce";
const DEV_SECRET = "atlasnow-dev-secret-change-me";

export function commerceAuthSecret(env: { NODE_ENV?: string; AUTH_SECRET?: string } = process.env): string {
  const value = env.AUTH_SECRET || "";
  if (env.NODE_ENV === "production" && (!value || value === DEV_SECRET)) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return value || DEV_SECRET;
}

function secret() {
  return commerceAuthSecret();
}

/** Hash of the session cookie. The cookie itself is not stored. */
export function commerceSessionKey(cookieValue: string | undefined): string {
  if (!cookieValue) return "";
  return createHash("sha256").update(cookieValue).digest("hex");
}

export function encodeCommerceState(payload: { tenantId: string; userId: string; nonce: string }): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, purpose: PURPOSE, exp: Date.now() + 15 * 60 * 1000 }),
    "utf8"
  ).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function decodeCommerceState(state: string): { tenantId: string; userId: string; nonce: string } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      tenantId?: string;
      userId?: string;
      nonce?: string;
      purpose?: string;
      exp?: number;
    };
    if (parsed.purpose !== PURPOSE || !parsed.tenantId || !parsed.userId || !parsed.nonce) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return { tenantId: parsed.tenantId, userId: parsed.userId, nonce: parsed.nonce };
  } catch {
    return null;
  }
}

export async function issueCommerceState(opts: { tenantId: string; userId: string; sessionKey: string }): Promise<string> {
  if (!opts.sessionKey) throw new Error("The Meta connection expired. Start it again.");
  const nonce = randomBytes(16).toString("hex");
  await prisma.commerceOAuthNonce.create({
    data: {
      tenantId: opts.tenantId,
      userId: opts.userId,
      nonce,
      sessionKey: opts.sessionKey,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  return encodeCommerceState({ tenantId: opts.tenantId, userId: opts.userId, nonce });
}

/** Returns the payload once. A second call, or a different session, returns null. */
export async function consumeCommerceState(
  state: string,
  opts: { userId: string; sessionKey: string }
): Promise<{ tenantId: string; userId: string; nonce: string } | null> {
  const parsed = decodeCommerceState(state);
  if (!parsed || !opts.sessionKey || parsed.userId !== opts.userId) return null;
  const row = await prisma.commerceOAuthNonce.findUnique({
    where: { userId_nonce: { userId: parsed.userId, nonce: parsed.nonce } },
  });
  if (!row || row.consumedAt || row.expiresAt.getTime() < Date.now()) return null;
  if (row.sessionKey !== opts.sessionKey || row.tenantId !== parsed.tenantId) return null;
  const taken = await prisma.commerceOAuthNonce.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (taken.count !== 1) return null;
  return parsed;
}

export async function commerceRedirectUri(): Promise<string> {
  const base = (await resolvedAppBaseUrl()).replace(/\/$/, "");
  return `${base}/api/commerce/meta/callback`;
}

/** Facebook Login with explicit commerce scopes. Does not reuse the Page login config. */
export async function buildCommerceAuthUrl(state: string): Promise<string> {
  const meta = await resolvedMetaApp();
  if (!meta.configured) throw new Error("Meta App ID / Secret not set (Settings → API)");
  const params = new URLSearchParams({
    client_id: meta.appId,
    redirect_uri: await commerceRedirectUri(),
    state,
    response_type: "code",
    scope: COMMERCE_META_SCOPES.join(","),
  });
  return `https://www.facebook.com/v25.0/dialog/oauth?${params}`;
}

export async function exchangeCommerceCode(code: string): Promise<{ accessToken: string; expiresAt: Date | null }> {
  const meta = await resolvedMetaApp();
  const redirectUri = await commerceRedirectUri();
  const shortUrl = new URL(`${COMMERCE_GRAPH}/oauth/access_token`);
  shortUrl.searchParams.set("client_id", meta.appId);
  shortUrl.searchParams.set("client_secret", meta.appSecret);
  shortUrl.searchParams.set("redirect_uri", redirectUri);
  shortUrl.searchParams.set("code", code);
  const shortRes = await fetch(shortUrl);
  const short = (await shortRes.json()) as { access_token?: string; error?: { message?: string } };
  if (!shortRes.ok || !short.access_token) {
    throw new Error(scrubSecret(short.error?.message || "Meta token exchange failed"));
  }
  const longUrl = new URL(`${COMMERCE_GRAPH}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", meta.appId);
  longUrl.searchParams.set("client_secret", meta.appSecret);
  longUrl.searchParams.set("fb_exchange_token", short.access_token);
  const longRes = await fetch(longUrl);
  const long = (await longRes.json()) as { access_token?: string; expires_in?: number };
  const token = long.access_token || short.access_token;
  const expiresAt = typeof long.expires_in === "number" ? new Date(Date.now() + long.expires_in * 1000) : null;
  return { accessToken: token, expiresAt };
}
