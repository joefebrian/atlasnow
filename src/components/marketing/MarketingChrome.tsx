import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PublicHeaderNav } from "@/components/marketing/PublicHeaderNav";
import { PublicLegalLinks } from "@/components/legal/PublicLegalLinks";
import { PublicSocialLinks } from "@/components/marketing/PublicSocialLinks";
import { atlasProductCopyright } from "@/lib/legal/copy";
import type { LocalizedBranding } from "@/lib/branding-defaults";
import type { Locale } from "@/lib/i18n/locale";
import { landingCopy } from "@/lib/marketing/landing";
import type { SocialLinks } from "@/lib/social";
import { SupportWidget } from "@/components/support/SupportWidget";

export function MarketingChrome({
  locale,
  branding,
  social,
  signedIn = false,
  padded = true,
  contentWidth = "max-w-3xl",
  shellWidth = "max-w-6xl",
  children,
}: {
  locale: Locale;
  branding: LocalizedBranding;
  social: SocialLinks;
  signedIn?: boolean;
  /** Inner pages get a reading column. Landing is full-bleed. */
  padded?: boolean;
  contentWidth?: string;
  /** Header + footer column. Pricing uses a wider shell so five cards fit. */
  shellWidth?: string;
  children: React.ReactNode;
}) {
  const t = landingCopy(locale);
  const shellPad = "px-4 sm:px-6 xl:px-8";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--warm)] text-[var(--ink)]" lang={locale}>
      <header className="relative sticky top-0 z-30 border-b border-black/[0.04] bg-[var(--warm)]/80 backdrop-blur-xl">
        <div className={`mx-auto flex h-14 w-full ${shellWidth} items-center justify-between gap-2 ${shellPad} sm:h-16`}>
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <BrandMark logoUrl={branding.logoUrl} logoLetter={branding.logoLetter} size="sm" />
            <span className="truncate text-[14px] font-semibold tracking-tight text-[var(--ink)] sm:text-[15px]">
              {branding.appName}
            </span>
          </Link>
          <PublicHeaderNav locale={locale} />
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LanguageSwitcher locale={locale} tone="light" />
            {signedIn ? (
              <Link
                href="/control-tower"
                className="an-btn-primary px-3 py-2 text-[12px] sm:px-4 sm:text-[13px]"
              >
                {t.ctaPrimary}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden text-[13px] font-medium text-[var(--ink)]/50 transition-colors hover:text-[var(--ink)] sm:inline"
                >
                  {t.login}
                </Link>
                <Link
                  href="/signup"
                  className="an-btn-primary px-3 py-2 text-[12px] sm:px-4 sm:text-[13px]"
                >
                  {t.signup}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {padded ? (
        <main className="relative flex-1 overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#b7e1ff]/55 blur-[100px]" />
            <div className="absolute right-0 top-32 h-64 w-64 rounded-full bg-[#d9c6f7]/40 blur-[90px]" />
          </div>
          <div className={`relative mx-auto w-full ${contentWidth} px-4 py-10 sm:px-8 sm:py-16`}>
            {children}
          </div>
        </main>
      ) : (
        <main className="flex-1">{children}</main>
      )}

      <footer className={`an-brand-hairline relative z-10 py-8 ${shellPad}`}>
        <div className={`mx-auto flex w-full ${shellWidth} flex-col gap-6 sm:flex-row sm:items-start sm:justify-between`}>
          <div className="flex flex-col gap-3">
            <span className="text-[12px] leading-relaxed text-[var(--ink)]/45">
              {atlasProductCopyright()}
            </span>
            <PublicSocialLinks links={social} tone="light" />
          </div>
          <PublicLegalLinks locale={locale} tone="light" variant="footer" />
        </div>
      </footer>
      <SupportWidget locale={locale} />
    </div>
  );
}
