import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { readSession } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { localizeBranding } from "@/lib/branding-defaults";
import { getLocale } from "@/lib/i18n/get-locale";
import { LEGAL_OPERATOR } from "@/lib/legal/copy";
import { getSitePages } from "@/lib/site-pages";

export async function LegalShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
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
      contentWidth="max-w-3xl"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2a9bb8]">
        {LEGAL_OPERATOR}
      </p>
      <h1 className="mt-3 text-[1.85rem] font-medium leading-[1.12] tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
        {title}
      </h1>
      {children}
    </MarketingChrome>
  );
}
