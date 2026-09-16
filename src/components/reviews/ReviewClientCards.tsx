"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, SearchField } from "@/components/ui";
import type { ReviewClientSummary } from "@/lib/conversations/portfolio";
import type { Locale } from "@/lib/i18n/locale";

export function ReviewClientCards({
  locale,
  summaries,
}: {
  locale: Locale;
  summaries: ReviewClientSummary[];
}) {
  const id = locale === "id";
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return summaries;
    return summaries.filter((c) =>
      `${c.name} ${c.slug}`.toLowerCase().includes(needle)
    );
  }, [summaries, q]);

  const totals = useMemo(
    () => ({
      clients: summaries.length,
      branches: summaries.reduce((n, c) => n + c.branchCount, 0),
      reviews: summaries.reduce((n, c) => n + c.reviewCount, 0),
      unreplied: summaries.reduce((n, c) => n + c.unrepliedCount, 0),
    }),
    [summaries]
  );

  return (
    <div className="an-section">
      <PageHeader
        eyebrow="Reputation"
        badge="Per brand"
        title="Reviews"
        description={
          id
            ? "Pilih merek dulu. Setelah itu bisa lihat semua cabang merek itu, atau filter satu cabang."
            : "Pick a brand first. Then see all of that brand’s branches, or filter one outlet."
        }
        actions={
          <span className="an-badge-warn">
            {totals.unreplied} {id ? "belum dibalas" : "unreplied"}
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={id ? "Merek" : "Brands"} value={totals.clients} />
        <Stat label={id ? "Cabang" : "Branches"} value={totals.branches} />
        <Stat label={id ? "Ulasan" : "Reviews"} value={totals.reviews} />
        <Stat label={id ? "Belum dibalas" : "Unreplied"} value={totals.unreplied} />
      </div>

      <div className="an-card p-4">
        <SearchField
          placeholder={id ? "Cari merek…" : "Search brands…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="an-card px-6 py-14 text-center">
          <p className="text-sm font-semibold text-slate-800">
            {id ? "Pilih merek" : "Pick a brand"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {id
              ? "Tambah brand di Brands, lalu buka ulasannya di sini."
              : "Add a brand under Brands, then open its reviews here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/reputation?client=${c.id}`}
              className="an-card group p-5 transition hover:ring-2 hover:ring-indigo-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 group-hover:text-indigo-700">
                    {c.name}
                  </h2>
                  <p className="font-mono text-[11px] text-slate-400">{c.slug}</p>
                </div>
                {c.unrepliedCount > 0 ? (
                  <span className="an-badge-no">
                    {c.unrepliedCount} {id ? "belum dibalas" : "unreplied"}
                  </span>
                ) : (
                  <span className="an-badge-muted">
                    {c.reviewCount} {id ? "ulasan" : "reviews"}
                  </span>
                )}
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Mini label={id ? "Cabang" : "Branches"} value={c.branchCount} />
                <Mini label={id ? "Ulasan" : "Reviews"} value={c.reviewCount} />
                <Mini label={id ? "Open" : "Open"} value={c.unrepliedCount} />
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="an-card px-4 py-3">
      <div className="an-label">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2">
      <div className="text-sm font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="text-[10px] font-medium text-slate-400">{label}</div>
    </div>
  );
}
