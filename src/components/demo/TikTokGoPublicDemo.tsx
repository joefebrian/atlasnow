"use client";

import { useState } from "react";
import Link from "next/link";

type Locale = "en" | "id";
type Demo = "ok" | "wrong" | "used" | "time" | null;

const COPY = {
  en: {
    kicker: "Demo · not a live TikTok call",
    title: "TikTok GO till on AtlasNow",
    lede: "Customer already paid in TikTok. Cashier scans here. After Tebus, TikTok marks the voucher used. Head office sees tebus per outlet — not GMV.",
    connect: "How the merchant connects",
    s1: "They already have TikTok GO. Copy Merchant ID from Merchant Portal.",
    s2: "Paste it in Atlas → Chat apps → TikTok GO till. Save.",
    s3: "P2P Labs requests AtlasNow on that Merchant ID (TikTok Developer Portal).",
    s4: "They Accept AtlasNow in Merchant Portal → Application authorization.",
    s5: "Atlas fetches the token. Map each outlet. Cashier scans.",
    till: "Try the cashier (sample QR)",
    ok: "Valid voucher",
    wrong: "Wrong outlet",
    used: "Already used",
    time: "Outside hours",
    wait: "Point the camera at the TikTok QR, or tap a sample.",
    tebus: "Redeem TikTok GO voucher",
    done: "TikTok GO voucher redeemed at Menteng. Not a stamp.",
    login: "Open the real till (sign in)",
    connectDesk: "Connect a brand",
  },
  id: {
    kicker: "Demo · bukan panggilan TikTok live",
    title: "Kasir TikTok GO di AtlasNow",
    lede: "Customer sudah bayar di TikTok. Kasir scan di sini. Setelah Tebus, TikTok menandai voucher terpakai. Kantor lihat tebus per gerai — bukan omzet.",
    connect: "Cara merchant konek",
    s1: "Sudah punya TikTok GO. Salin Merchant ID dari Merchant Portal.",
    s2: "Tempel di Atlas → Chat apps → TikTok GO till. Simpan.",
    s3: "P2P Labs request AtlasNow untuk Merchant ID itu (Developer Portal).",
    s4: "Merchant Accept AtlasNow di Merchant Portal → Application authorization.",
    s5: "Atlas ambil token. Map tiap gerai. Kasir scan.",
    till: "Coba kasir (QR contoh)",
    ok: "QR valid",
    wrong: "Salah cabang",
    used: "Sudah dipakai",
    time: "Di luar jam",
    wait: "Arahkan kamera ke QR TikTok, atau ketuk contoh.",
    tebus: "Tebus voucher TikTok GO",
    done: "Voucher TikTok GO tebus di Menteng. Bukan stamp.",
    login: "Buka kasir sungguhan (masuk)",
    connectDesk: "Konek merek",
  },
};

const RESULT: Record<Exclude<Demo, null>, { box: string; en: string; id: string; can: boolean }> = {
  ok: {
    box: "bg-sky-50 text-slate-800",
    en: "<b>Ngopi berdua</b><br>Valid today · 10:00–21:00 · this outlet may redeem.",
    id: "<b>Ngopi berdua</b><br>Berlaku hari ini · 10:00–21:00 · gerai ini boleh tebus.",
    can: true,
  },
  wrong: {
    box: "bg-rose-50 text-rose-800",
    en: "This voucher is not for this outlet.",
    id: "Voucher ini bukan untuk gerai ini.",
    can: false,
  },
  used: {
    box: "bg-rose-50 text-rose-800",
    en: "This voucher was already used or refunded.",
    id: "Voucher ini sudah dipakai atau di-refund.",
    can: false,
  },
  time: {
    box: "bg-amber-50 text-amber-900",
    en: "This voucher is outside its valid time.",
    id: "Di luar jam berlaku.",
    can: false,
  },
};

export function TikTokGoPublicDemo({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const [demo, setDemo] = useState<Demo>(null);
  const [done, setDone] = useState(false);
  const res = demo ? RESULT[demo] : null;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2a9bb8]">{t.kicker}</p>
        <h1 className="mt-3 text-[1.85rem] font-medium leading-[1.12] tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          {t.title}
        </h1>
        <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-[var(--ink)]/55">{t.lede}</p>
      </header>

      <section className="an-card p-5">
        <h2 className="text-sm font-semibold">{t.connect}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-slate-600">
          <li>{t.s1}</li>
          <li>{t.s2}</li>
          <li>{t.s3}</li>
          <li>{t.s4}</li>
          <li>{t.s5}</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/login" className="an-btn-primary text-sm">
            {t.login}
          </Link>
          <Link href="/settings/chat-apps" className="an-btn-ghost text-sm">
            {t.connectDesk}
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">{t.till}</h2>
        <div className="mx-auto w-full max-w-[360px] rounded-[32px] bg-[#1f1b1d] p-3 shadow-lg">
          <div className="min-h-[480px] overflow-hidden rounded-[24px] bg-[#faf8fc]">
            <div className="flex justify-between px-4 pt-3 text-[11px] font-semibold">
              <span>9:41</span>
              <span>Menteng · kasir</span>
            </div>
            <div className="px-4 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Loyalty · Scan</p>
              <p className="mt-1 text-sm font-semibold">Scan stamp QR or TikTok GO</p>
            </div>
            <div className="relative mx-4 mt-3 h-40 overflow-hidden rounded-2xl bg-[#12181c]">
              <div className="absolute inset-8 rounded-xl border-2 border-white/30" />
            </div>
            <div className="space-y-3 p-4">
              <div
                className={`rounded-2xl px-3 py-3 text-[13px] leading-relaxed ${
                  done ? "bg-emerald-50 text-emerald-900" : res ? res.box : "bg-white text-slate-600 ring-1 ring-slate-100"
                }`}
                dangerouslySetInnerHTML={{
                  __html: done ? t.done : res ? (locale === "id" ? res.id : res.en) : t.wait,
                }}
              />
              {res?.can && !done ? (
                <button type="button" className="an-btn-primary w-full text-sm" onClick={() => setDone(true)}>
                  {t.tebus}
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {(["ok", "wrong", "used", "time"] as const).map((k) => (
            <button
              key={k}
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold"
              onClick={() => {
                setDemo(k);
                setDone(false);
              }}
            >
              {t[k]}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
