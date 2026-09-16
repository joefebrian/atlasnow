/** Shared locale helpers — safe for Client and Server Components (no next/headers). */

export const LOCALES = ["en", "id"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "atlasnow_locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "id";
}

export function parseLocale(value: string | null | undefined): Locale {
  if (isLocale(value)) return value;
  return DEFAULT_LOCALE;
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  id: "Bahasa Indonesia",
};

export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  id: "ID",
};
