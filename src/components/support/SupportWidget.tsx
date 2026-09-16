"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n/locale";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/copy";

type Presence = "active" | "away" | "closed";
type Msg = {
  id: string;
  from: string;
  body: string;
  sentAt: string;
  seen?: boolean;
  agentName?: string;
};
type Thread = {
  id: string;
  status: string;
  queuePosition: number;
  closeReason: string | null;
  messages: Msg[];
};
type Snap = {
  agentName: string;
  hoursOpen: boolean;
  presence: Presence;
  openHm: string;
  closeHm: string;
  me: { name: string; email: string; brand: string; role: string } | null;
  thread: Thread | null;
};

function copy(locale: Locale) {
  const id = locale === "id";
  return {
    title: "Radit",
    person: id ? "Orang di AtlasNow" : "A person at AtlasNow",
    openChat: id ? "Chat dengan Radit" : "Chat with Radit",
    placeholder: id ? "Tulis pesan…" : "Write a message…",
    send: id ? "Kirim" : "Send",
    name: id ? "Nama" : "Name",
    email: "Email",
    company: id ? "Merek / perusahaan" : "Brand / company",
    formMsg: id ? "Pesan" : "Message",
    formSend: id ? "Kirim ke support" : "Send to support",
    formOk: id ? "Terkirim. Kami balas lewat email." : "Sent. We’ll reply by email.",
    closed: (open: string, close: string) =>
      id
        ? `Radit di meja ${open}–${close} (Jakarta). Isi form — masuk ke ${LEGAL_CONTACT_EMAIL}.`
        : `Radit is at the desk ${open}–${close} (Jakarta). Leave a note — it goes to ${LEGAL_CONTACT_EMAIL}.`,
    away: id
      ? "Radit belum di meja. Pesanmu antre. Atau email hello@atlasnow.co."
      : "Radit is away from the desk. Your note waits in line. Or email hello@atlasnow.co.",
    queue: (n: number) =>
      id ? `Radit sedang bantu orang lain · antrian #${n}` : `Radit is with someone else · #${n}`,
    notSeen: id ? "Belum dibuka" : "Not seen yet",
    seen: id ? "Dilihat" : "Seen",
    silenceClose: id
      ? `Percakapan ditutup — tidak ada balasan 10 menit. Email ${LEGAL_CONTACT_EMAIL}. Orang yang baca.`
      : `This chat closed — no reply for 10 minutes. Email ${LEGAL_CONTACT_EMAIL}. A person reads it.`,
    resolved: id
      ? `Percakapan ditutup. Lanjut ke ${LEGAL_CONTACT_EMAIL}.`
      : `This chat closed. Continue at ${LEGAL_CONTACT_EMAIL}.`,
    needName: id ? "Nama dan email dulu." : "Name and email first.",
  };
}

