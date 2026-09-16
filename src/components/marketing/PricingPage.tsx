import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { PricingTable } from "@/components/marketing/PricingTable";
import type { LocalizedBranding } from "@/lib/branding-defaults";
import type { Locale } from "@/lib/i18n/locale";
import { pricingCopy } from "@/lib/marketing/pricing";
import type { SocialLinks } from "@/lib/social";

export function PricingPage({
  locale,
  branding,
  signedIn = false,
  social,
}: {
  locale: Locale;
  branding: LocalizedBranding;
  signedIn?: boolean;
  social: SocialLinks;
}) {
  const t = pricingCopy(locale);

  return (
    <MarketingChrome
      locale={locale}
      branding={branding}
      social={social}
      signedIn={signedIn}
      padded={false}
      shellWidth="max-w-[1600px]"
    >
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-0 h-[22rem] w-[22rem] rounded-full bg-[#b7e1ff]/70 blur-[110px]" />
          <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-[#c5f0c1]/50 blur-[100px]" />
        </div>
        <div className="relative mx-auto w-full max-w-[1600px] px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-16 xl:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2a9bb8]">{t.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl text-[1.85rem] font-medium leading-[1.12] tracking-[-0.03em] text-[var(--ink)] sm:text-5xl sm:leading-[1.08]">
            {t.title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink)]/55 sm:mt-5 sm:text-[17px]">
            {t.lede}
          </p>
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-6 sm:pb-16 xl:px-8">
        <PricingTable locale={locale} signedIn={signedIn} />
      </section>

      <section className="an-brand-hairline bg-white/50 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 xl:px-8">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--ink)]">{t.extraTitle}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {t.extra.map((item) => (
              <article key={item.title} className="rounded-2xl border border-black/[0.06] bg-white p-6">
                <h3 className="text-base font-semibold text-[var(--ink)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]/55">{item.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-8 text-[13px] leading-relaxed text-[var(--ink)]/45">{t.honest}</p>
        </div>
      </section>

      <section id="cancel" className="an-brand-hairline bg-white/40 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 xl:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--ink)]">{t.cancelTitle}</h2>
            <a
              className="text-[13px] font-medium text-[#2a9bb8] underline-offset-2 hover:underline"
              href={t.cancelTermsHref}
            >
              {t.cancelTerms}
            </a>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--ink)]/55">{t.cancelLede}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {t.cancel.map((item) => (
              <article key={item.title} className="rounded-2xl border border-black/[0.06] bg-white p-6">
                <h3 className="text-base font-semibold text-[var(--ink)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]/55">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
