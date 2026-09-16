import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { readSession } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { localizeBranding } from "@/lib/branding-defaults";
import { getLocale } from "@/lib/i18n/get-locale";
import { getSitePages } from "@/lib/site-pages";

export async function PublicSiteShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const locale = await getLocale();
  const session = await readSession();
  const branding = localizeBranding(await getBranding(), locale);
  const { social } = await getSitePages();

  return (
    <MarketingChrome
      locale={locale}
      branding={branding}
      social={social}
      signedIn={Boolean(session)}
      padded
      contentWidth={wide ? "max-w-5xl" : "max-w-3xl"}
    >
      {children}
    </MarketingChrome>
  );
}
