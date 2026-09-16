import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { readSession } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { localizeBranding } from "@/lib/branding-defaults";
import { getLocale } from "@/lib/i18n/get-locale";
import { organizationJsonLd, softwareJsonLd, webSiteJsonLd } from "@/lib/seo/json-ld";
import { homeDescription, homeTitle, publicMetadata } from "@/lib/seo/site";
import { getSitePages } from "@/lib/site-pages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicMetadata({
  path: "/",
  title: homeTitle(),
  description: homeDescription(),
});

export default async function Home() {
  const session = await readSession();
  const locale = await getLocale();
  const branding = localizeBranding(await getBranding(), locale);
  const { social } = await getSitePages();

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={softwareJsonLd()} />
      <JsonLd data={webSiteJsonLd()} />
      <LandingPage locale={locale} branding={branding} signedIn={Boolean(session)} social={social} />
    </>
  );
}
