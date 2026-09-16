"use client";

import { useCallback, useEffect, useState } from "react";
import type { Messages } from "@/lib/i18n/messages";

type Row = {
  id: string;
  phone: string;
  status: string;
  errorTitle: string;
  errorCode: number | null;
  pricingCategory: string | null;
  repliedAt: string | null;
};

type Batch = {
  id: string;
  kind: string;
  templateName: string | null;
  createdAt: string;
  by: string | null;
  attempted: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  action: number;
  rows: Row[];
};

function kindLabel(kind: string, templateName: string | null, t: Messages["broadcast"]) {
  if (kind === "SESSION") return t.sessionKind;
  if (kind === "BIRTHDAY_H2") return t.historyBirthday;
  return templateName ? `${t.tabTemplates} · ${templateName}` : t.tabTemplates;
}

function statusLabel(status: string, t: Messages["broadcast"]) {
  if (status === "READ") return t.historyRead;
  if (status === "DELIVERED") return t.historyDelivered;
  if (status === "FAILED") return t.historyFailed;
  if (status === "SENT") return t.historySent;
  return status;
}

export function HistoryPanel({
  t,
  qs,
  enabled,
}: {
  t: Messages["broadcast"];
  qs: string;
  enabled: boolean;
}) {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setBatches([]);
      return;
    }
    const res = await fetch(`/api/broadcast/history${qs}`, { credentials: "same-origin" });
    const json = (await res.json()) as { batches?: Batch[]; error?: string };
    if (!res.ok) {
      setErr(json.error || t.network);
      setBatches([]);
      return;
    }
    setErr(null);
    setBatches(json.batches || []);
  }, [enabled, qs, t.network]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 8000);
    return () => clearInterval(id);
  }, [load]);

  if (!enabled) return null;
  if (!batches) return <p className="text-sm text-slate-500">{t.historyLoading}</p>;
  if (err) return <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>;
  if (!batches.length) {
    return (
      <div className="an-card px-6 py-10 text-center">
        <p className="text-sm font-semibold text-slate-800">{t.historyEmpty}</p>
        <p className="mt-2 text-[13px] text-slate-500">{t.historyEmptyHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-slate-500">{t.historyFoot}</p>
      {batches.map((b) => {
        const open = openId === b.id;
        return (
          <article key={b.id} className="an-card overflow-hidden">
            <button
              type="button"
              className="flex w-full flex-col gap-2 px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
              onClick={() => setOpenId(open ? null : b.id)}
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{kindLabel(b.kind, b.templateName, t)}</p>
                <p className="text-[12px] text-slate-500">
                  {new Date(b.createdAt).toLocaleString()}
                  {b.by ? ` · ${b.by}` : ""}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-6">
                <Stat k={t.historyAttempted} v={b.attempted} />
                <Stat k={t.historySent} v={b.sent} />
                <Stat k={t.historyDelivered} v={b.delivered} />
                <Stat k={t.historyRead} v={b.read} />
                <Stat k={t.historyFailed} v={b.failed} />
                <Stat k={t.historyAction} v={b.action} />
              </dl>
            </button>
            {open ? (
              <ul className="border-t border-slate-100 px-4 py-2 text-[13px]">
                {b.rows.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                    <span className="font-mono text-[12px]">{r.phone}</span>
                    <span className="text-slate-600">
                      {statusLabel(r.status, t)}
                      {r.repliedAt ? ` · ${t.historyAction}` : ""}
                      {r.pricingCategory ? ` · ${r.pricingCategory}` : ""}
                      {r.status === "FAILED" && r.errorTitle ? ` · ${r.errorTitle}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: number }) {
  return (
    <div>
      <dt className="uppercase tracking-wide text-slate-400">{k}</dt>
      <dd className="text-[15px] font-semibold text-slate-900">{v}</dd>
    </div>
  );
}
