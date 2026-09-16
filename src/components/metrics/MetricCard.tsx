"use client";

import { useState } from "react";
import type { MetricCardView } from "@/lib/metrics/observations";

export function MetricCard({ card }: { card: MetricCardView }) {
  const [openWhy, setOpenWhy] = useState(false);
  const isMissing = card.state.kind === "NO_DATA";
  const isError = card.state.kind === "ERROR";
  const isThreshold = card.state.kind === "THRESHOLD";

  return (
    <div className="an-card relative flex flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="an-label">{card.uiLabel}</div>
          <div
            className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${
              isMissing || isError
                ? "text-slate-400"
                : isThreshold
                  ? "text-amber-700"
                  : "text-slate-900"
            }`}
          >
            {card.display}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 ring-1 ring-indigo-100">
          {card.sourceBadge}
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-slate-500">{card.interpretation}</p>

      <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-[10px] text-slate-500">
        <div className="flex justify-between gap-2">
          <dt>Scope</dt>
          <dd className="truncate text-right font-medium text-slate-700" title={card.scope}>
            {card.scope}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Period</dt>
          <dd className="text-right font-medium text-slate-700">
            {card.periodStart} → {card.periodEnd}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Timezone</dt>
          <dd className="font-medium text-slate-700">{card.timezone}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Comparison</dt>
          <dd className="text-right font-medium text-slate-700">{card.comparison}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Coverage</dt>
          <dd className="font-medium text-slate-700">{card.coverageLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Freshness</dt>
          <dd>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                card.freshness === "FRESH"
                  ? "bg-emerald-50 text-emerald-700"
                  : card.freshness === "STALE"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {card.freshness}
            </span>
          </dd>
        </div>
      </dl>

      <button
        type="button"
        className="mt-3 text-left text-[11px] font-semibold text-indigo-600 hover:underline"
        onClick={() => setOpenWhy((v) => !v)}
      >
        {openWhy ? "Hide · Why this number?" : "Why this number?"}
      </button>

      {openWhy && (
        <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600 ring-1 ring-slate-100">
          <p>
            <span className="font-semibold text-slate-700">Source metric:</span>{" "}
            <code className="font-mono text-[10px]">{card.why.sourceMetric}</code>
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-700">Formula:</span> {card.why.formula}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-700">Caveat:</span> {card.why.caveat}
          </p>
          <p className="mt-1 text-rose-700/90">
            <span className="font-semibold">Do not claim:</span> {card.why.forbidden}
          </p>
        </div>
      )}
    </div>
  );
}

export function MetricCardGrid({
  cards,
  emptyHint,
}: {
  cards: MetricCardView[];
  emptyHint?: string;
}) {
  if (!cards.length) {
    return (
      <div className="an-card p-6 text-sm text-slate-500">
        {emptyHint || "No metric definitions configured."}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => (
        <MetricCard key={c.metricKey} card={c} />
      ))}
    </div>
  );
}
