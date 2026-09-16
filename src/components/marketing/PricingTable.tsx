"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { trackSelectPlan } from "@/lib/analytics/ga";
import type { Locale } from "@/lib/i18n/locale";
import {
  EXTRA_OUTLET_UI_MAX,
  extraIncrementIdr,
  formatCompareCell,
  formatIdr,
  planTotalIdr,
  pricingCopy,
  type PricingPlan,
} from "@/lib/marketing/pricing";

export function PricingTable({
  locale,
  signedIn = false,
}: {
  locale: Locale;
  signedIn?: boolean;
}) {
  const t = pricingCopy(locale);
  const [extra, setExtra] = useState(0);
  const increment = extraIncrementIdr(extra);

  const dec = () => setExtra((n) => Math.max(0, n - 1));
  const inc = () => setExtra((n) => Math.min(EXTRA_OUTLET_UI_MAX, n + 1));

  return (
    <>
      <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ink)]/40">
              {t.extraOutletsLabel}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink)]/50">{t.stepperHint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={dec}
                disabled={extra === 0}
                aria-label={locale === "id" ? "Kurangi outlet extra" : "Fewer extra outlets"}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-lg font-semibold text-[var(--ink)] disabled:opacity-30"
              >
                −
              </button>
              <span className="min-w-[2.5rem] text-center text-2xl font-semibold tabular-nums tracking-tight text-[var(--ink)]">
                {extra}
              </span>
              <button
                type="button"
                onClick={inc}
                disabled={extra === EXTRA_OUTLET_UI_MAX}
                aria-label={locale === "id" ? "Tambah outlet extra" : "More extra outlets"}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-lg font-semibold text-[var(--ink)] disabled:opacity-30"
              >
                +
              </button>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ink)]/40">
                {t.incrementLabel}
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--ink)]">
                {increment === 0 ? `+ ${formatIdr(0)}` : `+ ${formatIdr(increment)}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="-mx-4 mt-6 flex items-stretch gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:mx-0 sm:gap-4 sm:px-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
        {t.plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            extra={extra}
            increment={increment}
            locale={locale}
            signedIn={signedIn}
            t={t}
          />
        ))}
      </div>

      <CompareTable t={t} />
    </>
  );
}

function PlanCard({
  plan,
  extra,
  increment,
  locale,
  signedIn,
  t,
}: {
  plan: PricingPlan;
  extra: number;
  increment: number;
  locale: Locale;
  signedIn: boolean;
  t: ReturnType<typeof pricingCopy>;
}) {
  const total = useMemo(() => planTotalIdr(plan.id, extra), [plan.id, extra]);
  const showTotal = plan.usesStepper && extra > 0 && total != null;
  const showContact = plan.id !== "free" && plan.id !== "diamond";

  return (
    <article
      className={`flex h-full min-w-[280px] snap-start flex-col rounded-3xl border bg-white p-5 lg:min-w-0 ${
        plan.featured
          ? "border-[#7ee5d6]/80 shadow-[0_20px_50px_rgba(126,229,214,0.18)]"
          : "border-black/[0.06] shadow-[0_1px_0_rgba(31,27,29,0.04)]"
      }`}
    >
      <p
        className={`min-h-[2.5rem] text-[11px] font-bold uppercase leading-snug tracking-[0.12em] ${
          plan.featured ? "text-[#2a9bb8]" : "text-[var(--ink)]/40"
        }`}
      >
        {plan.badge}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">{plan.title}</h2>
      <p className="mt-2 min-h-[4.25rem] text-sm leading-relaxed text-[var(--ink)]/55">{plan.sub}</p>
      <p className="mt-4 whitespace-nowrap text-[1.65rem] font-semibold tracking-tight text-[var(--ink)]">
        {plan.price}
      </p>
      <p className="mt-1 min-h-[2.5rem] text-[13px] leading-snug text-[var(--ink)]/45">{plan.priceNote}</p>
      <div className="mt-2 min-h-[4.5rem]">
        {plan.usesStepper ? (
          <div className="rounded-xl bg-[#eef8ff] px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink)]/40">
              {t.incrementLabel}
            </p>
            <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">
              {increment === 0 ? `+ ${formatIdr(0)}` : `+ ${formatIdr(increment)}`}
            </p>
            {showTotal ? (
              <>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink)]/40">
                  {t.totalLabel}
                </p>
                <p className="text-base font-semibold tabular-nums text-[var(--ink)]">{formatIdr(total)}</p>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="mt-2 min-h-[2.5rem] text-[13px] italic leading-snug text-[var(--ink)]/50">{plan.hook}</p>
      <ul className="mt-4 flex-1 space-y-2 text-sm leading-relaxed text-[var(--ink)]/70">
        {plan.points.map((line) => (
          <li key={line} className="flex gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#7ee5d6]/70 text-[11px] font-bold text-[var(--ink)]">
              ✓
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      {plan.without.length > 0 ? (
        <div className="mt-5 min-h-[7.5rem]">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink)]/35">{t.withoutLabel}</p>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-[var(--ink)]/40">
            {plan.without.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden>—</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-auto flex flex-col gap-2 pt-6">
        {signedIn && plan.id !== "diamond" ? (
          <Link href="/control-tower" className="an-btn-primary justify-center px-5 py-2.5">
            {locale === "id" ? "Buka meja" : "Open desk"}
          </Link>
        ) : (
          <Link
            href={plan.signupHref}
            className="an-btn-primary justify-center px-5 py-2.5"
            onClick={() => trackSelectPlan(plan.id)}
          >
            {plan.cta}
          </Link>
        )}
        {showContact ? (
          <Link
            href={t.contactHref}
            className="an-btn justify-center rounded-xl border border-black/10 bg-white px-5 py-2.5 text-sm text-[var(--ink)] hover:bg-[#eef8ff]"
          >
            {t.contact}
          </Link>
        ) : (
          <span className="invisible h-[42px]" aria-hidden />
        )}
      </div>
    </article>
  );
}

function CompareTable({ t }: { t: ReturnType<typeof pricingCopy> }) {
  const cols = t.plans;

  return (
    <section className="mt-12 sm:mt-16">
      <h2 className="text-lg font-semibold tracking-tight text-[var(--ink)]">{t.compareTitle}</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-black/[0.06] bg-white">
        <table className="min-w-[720px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-black/[0.06]">
              <th className="sticky left-0 bg-white px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink)]/40">
                {t.compareFeature}
              </th>
              {cols.map((plan) => (
                <th
                  key={plan.id}
                  className={`px-3 py-3 text-[13px] font-semibold text-[var(--ink)] ${
                    plan.featured ? "text-[#2a9bb8]" : ""
                  }`}
                >
                  {plan.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.compare.map((row) => (
              <tr key={row.feature} className="border-b border-black/[0.04] last:border-0">
                <th className="sticky left-0 bg-white px-4 py-3 text-left text-[13px] font-medium text-[var(--ink)]/70">
                  {row.feature}
                </th>
                {cols.map((plan) => (
                  <td key={plan.id} className="px-3 py-3 text-[13px] text-[var(--ink)]/65">
                    {formatCompareCell(row[plan.id], t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
