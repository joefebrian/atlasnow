"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MetricTile } from "@/components/ui";
import type { Locale } from "@/lib/i18n/locale";

type LocationRow = {
  locationId: string;
  locationName: string;
  placeId: string | null;
  url: string | null;
  mapped: boolean;
  intents: number;
  newReviews: number;
  estimatedLabel: string;
  windowDays: number;
};

type Summary = {
  intents: number;
  newReviews: number;
  estimatedLabel: string;
  windowDays: number;
  outlets: { id: string; name: string; mapped: boolean; url: string | null }[];
};

export function ReviewCapturePanel({
  locale,
  clientId,
  locationId,
}: {
  locale: Locale;
  clientId: string | null;
  locationId?: string;
}) {
  const id = locale === "id";
  const [row, setRow] = useState<LocationRow | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const qs = new URLSearchParams();
    if (locationId) qs.set("locationId", locationId);
    else if (clientId) qs.set("clientId", clientId);
    else return;
    const res = await fetch(`/api/reviews/capture?${qs}`, { credentials: "same-origin" });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Failed");
      return;
    }
    if (locationId) setRow(data as LocationRow);
    else setSummary(data as Summary);
  }, [clientId, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const intents = locationId ? row?.intents : summary?.intents;
  const neu = locationId ? row?.newReviews : summary?.newReviews;
  const est = locationId ? row?.estimatedLabel : summary?.estimatedLabel;

  async function copyUrl() {
    if (!row?.url) return;
    await navigator.clipboard.writeText(row.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile icon="→" value={intents ?? "—"} label={id ? "Intent buka link" : "Review intents"} tone="indigo" />
        <MetricTile icon="★" value={neu ?? "—"} label={id ? "Review baru (30 hari)" : "New reviews (30 days)"} tone="amber" />
        <MetricTile
          icon="%"
          value={est ?? "—"}
          label={id ? "Estimated capture rate" : "Estimated capture rate"}
          tone="emerald"
        />
      </div>
      <p className="text-[11px] text-slate-500">
        {id
          ? "Estimated = review baru ÷ buka link, 30 hari. Bukan konversi, bukan kunjungan. Tamu menulis di Google."
          : "Estimated = new reviews ÷ link opens, last 30 days. Not conversion, not visits. Guests write on Google."}
      </p>

      {err ? <p className="text-sm text-rose-700">{err}</p> : null}

      {locationId && row ? (
        <div className="an-card flex flex-wrap items-center gap-3 p-4">
          {row.mapped && row.url ? (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {id ? "Link review gerai" : "Outlet review link"}
                </div>
                <code className="block truncate text-xs text-slate-700">{row.url}</code>
                <p className="mt-1 text-[11px] text-slate-500">
                  {id
                    ? "Satu link. NFC / QR / struk: tambah ?utm_source=nfc di salinan."
                    : "One link. NFC / QR / receipt: add ?utm_source=nfc on your copy."}
                </p>
              </div>
              <button type="button" className="an-btn-soft text-xs" onClick={copyUrl}>
                {copied ? (id ? "Tersalin" : "Copied") : id ? "Salin" : "Copy"}
              </button>
              <a
                className="an-btn-primary text-xs"
                href={`/api/reviews/capture/qr?locationId=${encodeURIComponent(row.locationId)}&download=1`}
              >
                {id ? "Unduh QR" : "Download QR"}
              </a>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              {id ? "Pasang Google Maps dulu di outlet ini." : "Map this outlet on Google Maps first."}{" "}
              <Link href={`/locations/${row.locationId}`} className="font-semibold text-indigo-600 hover:underline">
                {id ? "Buka gerai" : "Open outlet"}
              </Link>
            </p>
          )}
        </div>
      ) : null}

      {!locationId && summary ? (
        <p className="text-[11px] text-slate-500">
          {id
            ? "Pilih satu cabang di filter untuk salin link / unduh QR."
            : "Pick one branch in the filter to copy the link or download the QR."}
        </p>
      ) : null}
    </div>
  );
}
