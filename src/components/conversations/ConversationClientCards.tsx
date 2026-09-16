"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, SearchField } from "@/components/ui";
import type { ConversationClientSummary } from "@/lib/conversations/portfolio";
import type { Locale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";

export function ConversationClientCards({
  locale,
  summaries,
}: {
  locale: Locale;
  summaries: ConversationClientSummary[];
}) {
  const t = getMessages(locale).conversations;
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
      chats: summaries.reduce((n, c) => n + c.conversationCount, 0),
      unreplied: summaries.reduce((n, c) => n + c.unrepliedCount, 0),
      branches: summaries.reduce((n, c) => n + c.branchCount, 0),
    }),
    [summaries]
  );

  return (
    <div className="an-section">
      <PageHeader
        eyebrow={t.eyebrow}
        badge={t.badge}
        title={t.title}
        description={t.pickClientHint}
        actions={
          <span className="an-badge-warn">
            {totals.unreplied} {t.unreplied}
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={t.cardClients} value={totals.clients} />
        <Stat label={t.cardBranches} value={totals.branches} />
        <Stat label={t.cardChats} value={totals.chats} />
        <Stat label={t.unreplied} value={totals.unreplied} />
      </div>

      <div className="an-card p-4">
        <SearchField
          placeholder={t.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="an-card px-6 py-14 text-center">
          <p className="text-sm font-semibold text-slate-800">{t.pickClient}</p>
          <p className="mt-1 text-xs text-slate-500">{t.pickClientHint}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/conversations?client=${c.id}`}
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
                    {c.unrepliedCount} {t.unreplied}
                  </span>
                ) : (
                  <span className="an-badge-muted">{c.conversationCount} {t.cardChats.toLowerCase()}</span>
                )}
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Mini label={t.cardBranches} value={c.branchCount} />
                <Mini label={t.cardChats} value={c.conversationCount} />
                <Mini label={t.unreplied} value={c.unrepliedCount} />
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
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">{value}</div>
    </div>
  );
}
