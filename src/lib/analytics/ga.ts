/** Public GA4 measurement ID. Not a secret. Override at Next build with NEXT_PUBLIC_GA_MEASUREMENT_ID. */
export const GA_MEASUREMENT_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-HY5V8HH3Z1").trim();

/** Google Ads account tag (AW-…). Empty until founder pastes it. Baked at Next build. */
export const GOOGLE_ADS_ID = (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "").trim();

export const COOKIE_CONSENT_KEY = "atlasnow_cookie_ok_v3";
export const COOKIE_CONSENT_EVENT = "atlasnow-analytics-consent";
const SIGNUP_METHOD_KEY = "atlasnow_signup_method";

const PUBLIC_PATHS = [
  "/about",
  "/contact",
  "/cookies",
  "/data-deletion",
  "/faq",
  "/help",
  "/login",
  "/pricing",
  "/privacy",
  "/signup",
  "/terms",
] as const;

export function gaAllowedHost(host: string): boolean {
  const h = host.replace(/:\d+$/, "").toLowerCase();
  return h === "atlasnow.co" || h === "www.atlasnow.co";
}

/** Marketing + signup only. Never inbox, loyalty, cards, or APIs. */
export function isGaPublicPath(pathname: string): boolean {
  const p = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (p === "/") return true;
  if (p.startsWith("/api/") || p === "/api") return false;
  for (const root of PUBLIC_PATHS) {
    if (p === root || p.startsWith(`${root}/`)) return true;
  }
  return false;
}

export function hasCookieConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberCookieConsent(): void {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, "1");
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}

function gtagFn(): ((...args: unknown[]) => void) | null {
  if (typeof window === "undefined") return null;
  return typeof window.gtag === "function" ? window.gtag : null;
}

/** Consent Mode v2 — ads + analytics after OK. Safe if gtag is not loaded yet. */
export function grantAdsConsent(): void {
  const gtag = gtagFn();
  if (!gtag) return;
  gtag("consent", "update", {
    analytics_storage: "granted",
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });
  gtag("set", "ads_data_redaction", false);
}

/** Enhanced conversions — Google hashes. Never send inbox/receipts/phone. */
export function setAdsUserData(email?: string | null): void {
  const gtag = gtagFn();
  const value = (email || "").trim().toLowerCase();
  if (!gtag || !value || !value.includes("@")) return;
  gtag("set", "user_data", { email: value });
}

export function rememberSignupMethod(method: "email" | "google" | "facebook"): void {
  try {
    sessionStorage.setItem(SIGNUP_METHOD_KEY, method);
  } catch {
    /* ignore */
  }
}

export function readSignupMethod(): "email" | "google" | "facebook" | "signup" {
  try {
    const m = sessionStorage.getItem(SIGNUP_METHOD_KEY);
    if (m === "email" || m === "google" || m === "facebook") return m;
  } catch {
    /* ignore */
  }
  return "signup";
}

export function trackGenerateLead(method: "signup" | "contact"): void {
  const gtag = gtagFn();
  if (!gtag) return;
  gtag("event", "generate_lead", { method });
}

export function trackSignUp(method: "email" | "google" | "facebook" | "signup"): void {
  const gtag = gtagFn();
  if (!gtag) return;
  gtag("event", "sign_up", { method });
}

export function trackClickToWhatsApp(): void {
  const gtag = gtagFn();
  if (!gtag) return;
  gtag("event", "click_to_whatsapp", { method: "hq_pending" });
}

export function trackSelectPlan(planId: string): void {
  const gtag = gtagFn();
  if (!gtag) return;
  gtag("event", "select_item", { item_list_id: "pricing", items: [{ item_id: planId, item_name: planId }] });
}

export function trackPageView(pathname: string): void {
  const gtag = gtagFn();
  if (!gtag) return;
  gtag("event", "page_view", { page_path: pathname });
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
