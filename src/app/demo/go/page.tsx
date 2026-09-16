import type { Metadata } from "next";
import { TikTokGoPublicDemo } from "@/components/demo/TikTokGoPublicDemo";
import { PublicSiteShell } from "@/components/marketing/PublicSiteShell";
import { getLocale } from "@/lib/i18n/get-locale";
import { publicMetadata } from "@/lib/seo/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicMetadata({
  path: "/demo/go",
  title: "TikTok GO till demo · AtlasNow",
  description:
    "How a TikTok GO merchant connects AtlasNow, and how the cashier redeems a voucher at the right outlet. Not GMV. Not a stamp.",
  index: false,
});

export default async function TikTokGoDemoPage() {
  const locale = await getLocale();
  return (
    <PublicSiteShell wide>
      <TikTokGoPublicDemo locale={locale === "id" ? "id" : "en"} />
    </PublicSiteShell>
  );
}
