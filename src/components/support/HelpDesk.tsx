"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/copy";

type Card = {
  id: string;
  status: string;
  name: string;
  email: string;
  visitorKind: string;
  roleLabel: string;
  brand: string | null;
  preview: string;
  queuedAt: string;
  path: string;
  locale: string;
  closeReason: string | null;
};
type Msg = { id: string; from: string; body: string; sentAt: string; seen?: boolean };
type Desk = {
  agentName: string;
  active: (Card & { messages: Msg[] }) | null;
  waiting: Card[];
  closed: Card[];
};
type Hours = {
  enabled: boolean;
  openHm: string;
  closeHm: string;
  daysOfWeek: number[];
  timezone: string;
};

const DAYS = [
  { n: 1, en: "Mon", id: "Sen" },
  { n: 2, en: "Tue", id: "Sel" },
  { n: 3, en: "Wed", id: "Rab" },
  { n: 4, en: "Thu", id: "Kam" },
  { n: 5, en: "Fri", id: "Jum" },
  { n: 6, en: "Sat", id: "Sab" },
  { n: 7, en: "Sun", id: "Min" },
];

function who(c: Card) {
  const brand = c.brand ? ` · ${c.brand}` : c.visitorKind === "PROSPECT" ? " · prospect" : "";
  return `${c.name}${brand}`;
}

export function HelpDesk({ locale }: { locale: "en" | "id" }) {
  const id = locale === "id";
  const [desk, setDesk] = useState<Desk | null>(null);
  const [hours, setHours] = useState<Hours | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [d, h] = await Promise.all([
      fetch("/api/support/desk", { credentials: "same-origin" }).then((r) => r.json()),
      fetch("/api/support/desk/settings", { credentials: "same-origin" }).then((r) => r.json()),
    ]);
    if (d && !d.error) setDesk(d as Desk);
    if (h && !h.error) setHours(h as Hours);
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [load]);

  async function act(action: string, extra: Record<string, string> = {}) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/support/desk", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = (await res.json()) as { error?: string; desk?: Desk };
      if (!res.ok) {
        setErr(data.error || "error");
        return;
      }
      if (data.desk) setDesk(data.desk);
      if (action === "reply") setDraft("");
    } finally {
      setBusy(false);
    }
  }

  async function saveHours(e: FormEvent) {
    e.preventDefault();
    if (!hours) return;
    setBusy(true);
    try {
      const res = await fetch("/api/support/desk/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hours),
      });
      const data = (await res.json()) as Hours & { error?: string };
      if (!res.ok) {
        setErr(data.error || "error");
        return;
      }
      setHours(data);
    } finally {
      setBusy(false);
    }
  }

  const closed = (desk?.closed || []).filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${c.name} ${c.email} ${c.brand || ""}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {err ? <p className="text-sm text-rose-600">{err}</p> : null}

      <form onSubmit={saveHours} className="an-card space-y-3 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{id ? "Jam buka" : "Hours"}</p>
        <p className="text-[13px] text-slate-500">
          {id
            ? `Jakarta. Di luar jam, kotak jadi form ke ${LEGAL_CONTACT_EMAIL}.`
            : `Jakarta. Off hours the box becomes the form to ${LEGAL_CONTACT_EMAIL}.`}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hours?.enabled ?? true}
            onChange={(e) => hours && setHours({ ...hours, enabled: e.target.checked })}
          />
          {id ? "Chat nyala" : "Chat on"}
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            {id ? "Buka" : "Open"}{" "}
            <input
              type="time"
              className="an-input ml-1 w-[8rem] py-1"
              value={hours?.openHm || "09:00"}
              onChange={(e) => hours && setHours({ ...hours, openHm: e.target.value })}
            />
          </label>
          <label className="text-sm">
            {id ? "Tutup" : "Close"}{" "}
            <input
              type="time"
              className="an-input ml-1 w-[8rem] py-1"
              value={hours?.closeHm || "17:00"}
              onChange={(e) => hours && setHours({ ...hours, closeHm: e.target.value })}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => {
            const on = hours?.daysOfWeek?.includes(d.n) ?? true;
            return (
              <label key={d.n} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => {
                    if (!hours) return;
                    const next = e.target.checked
                      ? [...hours.daysOfWeek, d.n]
                      : hours.daysOfWeek.filter((n) => n !== d.n);
                    setHours({ ...hours, daysOfWeek: next });
                  }}
                />
                {id ? d.id : d.en}
              </label>
            );
          })}
        </div>
        <button type="submit" className="an-btn-primary px-3 py-1.5 text-[12px]" disabled={busy}>
          {id ? "Simpan jam" : "Save hours"}
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr]">
        <section className="an-card flex min-h-[22rem] flex-col p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{id ? "Sekarang" : "Now"}</p>
          {desk?.active ? (
            <>
              <p className="mt-1 text-sm font-semibold">
                {who(desk.active)}
                <span className="ml-2 text-[11px] font-normal text-slate-400">{desk.active.path}</span>
              </p>
              <p className="text-[12px] text-slate-500">{desk.active.email}</p>
              <div className="mt-3 max-h-64 flex-1 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
                {desk.active.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from === "AGENT" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px] ${
                        m.from === "AGENT" ? "bg-[var(--ink)] text-white" : "bg-white shadow-sm"
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                ))}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("reply", { threadId: desk.active!.id, body: draft });
                }}
              >
                <input className="an-input flex-1" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={id ? "Balas sebagai Radit…" : "Reply as Radit…"} />
                <button className="an-btn-primary px-3 text-[12px]" disabled={busy}>
                  {id ? "Kirim" : "Send"}
                </button>
              </form>
              <button
                type="button"
                className="mt-2 text-left text-[12px] text-slate-500 underline"
                onClick={() => void act("close", { threadId: desk.active!.id })}
              >
                {id ? "Selesai (Resolved)" : "Resolved"}
              </button>
            </>
          ) : (
            <p className="mt-6 text-sm text-slate-400">{id ? "Tidak ada percakapan aktif. Ambil dari antrian." : "No live conversation. Take the next in line."}</p>
          )}
        </section>

        <div className="space-y-4">
          <section className="an-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{id ? "Menunggu" : "Waiting"}</p>
            <ul className="mt-2 space-y-2">
              {(desk?.waiting || []).map((w, i) => (
                <li key={w.id} className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      #{i + 1} {who(w)}
                    </p>
                    <p className="truncate text-[12px] text-slate-500">{w.preview || w.email}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-[12px] font-semibold text-[#2a9bb8] disabled:text-slate-300"
                    disabled={Boolean(desk?.active) || busy}
                    onClick={() => void act("open", { threadId: w.id })}
                  >
                    {id ? "Buka" : "Open"}
                  </button>
                </li>
              ))}
              {!desk?.waiting?.length ? <li className="text-sm text-slate-400">{id ? "Antrian kosong." : "Queue is empty."}</li> : null}
            </ul>
          </section>

          <section className="an-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{id ? "Selesai" : "Closed"}</p>
            <input
              className="an-input mt-2 text-[13px]"
              placeholder={id ? "Cari nama / email / merek" : "Search name / email / brand"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-[13px]">
              {closed.map((c) => (
                <li key={c.id} className="border-b border-slate-50 py-1.5">
                  <span className="font-medium">{who(c)}</span>
                  <span className="text-slate-400"> · {c.email}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
