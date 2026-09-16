"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TaglineDemand } from "@/components/marketing/TaglineDemand";
import { PublicLegalLinks } from "@/components/legal/PublicLegalLinks";
import { PublicSocialLinks } from "@/components/marketing/PublicSocialLinks";
import type { LocalizedBranding } from "@/lib/branding-defaults";
import { LEGAL_OPERATOR_LINE } from "@/lib/legal/copy";
import { PITCH_TAGLINE_A } from "@/lib/pitch/pitch-copy";
import type { Locale } from "@/lib/i18n/locale";
import type { SocialLinks } from "@/lib/social";
import { SupportWidget } from "@/components/support/SupportWidget";

function AuthHero({ headline }: { headline: string }) {
  const locked =
    /optimize every outlet/i.test(headline) && /capture more demand/i.test(headline);
  if (locked) {
    return (
      <h2 className="mt-4 text-[2rem] font-semibold leading-[1.15] tracking-tight text-white xl:text-[2.35rem]">
        {PITCH_TAGLINE_A}
        <br />
        <TaglineDemand />
      </h2>
    );
  }
  return (
    <h2 className="mt-4 text-[2rem] font-semibold leading-[1.15] tracking-tight text-white xl:text-[2.35rem]">
      {headline}
    </h2>
  );
}

export function AuthSplitShell({
  locale,
  localized,
  social,
  onLocaleChange,
  leftFooter,
  cardFooter,
  children,
}: {
  locale: Locale;
  localized: LocalizedBranding;
  social: SocialLinks;
  onLocaleChange: (l: Locale) => void;
  leftFooter: React.ReactNode;
  cardFooter: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen bg-[var(--navy-950)]" lang={locale}>
      <div className="relative hidden min-h-screen w-[48%] flex-col justify-between lg:sticky lg:top-0 lg:flex lg:h-screen xl:w-[50%]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[#141214]" />
          <div className="absolute -right-16 bottom-[-6rem] h-[28rem] w-[28rem] rounded-full bg-[#7ee5d6]/12 blur-[120px]" />
          <div className="absolute -right-10 top-1/3 h-64 w-64 rounded-full bg-[#d9c6f7]/10 blur-[100px]" />
        </div>

        <div className="relative flex items-start justify-between gap-4 px-10 pt-10">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark
              logoUrl={localized.logoUrl}
              logoLetter={localized.logoLetter}
              size="xl"
            />
            <div>
              <div className="text-lg font-semibold tracking-tight text-white">{localized.appName}</div>
              <div className="text-[11px] font-medium text-white/45">A {LEGAL_OPERATOR_LINE} product</div>
            </div>
          </Link>
          <LanguageSwitcher locale={locale} tone="dark" onLocaleChange={onLocaleChange} />
        </div>

        <div className="relative max-w-lg px-10 pb-6 pt-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7ee5d6]">
            {localized.tagline}
          </p>
          <AuthHero headline={localized.heroHeadline} />
          <p className="mt-5 text-[15px] leading-relaxed text-white/60">{localized.supportingNarrative}</p>
          <p className="mt-5 inline-flex rounded-full bg-[#7ee5d6] px-4 py-1.5 text-xs font-bold text-[var(--ink)]">
            {localized.productPromise}
          </p>
          <ul className="mt-10 space-y-3">
            {localized.flowSteps.map((item, i) => (
              <li key={`${i}-${item}`} className="flex items-center gap-3 text-sm text-white/75">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-[#7ee5d6] ring-1 ring-white/15">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative px-10 pb-10 text-[11px] text-white/40">{leftFooter}</p>
      </div>

      <div className="relative flex flex-1 items-center justify-center bg-[var(--warm)] px-4 py-12 sm:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_320px_at_80%_0%,rgba(183,225,255,0.45),transparent)]" />

        <div className="relative w-full max-w-[420px]">
          <div className="mb-8 flex items-center justify-between gap-3 lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <BrandMark logoUrl={localized.logoUrl} logoLetter={localized.logoLetter} size="md" />
              <div>
                <div className="text-lg font-semibold text-slate-900">{localized.appName}</div>
                <div className="text-xs text-slate-400">P2P Labs</div>
              </div>
            </Link>
            <LanguageSwitcher locale={locale} onLocaleChange={onLocaleChange} />
          </div>

          {children}

          <p className="mt-8 text-center text-[11px] text-slate-400">{cardFooter}</p>
          <div className="mt-4 flex justify-center text-slate-400">
            <PublicSocialLinks links={social} tone="light" />
          </div>
          <PublicLegalLinks
            locale={locale}
            className="mt-3 text-center text-[11px]"
            tone="light"
            variant="inline"
          />
        </div>
      </div>
      <SupportWidget locale={locale} />
    </div>
  );
}
