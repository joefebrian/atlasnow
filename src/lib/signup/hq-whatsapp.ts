/** AtlasNow HQ Cloud number — owners click-to-WA here after signup (session window). */
export const DEFAULT_ATLAS_HQ_WHATSAPP = "6285863666290";

export function sanitizeSignupBrand(raw?: string | null): string {
  return (raw || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function signupPendingPath(brand?: string | null): string {
  const b = sanitizeSignupBrand(brand);
  if (!b) return "/signup/pending";
  return `/signup/pending?brand=${encodeURIComponent(b)}`;
}

export function atlasHqWhatsAppDigits(raw?: string | null): string {
  const fromEnv = (raw ?? process.env.ATLAS_HQ_WHATSAPP ?? DEFAULT_ATLAS_HQ_WHATSAPP).trim();
  const digits = fromEnv.replace(/[^\d]/g, "").replace(/^0/, "62");
  return digits || DEFAULT_ATLAS_HQ_WHATSAPP;
}

export function atlasHqClickToWaHref(opts: {
  brand?: string | null;
  locale: "en" | "id";
  digits?: string | null;
}): string {
  const brand = sanitizeSignupBrand(opts.brand);
  const text =
    opts.locale === "id"
      ? brand
        ? `Halo AtlasNow, saya baru daftar ${brand}`
        : "Halo AtlasNow, saya baru daftar"
      : brand
        ? `Hi AtlasNow, I just signed up ${brand}`
        : "Hi AtlasNow, I just signed up";
  return `https://wa.me/${atlasHqWhatsAppDigits(opts.digits)}?text=${encodeURIComponent(text)}`;
}
