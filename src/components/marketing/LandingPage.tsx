import Link from "next/link";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { ProblemSlideshow } from "@/components/marketing/ProblemSlideshow";
import { ProductPreview } from "@/components/marketing/ProductPreview";
import { TaglineDemand } from "@/components/marketing/TaglineDemand";
import type { LocalizedBranding } from "@/lib/branding-defaults";
import type { Locale } from "@/lib/i18n/locale";
import { landingCopy } from "@/lib/marketing/landing";
import type { SocialLinks } from "@/lib/social";

/** AtlasNow guideline washes — peach, sky, blush, aqua, mint, cyan, lavender, lime. */
const MERCHANT_WASHES = [
  "#ffd6b3",
  "#b7e1ff",
  "#ffc1d6",
  "#7ee5d6",
  "#c5f0c1",
  "#6fd6f6",
  "#d9c6f7",
  "#e7f662",
];

export function LandingPage({
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
  const t = landingCopy(locale);

  return (
    <MarketingChrome
      locale={locale}
      branding={branding}
      social={social}
      signedIn={signedIn}
      padded={false}
    >
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="an-orb absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-[#b7e1ff]/80 blur-[120px]" />
            <div className="an-orb-slow absolute right-0 top-40 h-80 w-80 rounded-full bg-[#c5f0c1]/50 blur-[100px]" />
            <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#d9c6f7]/40 blur-[110px]" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-10 sm:px-8 sm:pb-8 sm:pt-24">
            <p className="an-enter text-[11px] font-bold uppercase tracking-[0.2em] text-[#2a9bb8]">
              {t.eyebrow}
            </p>
            <h1 className="an-enter an-enter-d1 mt-4 max-w-3xl text-[1.85rem] font-medium leading-[1.12] tracking-[-0.03em] text-[var(--ink)] sm:mt-5 sm:text-4xl sm:leading-[1.05] md:text-6xl">
              {t.h1a}
              <br />
              <span className="font-normal text-[var(--ink)]/75">
                <TaglineDemand />
              </span>
            </h1>
            <p className="an-enter an-enter-d2 mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink)]/55 sm:mt-6 sm:text-[17px]">
              {t.lede}
            </p>
            <div className="an-enter an-enter-d3 mt-6 flex flex-col gap-2 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <Link
                href={signedIn ? "/control-tower" : "/signup"}
                className="an-btn-primary w-full justify-center px-5 py-2.5 sm:w-auto"
              >
                {signedIn ? t.ctaPrimary : t.signup}
              </Link>
              <a
                href="#problems"
                className="an-btn w-full justify-center rounded-xl border border-black/10 bg-white px-5 py-2.5 text-sm text-[var(--ink)] hover:bg-[#eef8ff] sm:w-auto"
              >
                {t.ctaSecondary}
              </a>
            </div>
            <p className="an-enter an-enter-d4 mt-4 text-[13px] text-[var(--ink)]/45 sm:mt-5">{t.proof}</p>
            <div className="an-enter an-enter-d5 mt-10 sm:mt-20">
              <div className="an-float">
                <ProductPreview />
              </div>
            </div>
          </div>
        </section>

        <section id="systems" className="an-brand-hairline bg-white/60 py-12 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2a9bb8]">
              {t.systemsEyebrow}
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
              {t.systemsTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink)]/55">{t.systemsLede}</p>
            <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
              {t.systems.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6"
                >
                  <h3 className="text-[17px] font-semibold text-[var(--ink)]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]/55">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <ProblemSlideshow eyebrow={t.problemEyebrow} title={t.problemTitle} items={t.problems} />

        <section id="product" className="an-brand-hairline py-12 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2a9bb8]">
              {t.productEyebrow}
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
              {t.productTitle}
            </h2>
            <div className="mt-8 grid gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-4">
              {t.products.map((item) => (
                <article
                  key={item.kicker}
                  className={
                    item.kicker.toLowerCase().includes("loyalty")
                      ? "rounded-2xl border border-[#2a9bb8]/25 bg-[#eef8ff] p-6 sm:p-7 shadow-[0_16px_40px_rgba(183,225,255,0.35)] transition-all duration-300 hover:-translate-y-1 sm:col-span-2"
                      : "rounded-2xl border border-black/[0.06] bg-white p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(183,225,255,0.45)]"
                  }
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2a9bb8]">
                    {item.kicker}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-[var(--ink)]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]/55">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="tiktok-go" className="an-brand-hairline py-12 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2a9bb8]">
              {t.goEyebrow}
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
              {t.goTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink)]/55">
              {t.goLede}
            </p>
            <div className="mt-8 grid gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-4">
              {t.go.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-black/[0.06] bg-white p-6 sm:p-7"
                >
                  <h3 className="text-[17px] font-semibold text-[var(--ink)]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]/55">{item.body}</p>
                </article>
              ))}
            </div>
            <p className="mt-8 text-[13px] leading-relaxed text-[var(--ink)]/45">
              {t.goNote}{" "}
              <Link href="/demo/go" className="font-semibold text-[var(--ink)] underline decoration-black/20 underline-offset-2 hover:decoration-black/50">
                {t.goDemo}
              </Link>
              .
            </p>
          </div>
        </section>

        <section id="listings" className="an-brand-hairline bg-white/50 py-12 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2a9bb8]">
              {t.gbpEyebrow}
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
              {t.gbpTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink)]/55">
              {t.gbpLede}
            </p>
            <div className="mt-8 grid gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-4">
              {t.gbp.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-black/[0.06] bg-white p-6 sm:p-7"
                >
                  <h3 className="text-[17px] font-semibold text-[var(--ink)]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]/55">{item.body}</p>
                </article>
              ))}
            </div>
            <p className="mt-8 text-[13px] leading-relaxed text-[var(--ink)]/45">{t.gbpNote}</p>
          </div>
        </section>

        <section
          id="merchants"
          className="relative overflow-hidden an-brand-hairline bg-[var(--warm)] py-12 sm:py-24"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-16 top-10 h-64 w-64 rounded-full bg-[#b7e1ff]/50 blur-[90px]" />
            <div className="absolute right-10 top-24 h-56 w-56 rounded-full bg-[#d9c6f7]/40 blur-[90px]" />
            <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-[#c5f0c1]/40 blur-[80px]" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2a9bb8]">
              {t.merchantsEyebrow}
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
              {t.merchantsTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink)]/55">
              {t.merchantsLede}
            </p>
            <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:mt-12 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
              {t.merchants.map((item, i) => {
                const wash = MERCHANT_WASHES[i % MERCHANT_WASHES.length];
                return (
                  <article
                    key={item.title}
                    className="w-[min(18rem,82vw)] shrink-0 snap-start rounded-2xl p-5 ring-1 ring-black/[0.04] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(183,225,255,0.45)] sm:w-auto sm:shrink"
                    style={{
                      background: `linear-gradient(165deg, ${wash} 0%, #faf8fc 72%)`,
                    }}
                  >
                    <h3 className="text-[15px] font-semibold text-[var(--ink)]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]/60">{item.body}</p>
                  </article>
                );
              })}
            </div>
            <p className="mt-8 text-[13px] leading-relaxed text-[var(--ink)]/45">
              {t.merchantsNote}
            </p>
          </div>
        </section>

        <section id="flow" className="an-brand-hairline py-12 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2a9bb8]">
              {t.flowEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
              {t.flowTitle}
            </h2>
            <ol className="mt-8 grid gap-5 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
              {t.steps.map((step) => (
                <li key={step.n}>
                  <div className="text-[12px] font-bold tracking-[0.2em] text-[#2a9bb8]">
                    {step.n}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-[var(--ink)]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]/55">{step.body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10 rounded-2xl border border-[#ffc1d6]/60 bg-[#fff5f8] px-4 py-4 sm:mt-16 sm:px-8 sm:py-5">
              <h3 className="text-base font-semibold text-[var(--ink)]">{t.honestTitle}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--ink)]/60">
                {t.honestBody}
              </p>
            </div>
          </div>
        </section>

        <section id="pricing" className="an-brand-hairline bg-white/50 py-12 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2a9bb8]">
              {t.pricingEyebrow}
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
              {t.pricingTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink)]/55">
              {t.pricingLede}
            </p>
            <div className="mt-8 grid gap-3 sm:mt-12 sm:gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {t.pricing.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-black/[0.06] bg-white p-6 sm:p-7"
                >
                  <h3 className="text-xl font-semibold text-[var(--ink)]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]/55">{item.body}</p>
                  <p className="mt-4 text-[13px] text-[var(--ink)]/45">{item.note}</p>
                </article>
              ))}
            </div>
            <Link href="/pricing" className="an-btn-primary mt-8 inline-flex w-full justify-center px-5 py-2.5 sm:mt-10 sm:w-auto">
              {t.pricingCta}
            </Link>
          </div>
        </section>

        <section className="relative overflow-hidden an-brand-hairline py-14 sm:py-28">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-[#b7e1ff]/50 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-8">
            <h2 className="text-[1.75rem] font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-5xl">
              {t.closeTitle}
            </h2>
            <p className="mt-4 text-[15px] text-[var(--ink)]/55 sm:mt-5">{t.closeBody}</p>
            <Link
              href={signedIn ? "/control-tower" : "/signup"}
              className="an-btn-primary mt-6 inline-flex w-full justify-center px-6 py-3 sm:mt-8 sm:w-auto"
            >
              {signedIn ? t.closeCta : t.signup}
            </Link>
          </div>
        </section>
    </MarketingChrome>
  );
}
