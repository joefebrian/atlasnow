"use client";

import { useRouter } from "next/navigation";
import { lastNDays, monthToDate, todayKey } from "@/lib/home/range";
import type { Messages } from "@/lib/i18n/messages";

type Props = {
  from: string;
  to: string;
  compare: boolean;
  t: Messages["controlTower"];
};

export function DeskRangeBar({ from, to, compare, t }: Props) {
  const router = useRouter();
  const today = todayKey();
  const preset7 = lastNDays(today, 7);
  const preset28 = lastNDays(today, 28);
  const presetMonth = monthToDate(today);

  function go(nextFrom: string, nextTo: string, nextCompare = compare) {
    const qs = new URLSearchParams();
    qs.set("from", nextFrom);
    qs.set("to", nextTo);
    if (!nextCompare) qs.set("compare", "0");
    router.push(`/control-tower?${qs.toString()}`);
  }

  const pill = (active: boolean) =>
    `inline-flex h-10 items-center rounded-full px-3 text-[12px] font-semibold transition ${
      active
        ? "bg-[var(--ink)] text-white"
        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
    }`;

  return (
    <div className="an-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={pill(from === preset7.from && to === preset7.to)}
            onClick={() => go(preset7.from, preset7.to)}
          >
            {t.preset7}
          </button>
          <button
            type="button"
            className={pill(from === preset28.from && to === preset28.to)}
            onClick={() => go(preset28.from, preset28.to)}
          >
            {t.preset28}
          </button>
          <button
            type="button"
            className={pill(from === presetMonth.from && to === presetMonth.to)}
            onClick={() => go(presetMonth.from, presetMonth.to)}
          >
            {t.presetMonth}
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[9.5rem]">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {t.rangeFrom}
            </span>
            <input
              type="date"
              value={from}
              max={to}
              className="an-input h-10 py-0 text-sm"
              onChange={(e) => {
                const v = e.target.value;
                if (v) go(v, to);
              }}
            />
          </label>
          <label className="min-w-[9.5rem]">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {t.rangeTo}
            </span>
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              className="an-input h-10 py-0 text-sm"
              onChange={(e) => {
                const v = e.target.value;
                if (v) go(from, v);
              }}
            />
          </label>
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => go(from, to, e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            {t.compare}
          </label>
        </div>
      </div>
    </div>
  );
}
