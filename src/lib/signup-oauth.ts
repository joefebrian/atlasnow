import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { resolvedAppBaseUrl, resolvedGoogleOAuth, resolvedMetaApp } from "@/lib/integrations/service";
import { META_GRAPH } from "@/lib/meta/oauth";
import { parseSignupPhone } from "@/lib/signup/phone";

export const GOOGLE_IDENTITY_SCOPES = "openid email profile";
export const FACEBOOK_IDENTITY_SCOPES = "email,public_profile";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export type IdentityProvider = "google" | "facebook";

export type IdentityState = {
  v: 1;
  n: string;
  m: IdentityProvider;
  t: true;
  iat: number;
  k?: "brand" | "agency";
  /** Canonical 62… WhatsApp, set on signup (not login). */
  p?: string;
  /** Several brands intent — still one CLIENT tenant. */
  g?: 1;
};

export type IdentityProfile = {
  email: string;
  name?: string;
};

function authSecret() {
  return process.env.AUTH_SECRET || "atlasnow-dev-secret-change-me";
}

export function signIdentityState(payload: IdentityState): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = createHmac("sha256", authSecret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function newIdentityState(
  method: IdentityProvider,
  phone?: string | null,
  wantsGroup = false
): string {
  const p = parseSignupPhone(phone) || undefined;
  return signIdentityState({
    v: 1,
    n: randomBytes(16).toString("hex"),
    m: method,
    t: true,
    iat: Date.now(),
    k: "brand",
    ...(p ? { p } : {}),
    ...(wantsGroup ? { g: 1 as const } : {}),
  });
}

export function verifyIdentityState(state: string, method: IdentityProvider): IdentityState | null {
  const dot = state.lastIndexOf(".");
  if (dot < 1) return null;
  const body = state.slice(0, dot);
  const mac = state.slice(dot + 1);
  const expected = createHmac("sha256", authSecret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<IdentityState>;
    if (parsed.v !== 1 || parsed.t !== true) return null;
    if (parsed.m !== method) return null;
    if (typeof parsed.n !== "string" || !parsed.n) return null;
    if (typeof parsed.iat !== "number" || Date.now() - parsed.iat > STATE_MAX_AGE_MS) return null;
    return parsed as IdentityState;
  } catch {
    return null;
  }
}

export async function googleIdentityRedirectUri(): Promise<string> {
  const base = await resolvedAppBaseUrl();
  return `${base}/api/auth/google/callback`;
}

export async function facebookIdentityRedirectUri(): Promise<string> {
  const base = await resolvedAppBaseUrl();
  return `${base}/api/auth/facebook/callback`;
}

export async function googleIdentityConfigured(): Promise<boolean> {
  const o = await resolvedGoogleOAuth();
  return Boolean(o.clientId && o.clientSecret);
}

export async function facebookIdentityConfigured(): Promise<boolean> {
  const m = await resolvedMetaApp();
  return Boolean(m.appId && m.appSecret);
}

export async function buildGoogleIdentityAuthUrl(state: string): Promise<string> {
  const o = await resolvedGoogleOAuth();
  if (!o.clientId || !o.clientSecret) throw new Error("google_not_configured");
  const redirectUri = await googleIdentityRedirectUri();
  const params = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_IDENTITY_SCOPES,
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function buildFacebookIdentityAuthUrl(state: string): Promise<string> {
  const m = await resolvedMetaApp();
  if (!m.appId || !m.appSecret) throw new Error("facebook_not_configured");
  const redirectUri = await facebookIdentityRedirectUri();
  const params = new URLSearchParams({
    client_id: m.appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: FACEBOOK_IDENTITY_SCOPES,
    state,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeGoogleIdentityCode(code: string): Promise<IdentityProfile> {
  const o = await resolvedGoogleOAuth();
  const redirectUri = await googleIdentityRedirectUri();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: o.clientId,
      client_secret: o.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "oauth_failed");
  }
  const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const user = (await ui.json()) as {
    email?: string;
    name?: string;
    verified_email?: boolean;
  };
  const email = (user.email || "").trim().toLowerCase();
  if (!email) throw new Error("email_required");
  return { email, name: user.name?.trim() || undefined };
}

export async function exchangeFacebookIdentityCode(code: string): Promise<IdentityProfile> {
  const m = await resolvedMetaApp();
  const redirectUri = await facebookIdentityRedirectUri();
  const tokenUrl = new URL(`${META_GRAPH}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", m.appId);
  tokenUrl.searchParams.set("client_secret", m.appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);
  const tokenRes = await fetch(tokenUrl);
  const token = (await tokenRes.json()) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!tokenRes.ok || !token.access_token) {
    throw new Error(token.error?.message || "oauth_failed");
  }
  const meUrl = new URL(`${META_GRAPH}/me`);
  meUrl.searchParams.set("fields", "id,name,email");
  meUrl.searchParams.set("access_token", token.access_token);
  const meRes = await fetch(meUrl);
  const me = (await meRes.json()) as {
    email?: string;
    name?: string;
    error?: { message?: string };
  };
  if (!meRes.ok) throw new Error(me.error?.message || "oauth_failed");
  const email = (me.email || "").trim().toLowerCase();
  if (!email) throw new Error("facebook_email_required");
  return { email, name: me.name?.trim() || undefined };
}

export function oauthFailRedirect(base: string, code: string): string {
  return `${base.replace(/\/$/, "")}/signup?error=${encodeURIComponent(code)}`;
}

export function oauthPendingRedirect(base: string, brand?: string | null): string {
  const root = `${base.replace(/\/$/, "")}/signup/pending`;
  const b = (brand || "").replace(/\s+/g, " ").trim().slice(0, 80);
  return b ? `${root}?brand=${encodeURIComponent(b)}` : root;
}
