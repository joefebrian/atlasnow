import { landingCopy } from "@/lib/marketing/landing";
import type { Locale } from "@/lib/i18n/locale";

export type PublicNavItem = { href: string; label: string };

export function productHeaderNav(locale: Locale): PublicNavItem[] {
  const t = landingCopy(locale);
  return [
    { href: "/#product", label: t.navProduct },
    { href: "/#merchants", label: t.navWho },
    { href: "/#flow", label: t.navChannels },
    { href: "/pricing", label: t.navPricing },
    { href: "/help", label: locale === "id" ? "Bantuan" : "Help" },
  ];
}
