import {
  resolvedAppBaseUrl,
  resolvedGoogleOAuth,
} from "@/lib/integrations/service";

export const GOOGLE_PROVIDER = "GOOGLE_BUSINESS_PROFILE" as const;

/** Production public site — register this redirect in Google Cloud OAuth client. */
export const ATLASNOW_PRODUCTION_ORIGIN = "https://atlasnow.co";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/business.manage",
].join(" ");

/** Redirect URIs to add on the Google Cloud OAuth Web client (Authorized redirect URIs). */
export function googleOAuthRedirectUris(): string[] {
  return [
    `${ATLASNOW_PRODUCTION_ORIGIN}/api/google/oauth/callback`,
    `${ATLASNOW_PRODUCTION_ORIGIN}/api/auth/google/callback`,
    "http://localhost:3000/api/google/oauth/callback",
    "http://localhost:3000/api/auth/google/callback",
  ];
}
/** Sync env-only check (fast path). Prefer `googleOAuthConfiguredAsync` in request handlers. */
export function googleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

export async function googleOAuthConfiguredAsync(): Promise<boolean> {
  const o = await resolvedGoogleOAuth();
  return o.configured;
}

export function googleMockPreferred(): boolean {
  if (process.env.GOOGLE_MOCK === "1" || process.env.GOOGLE_MOCK === "true") return true;
  return !googleOAuthConfigured();
}

export async function googleMockPreferredAsync(): Promise<boolean> {
  if (process.env.GOOGLE_MOCK === "1" || process.env.GOOGLE_MOCK === "true") return true;
  const o = await resolvedGoogleOAuth();
  if (o.mode === "MOCK") return true;
  if (o.mode === "LIVE") return false;
  if (o.mode === "OFF") return true;
  return !o.configured;
}

export function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export async function appBaseUrlAsync(): Promise<string> {
  return resolvedAppBaseUrl();
}

export function googleRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `${appBaseUrl()}/api/google/oauth/callback`
  );
}

export async function googleRedirectUriAsync(): Promise<string> {
  const o = await resolvedGoogleOAuth();
  if (o.redirectUri) return o.redirectUri.replace(/\/$/, "");
  const base = await appBaseUrlAsync();
  return `${base}/api/google/oauth/callback`;
}
