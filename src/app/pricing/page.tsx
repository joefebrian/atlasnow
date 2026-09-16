import type { Metadata } from "next";
import { PricingPage } from "@/components/marketing/PricingPage";
import { readSession } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { localizeBranding } from "@/lib/branding-defaults";
import { getLocale } from "@/lib/i18n/get-locale";
import { LEGAL_PRODUCT } from "@/lib/legal/copy";
import { publicMetadata } from "@/lib/seo/site";
import { getSitePages } from "@/lib/site-pages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicMetadata({
  path: "/pricing",
  title: `${LEGAL_PRODUCT} pricing — Free, Silver, Gold, Platinum, Diamond`,
  description:
    "AtlasNow pricing: Free membership on two outlets, Silver for one official WhatsApp Business number and blast, Gold for Google and TikTok GO till and branch watch. Cancel with 30 days’ notice; paid invoices are not refunded. Login after follow-up. No invented visits, leads, or revenue.",
});

export default async function PricingRoute() {
  const session = await readSession();
  const locale = await getLocale();
  const branding = localizeBranding(await getBranding(), locale);
  const { social } = await getSitePages();

  return (
    <PricingPage
      locale={locale}
      branding={branding}
      signedIn={Boolean(session)}
      social={social}
    />
  );
}
