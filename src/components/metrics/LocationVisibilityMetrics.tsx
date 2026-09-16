"use client";

import { useEffect, useState } from "react";
import { MetricCardGrid } from "@/components/metrics/MetricCard";
import type { MetricCardView } from "@/lib/metrics/observations";

export function LocationVisibilityMetrics({ locationId }: { locationId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<MetricCardView[]>([]);
  const [meta, setMeta] = useState<{
    periodStart: string;
    periodEnd: string;
    timezone: string;
    hasAnyData: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/locations/${locationId}/metrics?days=28`, {
          credentials: "same-origin",
        });
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(data.error || "Failed to load metrics");
          return;
        }
        if (!cancelled) {
          setCards(data.cards || []);
          setMeta({
            periodStart: data.periodStart,
            periodEnd: data.periodEnd,
            timezone: data.timezone,
            hasAnyData: Boolean(data.hasAnyData),
          });
        }
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  if (loading) {
    return (
      <div className="an-card p-8 text-center text-sm text-slate-400">
        Loading visibility metrics…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="an-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Visibility · Google Business Profile performance
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Last 28 days · grain <code className="font-mono">location_day</code> · timezone{" "}
          {meta?.timezone}. Missing days show as <strong>No data</strong>, never fake zeros.
          Live Performance API sync lands in S5; seeded demo rows may appear for pilot stores.
        </p>
        {meta && (
          <p className="mt-2 text-[11px] text-slate-400">
            Period {meta.periodStart} → {meta.periodEnd}
            {meta.hasAnyData ? "" : " · no observations stored yet"}
          </p>
        )}
      </div>
      <MetricCardGrid cards={cards} />
    </div>
  );
}
