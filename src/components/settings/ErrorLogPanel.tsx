"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locale";

type Row = {
  id: string;
  source: string;
  title: string;
  detail: string | null;
  createdAt: string;
};

export function ErrorLogPanel({ locale }: { locale: Locale }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [copyAll, setCopyAll] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/errors", { credentials: "same-origin" });
    const data = await res.json();
    if (res.ok) {
      setRows(data.errors || []);
      setCopyAll(data.copyAll || "");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function copy(text: string, ok: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(ok);
    } catch {
      setMsg("Copy gagal — select teks manual.");
    }
  }

  async function clearAll() {
    if (!window.confirm("Hapus semua error log?")) return;
    await fetch("/api/settings/errors", { method: "DELETE", credentials: "same-origin" });
    setMsg("Log dikosongkan.");
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="an-btn-primary text-sm"
          disabled={!copyAll}
          onClick={() => copy(copyAll, "Semua error tersalin. Tempel ke Grok.")}
        >
          Copy semua
        </button>
        <button type="button" className="an-btn-ghost text-sm" onClick={() => void load()}>
          Refresh
        </button>
        <button
          type="button"
          className="an-btn text-sm border border-rose-200 bg-rose-50 text-rose-700"
          disabled={!rows.length}
          onClick={() => void clearAll()}
        >
          Clear
        </button>
      </div>

      {msg && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </p>
      )}

      {!rows.length ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
          Belum ada error. Kalau WhatsApp / Settings bermasalah, muncul di sini.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const blob = [
              `[${r.createdAt}] ${r.source}`,
              r.title,
              r.detail || "",
            ]
              .filter(Boolean)
              .join("\n");
            return (
              <li key={r.id} className="an-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {r.source} · {formatDateTime(r.createdAt, locale)}
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-800">{r.title}</p>
                    {r.detail && (
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600">
                        {r.detail}
                      </pre>
                    )}
                  </div>
                  <button
                    type="button"
                    className="an-btn-soft text-xs"
                    onClick={() => copy(blob, "Error tersalin. Tempel ke Grok.")}
                  >
                    Copy
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
