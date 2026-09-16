"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { StampKnowledgeBody, StampKnowledgePanel } from "./StampKnowledge";
import {
  ApproveSampler,
  CardSampler,
  JoinSampler,
  KasirSampler,
  TrainingPlay,
} from "./TrainingPlay";
import type { Locale } from "@/lib/i18n/locale";
import { trainingCopy, type TrainingCopy } from "@/lib/pitch/training-copy";

type Slide = {
  id: string;
  dark?: boolean;
  kicker: string;
  body: ReactNode;
};

function Check() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M5 12.5 9.5 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function No() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function h2(children: ReactNode) {
  return (
    <h2 className="text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold tracking-tight text-slate-900">
      {children}
    </h2>
  );
}

function buildSlides(t: TrainingCopy, locale: Locale): Slide[] {
  return [
    {
      id: "cover",
      dark: true,
      kicker: t.cover.kicker,
      body: (
        <div className="flex min-h-0 flex-col justify-center py-4 sm:min-h-[62vh] sm:py-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#7ee5d6]">{t.cover.kicker}</p>
          <h1 className="mt-3 max-w-4xl text-[1.85rem] font-semibold leading-[1.12] tracking-tight text-white sm:mt-4 sm:text-[clamp(2.1rem,5vw,3.8rem)] sm:leading-[1.08]">
            {t.cover.title}
            <span className="block text-[#7ee5d6]">{t.cover.punch}</span>
          </h1>
          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-white/65">{t.cover.lede}</p>
          <p className="mt-8 text-[13px] text-white/40">{t.cover.time}</p>
        </div>
      ),
    },
    {
      id: "agenda",
      kicker: t.agenda.kicker,
      body: (
        <div>
          {h2(t.agenda.title)}
          <p className="mt-2 max-w-2xl text-[14px] text-slate-500">{t.agenda.lede}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">{t.agenda.onLabel}</p>
              <ul className="mt-4 space-y-3 text-[14px] text-slate-700">
                {t.agenda.on.map((line) => (
                  <li key={line} className="flex gap-3">
                    <Check /> {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
              <p className="text-[11px] font-bold uppercase tracking-wide text-rose-600">{t.agenda.offLabel}</p>
              <ul className="mt-4 space-y-3 text-[14px] text-slate-700">
                {t.agenda.off.map((line) => (
                  <li key={line} className="flex gap-3">
                    <No /> {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-5 text-[14px] text-slate-600">{t.agenda.next}</p>
        </div>
      ),
    },
    {
      id: "onboard",
      kicker: t.onboard.kicker,
      body: (
        <div>
          {h2(t.onboard.title)}
          <p className="mt-2 max-w-2xl text-[14px] text-slate-500">{t.onboard.lede}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {t.onboard.steps.map(([n, title, body]) => (
              <div key={n} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-sm font-bold text-white">
                  {n}
                </div>
                <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-[13px] text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "users",
      kicker: t.users.kicker,
      body: (
        <div>
          {h2(t.users.title)}
          <p className="mt-2 max-w-2xl text-[14px] text-slate-500">{t.users.lede}</p>
          <div className="mt-8 grid gap-3 lg:grid-cols-3">
            {t.users.cards.map((c) => (
              <div key={c.who} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2a9bb8]">{c.who}</p>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-700">{c.does}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "loyalty-open",
      kicker: t.loyaltyOpen.kicker,
      body: (
        <div className="flex min-h-0 flex-col justify-center py-4 sm:min-h-[50vh] sm:py-0">
          {h2(t.loyaltyOpen.title)}
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-slate-600">{t.loyaltyOpen.lede}</p>
        </div>
      ),
    },
    {
      id: "setup-path",
      kicker: t.setupPath.kicker,
      body: (
        <div>
          {h2(t.setupPath.title)}
          <p className="mt-2 max-w-2xl text-[14px] text-slate-500">{t.setupPath.lede}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {t.setupPath.tabs.map(([n, title, body]) => (
              <div key={n} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-sm font-bold text-white">
                  {n}
                </div>
                <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-[13px] text-slate-500">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[14px] text-slate-600">
            {t.setupPath.after}{" "}
            <Link href="/settings/loyalty" className="font-semibold text-[#2a9bb8] hover:text-slate-900">
              {t.setupPath.open}
            </Link>
          </p>
        </div>
      ),
    },
    {
      id: "setup-qr",
      kicker: t.setupQr.kicker,
      body: (
        <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-8">
          <div>
            {h2(t.setupQr.title)}
            <ul className="mt-6 space-y-3 text-[15px] text-slate-700">
              {t.setupQr.checks.map((line) => (
                <li key={line} className="flex gap-3">
                  <Check /> {line}
                </li>
              ))}
              <li className="flex gap-3">
                <No /> {t.setupQr.no}
              </li>
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200/80">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">{t.setupQr.sideKicker}</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">{t.setupQr.sideTitle}</p>
            <ol className="mt-4 list-decimal space-y-2 pl-4 text-[14px] text-slate-600">
              {t.setupQr.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: "setup-bday",
      kicker: t.setupBday.kicker,
      body: (
        <div>
          {h2(t.setupBday.title)}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200/80">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">{t.setupBday.onTitle}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{t.setupBday.onBody}</p>
            </div>
            <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200/80">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">{t.setupBday.waTitle}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{t.setupBday.waBody}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "setup-stamp",
      kicker: t.setupStamp.kicker,
      body: (
        <div>
          {h2(t.setupStamp.title)}
          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {t.setupStamp.cards.map(([title, body]) => (
              <div key={title} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
                <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 rounded-2xl bg-[#eef8ff] px-5 py-3 text-[14px] text-slate-600 ring-1 ring-[#b7e1ff]/70">
            {t.setupStamp.note}
          </p>
        </div>
      ),
    },
    {
      id: "setup-spender",
      kicker: t.setupSpender.kicker,
      body: (
        <div>
          {h2(t.setupSpender.title)}
          <p className="mt-2 max-w-2xl text-[14px] text-slate-500">{t.setupSpender.lede}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {t.setupSpender.cards.map(([title, body]) => (
              <div key={title} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
                <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[14px] text-slate-600">{t.setupSpender.after}</p>
        </div>
      ),
    },
    {
      id: "who",
      kicker: t.who.kicker,
      body: (
        <div>
          {h2(t.who.title)}
          <p className="mt-2 max-w-2xl text-[14px] text-slate-500">{t.who.lede}</p>
          <div className="mt-8 grid gap-3 lg:grid-cols-3">
            {t.who.cards.map((c) => (
              <div key={c.who} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2a9bb8]">{c.who}</p>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-700">{c.does}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "knowledge",
      kicker: t.knowledgeSlide.kicker,
      body: (
        <div>
          {h2(t.knowledgeSlide.title)}
          <p className="mt-2 max-w-2xl text-[14px] text-slate-500">{t.knowledgeSlide.lede}</p>
          <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 sm:p-6">
            <StampKnowledgeBody locale={locale} />
          </div>
        </div>
      ),
    },
    {
      id: "doors",
      kicker: t.doors.kicker,
      body: (
        <div>
          {h2(
            <>
              {t.doors.title}
              <span className="mt-1 block text-[#2a9bb8]">{t.doors.punch}</span>
            </>
          )}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl p-6" style={{ background: "linear-gradient(165deg, #ffd6b3 0%, #faf8fc 70%)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink)]">{t.doors.door1k}</p>
              <h3 className="mt-2 text-xl font-semibold text-[var(--ink)]">{t.doors.door1t}</h3>
              <ol className="mt-4 list-decimal space-y-2 pl-4 text-[14px] text-slate-700">
                {t.doors.door1.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl p-6" style={{ background: "linear-gradient(165deg, #b7e1ff 0%, #faf8fc 70%)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink)]">{t.doors.door2k}</p>
              <h3 className="mt-2 text-xl font-semibold text-[var(--ink)]">{t.doors.door2t}</h3>
              <ol className="mt-4 list-decimal space-y-2 pl-4 text-[14px] text-slate-700">
                {t.doors.door2.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </div>
          </div>
          <p className="mt-5 text-[14px] text-slate-600">{t.doors.miss}</p>
        </div>
      ),
    },
    {
      id: "two-qr",
      kicker: t.twoQr.kicker,
      body: (
        <div>
          {h2(t.twoQr.title)}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200/80">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">{t.twoQr.joinK}</p>
              <p className="mt-2 text-lg font-semibold">{t.twoQr.joinWhere}</p>
              <p className="mt-2 text-[14px] text-slate-600">{t.twoQr.joinBody}</p>
            </div>
            <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200/80">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">{t.twoQr.stampK}</p>
              <p className="mt-2 text-lg font-semibold">{t.twoQr.stampWhere}</p>
              <p className="mt-2 text-[14px] text-slate-600">{t.twoQr.stampBody}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "play",
      kicker: t.play.kicker,
      body: (
        <div>
          <h2 className="mb-6 text-[clamp(1.5rem,3vw,2.2rem)] font-semibold tracking-tight text-slate-900">
            {t.play.title}
          </h2>
          <TrainingPlay locale={locale} />
        </div>
      ),
    },
    {
      id: "rules",
      kicker: t.rules.kicker,
      body: (
        <div>
          {h2(t.rules.title)}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {t.rules.steps.map(([n, title, body]) => (
              <div key={n} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-sm font-bold text-white">
                  {n}
                </div>
                <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-[13px] text-slate-500">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 rounded-2xl bg-[#eef8ff] px-5 py-3 text-[14px] text-slate-600 ring-1 ring-[#b7e1ff]/70">
            {t.rules.note}
          </p>
        </div>
      ),
    },
    {
      id: "join",
      kicker: t.join.kicker,
      body: (
        <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-8">
          <div>
            {h2(t.join.title)}
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{t.join.lede}</p>
            <p className="mt-4 rounded-2xl bg-[var(--ink)] p-5 text-[16px] font-semibold leading-snug text-white">
              {t.join.quote}
            </p>
            <p className="mt-4 text-[13px] text-rose-700">{t.join.wrong}</p>
          </div>
          <JoinSampler locale={locale} />
        </div>
      ),
    },
    {
      id: "kasir",
      kicker: t.kasir.kicker,
      body: (
        <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-8">
          <div>
            {h2(t.kasir.title)}
            <ol className="mt-6 space-y-3 text-[15px] text-slate-700">
              {t.kasir.steps.map((line, i) => (
                <li key={line} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  {line}
                </li>
              ))}
            </ol>
          </div>
          <KasirSampler locale={locale} />
        </div>
      ),
    },
    {
      id: "receipt",
      kicker: t.receipt.kicker,
      body: (
        <div>
          {h2(t.receipt.title)}
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">{t.receipt.lede}</p>
          <ol className="mt-8 max-w-2xl space-y-3 text-[15px] text-slate-700">
            {t.receipt.steps.map((line, i) => (
              <li key={line} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>
          <p className="mt-6 rounded-2xl bg-[#eef8ff] px-5 py-3 text-[14px] text-slate-600 ring-1 ring-[#b7e1ff]/70">
            {t.receipt.note}
          </p>
        </div>
      ),
    },
    {
      id: "office",
      kicker: t.office.kicker,
      body: (
        <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-8">
          <div>
            {h2(t.office.title)}
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{t.office.lede}</p>
            <ul className="mt-5 space-y-2 text-[14px] text-slate-600">
              {t.office.checks.map((line) => (
                <li key={line} className="flex gap-2">
                  <Check /> {line}
                </li>
              ))}
            </ul>
          </div>
          <ApproveSampler locale={locale} />
        </div>
      ),
    },
    {
      id: "card",
      kicker: t.card.kicker,
      body: (
        <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-8">
          <div>
            {h2(t.card.title)}
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{t.card.lede}</p>
            <ul className="mt-4 space-y-3 text-[14px] text-slate-700">
              <li className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">{t.card.guest}</li>
              <li className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">{t.card.till}</li>
            </ul>
          </div>
          <CardSampler locale={locale} />
        </div>
      ),
    },
    {
      id: "gift",
      kicker: t.gift.kicker,
      body: (
        <div>
          {h2(t.gift.title)}
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {t.gift.cards.map(([title, body]) => (
              <div key={title} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
                <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[14px] text-slate-600">{t.gift.note}</p>
        </div>
      ),
    },
    {
      id: "dont",
      kicker: t.dont.kicker,
      body: (
        <div>
          {h2(t.dont.title)}
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {t.dont.items.map(([title, body]) => (
              <li key={title} className="flex gap-3 rounded-2xl bg-white px-5 py-4 ring-1 ring-slate-200/80">
                <No />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  <p className="mt-0.5 text-[13px] text-slate-500">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: "pocket",
      kicker: t.pocket.kicker,
      body: (
        <div>
          {h2(t.pocket.title)}
          <div className="mt-6 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200/80 sm:mt-8">
            <table className="w-full min-w-[32rem] text-left text-[13px]">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-3">{t.pocket.if}</th>
                  <th className="px-5 py-3">{t.pocket.do}</th>
                  <th className="px-5 py-3">{t.pocket.where}</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {t.pocket.rows.map(([a, b, c]) => (
                  <tr key={a} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-semibold">{a}</td>
                    <td className="px-5 py-3">{b}</td>
                    <td className="px-5 py-3 font-mono text-[12px] text-slate-500">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: "close",
      dark: true,
      kicker: t.close.kicker,
      body: (
        <div className="flex min-h-0 flex-col justify-center py-4 sm:min-h-[62vh] sm:py-0">
          <h2 className="max-w-3xl text-[clamp(2rem,5vw,3.4rem)] font-semibold leading-[1.1] tracking-tight text-white">
            {t.close.title}
            <span className="block text-[#7ee5d6]">{t.close.punch}</span>
          </h2>
          <p className="mt-5 max-w-xl text-[16px] text-white/65">{t.close.lede}</p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="/docs/AtlasNow-pelatihan.pptx"
              className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#1f1b1d]"
            >
              {t.close.pptx}
            </a>
            <Link href="/loyalty" className="text-sm font-medium text-[#7ee5d6] hover:text-white">
              {t.close.loyalty}
            </Link>
            <a href="mailto:hello@atlasnow.co" className="text-sm font-medium text-white/50 hover:text-white">
              hello@atlasnow.co
            </a>
          </div>
        </div>
      ),
    },
  ];
}

export function TrainingDeck({ locale: initial }: { locale: Locale }) {
  const [locale, setLocale] = useState<Locale>(initial);
  const t = trainingCopy(locale);
  const slides = useMemo(() => buildSlides(t, locale), [t, locale]);
  const [i, setI] = useState(0);
  const [knowledge, setKnowledge] = useState(false);
  const last = slides.length - 1;
  const slide = slides[i] ?? slides[0];

  const go = useCallback(
    (n: number) => {
      setI(Math.max(0, Math.min(last, n)));
    },
    [last]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const inDemo = Boolean(el?.closest("button, input, textarea, a, [data-demo]"));
      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !inDemo)) {
        e.preventDefault();
        go(i + 1);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(i - 1);
      }
      if (e.key === "Home") go(0);
      if (e.key === "End") go(last);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, i, last]);

  const [touchX, setTouchX] = useState<number | null>(null);

  return (
    <div
      className={`relative flex min-h-dvh flex-col overflow-hidden transition-colors duration-500 ${
        slide.dark ? "bg-[#1f1b1d] text-white" : "bg-[#faf8fc] text-[#1f1b1d]"
      }`}
      onTouchStart={(e) => setTouchX(e.changedTouches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        if (touchX == null) return;
        if ((e.target as HTMLElement | null)?.closest("[data-demo]")) {
          setTouchX(null);
          return;
        }
        const dx = e.changedTouches[0].clientX - touchX;
        if (dx < -50) go(i + 1);
        if (dx > 50) go(i - 1);
        setTouchX(null);
      }}
    >
      {slide.dark ? (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#6fd6f6]/20 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-[#d9c6f7]/20 blur-3xl" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-[#b7e1ff]/70 blur-3xl" />
          <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-[#c5f0c1]/50 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-[#d9c6f7]/40 blur-3xl" />
        </div>
      )}

      <header className="relative z-10 flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-8 sm:py-3">
        <Link
          href="/control-tower"
          className={`text-[12px] font-semibold ${
            slide.dark ? "text-[#7ee5d6] hover:text-white" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {t.chrome.back}
        </Link>
        <span
          className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
            slide.dark ? "text-[#7ee5d6]/80" : "text-[#2a9bb8]"
          }`}
        >
          AtlasNow
        </span>
        <span className={`hidden text-[11px] sm:inline ${slide.dark ? "text-slate-400" : "text-slate-400"}`}>
          {slide.kicker}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher locale={locale} tone={slide.dark ? "dark" : "light"} onLocaleChange={setLocale} />
          <button
            type="button"
            onClick={() => setKnowledge(true)}
            className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
              slide.dark ? "bg-white/10 text-[#7ee5d6] hover:bg-white/15" : "bg-[#eef8ff] text-[#2a9bb8]"
            }`}
          >
            {t.chrome.knowledge}
          </button>
          <a
            href="/docs/AtlasNow-pelatihan.pptx"
            className={`hidden text-[11px] font-semibold sm:inline ${
              slide.dark ? "text-[#7ee5d6] hover:text-white" : "text-[#2a9bb8] hover:text-slate-900"
            }`}
          >
            {t.chrome.pptx}
          </a>
          <span className={`tabular-nums text-[12px] font-medium ${slide.dark ? "text-slate-400" : "text-slate-400"}`}>
            {String(i + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
          </span>
        </div>
      </header>

      <div className={`relative z-10 h-0.5 w-full ${slide.dark ? "bg-white/10" : "bg-slate-200"}`}>
        <div
          className="h-full bg-[var(--ink)] transition-[width] duration-300"
          style={{ width: `${((i + 1) / slides.length) * 100}%` }}
        />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-y-auto px-3 py-4 sm:px-8 sm:py-8">
        <div key={`${slide.id}-${locale}`} className="flex-1 animate-[anfade_0.35s_ease]">
          {slide.body}
        </div>
      </main>

      <footer className="relative z-10 flex items-center gap-2 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-3 sm:px-8 sm:py-4">
        <button
          type="button"
          onClick={() => go(i - 1)}
          disabled={i === 0}
          className={`min-h-11 min-w-16 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-30 ${
            slide.dark
              ? "bg-white/10 text-white hover:bg-white/15"
              : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          {t.chrome.prev}
        </button>
        <button
          type="button"
          onClick={() => go(i + 1)}
          disabled={i === last}
          className={`min-h-11 min-w-16 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-30 ${
            slide.dark ? "bg-white text-[#1f1b1d]" : "bg-[var(--ink)] text-white"
          }`}
        >
          {t.chrome.next}
        </button>
        <div className="mx-auto hidden items-center gap-1.5 sm:flex">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              aria-label={s.kicker}
              onClick={() => go(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === i
                  ? "w-6 bg-[var(--ink)]"
                  : slide.dark
                    ? "w-1.5 bg-white/25 hover:bg-white/50"
                    : "w-1.5 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
        <p className={`ml-auto hidden text-[11px] sm:block ${slide.dark ? "text-slate-500" : "text-slate-400"}`}>
          {t.chrome.hint}
        </p>
      </footer>
      <StampKnowledgePanel open={knowledge} onClose={() => setKnowledge(false)} locale={locale} />
    </div>
  );
}
