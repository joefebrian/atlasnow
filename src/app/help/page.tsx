import type { Metadata } from "next";
import { HelpHub } from "@/components/help/HelpHub";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { getBranding } from "@/lib/branding";
import { localizeBranding } from "@/lib/branding-defaults";
import { getLocale } from "@/lib/i18n/get-locale";
import { HELP_ORIGIN } from "@/lib/help/articles";
import { readSession } from "@/lib/auth";
import { getSitePages } from "@/lib/site-pages";
import { publicMetadata } from "@/lib/seo/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...publicMetadata({
    path: "/help",
    title: "AtlasNow help — how the desk works",
    description:
      "Help for AtlasNow: loyalty, HQ WhatsApp, cashier, Google listings, TikTok GO voucher usage, and what the desk faces at multi-outlet brands.",
  }),
  alternates: { canonical: HELP_ORIGIN },
};

export default async function HelpHomePage() {
  const locale = await getLocale();
  const session = await readSession();
  const branding = localizeBranding(await getBranding(), locale);
  const { social } = await getSitePages();
  return (
    <MarketingChrome locale={locale} branding={branding} social={social} signedIn={Boolean(session)} padded={false}>
      <HelpHub locale={locale} />
    </MarketingChrome>
  );
}