export function SupportWidget({ locale }: { locale: Locale }) {
  const t = copy(locale);
  const path = usePathname() || "/";
  const onHelpDesk = path === "/support" || path.startsWith("/support/");
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [formMsg, setFormMsg] = useState("");
  const [formOk, setFormOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/support/widget", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as Snap;
      setSnap(data);
      if (data.me) {
        setName((n) => n || data.me!.name);
        setEmail((e) => e || data.me!.email);
        setCompany((c) => c || data.me!.brand);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), open ? 4000 : 20000);
    return () => clearInterval(id);
  }, [load, open]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [snap?.thread?.messages.length, open]);

  const presence = snap?.presence || "closed";
  const thread = snap?.thread;
  const chatting = presence !== "closed";
  const lastVisitor = [...(thread?.messages || [])].reverse().find((m) => m.from === "VISITOR");

  async function sendChat(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError(t.needName);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/support/widget/message", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, body: draft, locale, path }),
      });
      const data = (await res.json()) as { error?: string; thread?: Thread };
      if (!res.ok) {
        setError(data.error === "closed_hours" ? t.closed(snap?.openHm || "09:00", snap?.closeHm || "17:00") : t.needName);
        void load();
        return;
      }
      setDraft("");
      if (data.thread && snap) setSnap({ ...snap, thread: data.thread, hoursOpen: true });
      void load();
    } catch {
      setError(locale === "id" ? "Jaringan error." : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function sendForm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company,
          message: formMsg,
          website: "",
          locale,
          page: path,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || (locale === "id" ? "Gagal mengirim." : "Could not send."));
        return;
      }
      setFormOk(true);
      setFormMsg("");
    } catch {
      setError(locale === "id" ? "Jaringan error." : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  const closedCopy = t.closed(snap?.openHm || "09:00", snap?.closeHm || "17:00");
  if (onHelpDesk) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open ? (
        <div className="pointer-events-auto flex h-[min(32rem,calc(100dvh-6rem))] w-[min(22.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_16px_50px_rgba(31,27,29,0.18)]">
          <header className="flex items-center gap-3 bg-[var(--ink)] px-4 py-3 text-white">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#7ee5d6] text-[11px] font-bold text-[var(--ink)]">
              R
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--ink)] ${
                  presence === "active" ? "bg-emerald-400" : presence === "away" ? "bg-amber-400" : "bg-slate-400"
                }`}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-tight">Radit</p>
              <p className="text-[11px] text-white/55">
                {presence === "active" ? (locale === "id" ? "Aktif" : "Active") : presence === "away" ? (locale === "id" ? "Away" : "Away") : locale === "id" ? "Tutup" : "Closed"}
                {" · "}
                {t.person}
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-white/70 hover:text-white" aria-label="Close">
              ×
            </button>
          </header>

          <div className="flex-1 overflow-y-auto bg-[var(--warm)] px-3 py-3">
            {presence === "closed" ? (
              formOk ? (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">{t.formOk}</p>
              ) : (
                <form onSubmit={sendForm} className="space-y-2">
                  <p className="text-[12px] leading-relaxed text-[var(--ink)]/60">{closedCopy}</p>
                  <input className="an-input" required placeholder={t.name} value={name} onChange={(e) => setName(e.target.value)} />
                  <input className="an-input" required type="email" placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} />
                  <input className="an-input" placeholder={t.company} value={company} onChange={(e) => setCompany(e.target.value)} />
                  <textarea className="an-input min-h-[5.5rem]" required minLength={8} placeholder={t.formMsg} value={formMsg} onChange={(e) => setFormMsg(e.target.value)} />
                  {error ? <p className="text-[12px] text-rose-600">{error}</p> : null}
                  <button className="an-btn-primary w-full py-2 text-[13px]" disabled={busy} type="submit">
                    {t.formSend}
                  </button>
                </form>
              )
            ) : (
              <div className="flex min-h-full flex-col gap-2">
                {presence === "away" && !thread ? <p className="text-[12px] text-[var(--ink)]/55">{t.away}</p> : null}
                {thread?.status === "QUEUED" && thread.queuePosition > 0 ? (
                  <p className="rounded-xl bg-white/80 px-3 py-2 text-[12px] text-[var(--ink)]/60">{t.queue(thread.queuePosition)}</p>
                ) : null}
                {(thread?.messages || []).map((m) => (
                  <div key={m.id} className={`flex ${m.from === "VISITOR" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                        m.from === "VISITOR" ? "bg-[var(--ink)] text-white" : "bg-white text-[var(--ink)] shadow-sm"
                      }`}
                    >
                      {m.from === "AGENT" ? <p className="mb-0.5 text-[10px] font-semibold text-[#2a9bb8]">Radit</p> : null}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  </div>
                ))}
                {lastVisitor && thread?.status !== "CLOSED" ? (
                  <p className="text-right text-[10px] text-[var(--ink)]/40">
                    {lastVisitor.seen ? t.seen : t.notSeen}
                  </p>
                ) : null}
                {thread?.status === "CLOSED" ? (
                  <p className="rounded-xl bg-white px-3 py-2 text-[12px] text-[var(--ink)]/65">
                    {thread.closeReason === "VISITOR_SILENCE" ? t.silenceClose : t.resolved}
                  </p>
                ) : null}
                <div ref={bottom} />
              </div>
            )}
          </div>

          {chatting ? (
            <form onSubmit={sendChat} className="border-t border-black/[0.06] bg-white p-2">
              {!snap?.me ? (
                <div className="mb-2 grid grid-cols-2 gap-1.5">
                  <input className="an-input py-1.5 text-[12px]" placeholder={t.name} value={name} onChange={(e) => setName(e.target.value)} required />
                  <input className="an-input py-1.5 text-[12px]" type="email" placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              ) : null}
              {error ? <p className="px-1 pb-1 text-[11px] text-rose-600">{error}</p> : null}
              <div className="flex gap-1.5">
                <input
                  className="an-input flex-1 py-2 text-[13px]"
                  placeholder={t.placeholder}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  required
                />
                <button type="submit" disabled={busy} className="an-btn-primary shrink-0 px-3 py-2 text-[12px]">
                  {t.send}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-[var(--ink)] py-2.5 pl-2.5 pr-4 text-white shadow-lg shadow-black/20"
        aria-label={t.openChat}
      >
        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#7ee5d6] text-[11px] font-bold text-[var(--ink)]">
          R
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--ink)] ${
              presence === "active" ? "bg-emerald-400" : presence === "away" ? "bg-amber-400" : "bg-slate-400"
            }`}
          />
        </span>
        <span className="text-[13px] font-semibold">{open ? "×" : "Radit"}</span>
      </button>
    </div>
  );
}
