"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TaglineDemand } from "@/components/marketing/TaglineDemand";
import type { Locale } from "@/lib/i18n/locale";
import {
  PITCH_ONE_DESK,
  PITCH_TAGLINE_A,
  pitchCopy,
  type PitchCopy,
  type PitchPain,
} from "@/lib/pitch/pitch-copy";

type Slide = {
  id: string;
  dark?: boolean;
  kicker: string;
  body: ReactNode;
};

function IconWrap({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${className || "bg-[#eef8ff] text-[#1f1b1d]"}`}
    >
      {children}
    </span>
  );
}

function PinIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zm0-9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}

function StarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="m12 3 2.6 6.4H21l-5.2 4 2 6.6L12 16.6 6.2 20l2-6.6L3 9.4h6.4L12 3z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 6h14v10H9l-4 3V6z" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" strokeLinecap="round" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="11" width="16" height="9" rx="1.5" />
      <path d="M12 7v13M4 11h16" strokeLinecap="round" />
      <path d="M12 7c0-2 1.2-3.5 3-3.5S18 5.5 16.5 7H12zm0 0c0-2-1.2-3.5-3-3.5S6 5.5 7.5 7H12z" />
    </svg>
  );
}

function StampIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="8" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="16" cy="12" r="1.4" strokeDasharray="2 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="m5 12 5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8z" strokeLinejoin="round" />
      <circle cx="12" cy="13.5" r="3.2" />
    </svg>
  );
}

function ChatScene({ label, bubbles }: { label: string; bubbles: { side: "left" | "right"; text: string }[] }) {
  const colors = ["bg-emerald-50 text-emerald-800", "bg-[var(--ink)] text-white", "bg-sky-50 text-sky-800"];
  return (
    <div className="space-y-2.5 rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#2a9bb8]">{label}</p>
      {bubbles.map((b, i) => (
        <div
          key={b.text}
          className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] font-medium ${
            b.side === "right" ? colors[1] : colors[i === 0 ? 0 : 2]
          } ${b.side === "right" ? "ml-auto" : ""}`}
          style={{ animation: `pitch-bubble 0.45s ease ${0.08 + i * 0.3}s both` }}
        >
          {b.text}
        </div>
      ))}
    </div>
  );
}

function TillScene({ label, match }: { label: string; match: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#2a9bb8]">{label}</p>
      <div className="relative mt-3 h-28 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200/80">
        <div className="absolute inset-x-8 top-4 rounded-sm bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-600 shadow-sm">
          TRX-9901
          <br />
          Rp 185.000
          <br />
          Tomang
        </div>
        <div
          className="absolute inset-x-0 h-8 bg-gradient-to-b from-[#6fd6f6]/0 via-[#6fd6f6]/50 to-[#6fd6f6]/0"
          style={{ animation: "pitch-scan 2.4s ease-in-out 0.4s infinite" }}
        />
      </div>
      <div
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-700 ring-1 ring-emerald-100"
        style={{ animation: "pitch-match 0.45s ease 0.9s both" }}
      >
        <CheckIcon /> {match}
      </div>
    </div>
  );
}

function LoyaltyScene({ t }: { t: PitchCopy["loyalty"] }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#2a9bb8]">{t.stampLabel}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <span
              key={n}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
                n <= 4 ? "bg-[var(--ink)] text-white" : "bg-[#eef8ff] text-slate-400"
              }`}
              style={n <= 4 ? { animation: `pitch-stamp 0.4s ease ${0.08 * n}s both` } : undefined}
            >
              {n}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-slate-600">{t.stampFoot}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80" style={{ animation: "pitch-rise 0.45s ease 0.35s both" }}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">{t.topTitle}</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{t.topBody}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80" style={{ animation: "pitch-rise 0.45s ease 0.5s both" }}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-rose-500">{t.bdayTitle}</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{t.bdayBody}</p>
        </div>
      </div>
    </div>
  );
}

function ReviewScene({ t }: { t: PitchCopy["reviews"] }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">{t.who}</p>
        <span className="flex items-center gap-1 text-rose-500">
          <StarIcon className="h-4 w-4" />
          <span className="text-xs font-bold">1★</span>
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-slate-600">{t.quote}</p>
      <div className="mt-4 space-y-2">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.botLabel}</p>
          <p className="text-[13px] text-slate-400 line-through">{t.bot}</p>
        </div>
        <div
          className="rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100"
          style={{ animation: "pitch-bubble 0.45s ease 0.2s both" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">{t.humanLabel}</p>
          <p className="text-[13px] leading-relaxed text-emerald-900">{t.human}</p>
        </div>
      </div>
    </div>
  );
}

function MapScene() {
  return (
    <div className="relative h-36 overflow-hidden rounded-2xl bg-gradient-to-br from-[#eef8ff] to-[#f3eeff] ring-1 ring-[#b7e1ff]/60">
      <div className="absolute inset-x-6 top-8 h-px bg-[#b7e1ff]" />
      <div className="absolute inset-x-10 top-16 h-px bg-[#c5f0c1]/80" />
      <div className="absolute inset-y-6 left-10 w-px bg-[#b7e1ff]" />
      {[
        { x: "20%", y: "34%", delay: "0s" },
        { x: "52%", y: "26%", delay: "0.28s" },
        { x: "70%", y: "56%", delay: "0.52s" },
      ].map((p) => (
        <div
          key={p.x}
          className="absolute text-[#2a9bb8]"
          style={{ left: p.x, top: p.y, animation: `pitch-pop 2.4s ease-in-out ${p.delay} infinite` }}
        >
          <span className="absolute -left-2 -top-2 h-8 w-8 rounded-full bg-[#6fd6f6]/40 [animation:pitch-pulse-ring_2s_ease-out_infinite]" />
          <PinIcon />
        </div>
      ))}
    </div>
  );
}

function ProblemWall({
  items,
  problem,
  hint,
}: {
  items: PitchPain[];
  problem: string;
  hint: string;
}) {
  const [sel, setSel] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setSel((n) => (n + 1) % items.length), 6500);
    return () => clearInterval(t);
  }, [paused, items.length]);

  const row = items[sel] ?? items[0];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[0.92fr_1.08fr]">
      <ol className="space-y-1.5">
        {items.map((p, i) => (
          <li key={p.title}>
            <button
              type="button"
              onClick={() => {
                setSel(i);
                setPaused(true);
              }}
              className={`w-full rounded-xl px-3.5 py-2.5 text-left transition ${
                i === sel
                  ? "bg-[var(--ink)] text-white shadow-sm"
                  : "bg-white text-slate-700 ring-1 ring-slate-200/80 hover:bg-slate-50"
              }`}
            >
              <span className="text-[13px] font-semibold leading-snug">{p.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div key={sel} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 sm:p-6" style={{ animation: "pitch-rise 0.4s ease both" }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-500">{problem}</p>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{row.pain}</p>
        <div className="mt-5 rounded-xl bg-[#eef8ff] px-4 py-3 ring-1 ring-[#b7e1ff]/70">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2a9bb8]">AtlasNow</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-slate-800">{row.solve}</p>
        </div>
        <p className="mt-4 text-[11px] text-slate-400">{hint}</p>
      </div>
    </div>
  );
}

function buildSlides(t: PitchCopy): Slide[] {
  const programIcons = [<StampIcon key="s" />, <StampIcon key="p" />, <GiftIcon key="g" />, <GiftIcon key="b" />];
  return [
    {
      id: "cover",
      kicker: "AtlasNow",
      body: (
        <div className="grid min-h-[66vh] items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <div className="flex items-center gap-3" style={{ animation: "pitch-rise 0.5s ease both" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/atlasnow_logo.png" alt="" className="h-14 w-14 object-contain" />
              <p className="text-[15px] font-medium tracking-tight text-[#1f1b1d]">AtlasNow</p>
            </div>
            <p
              className="mt-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2a9bb8]"
              style={{ animation: "pitch-rise 0.5s ease 0.08s both" }}
            >
              {t.productLine}
            </p>
            <h1
              className="mt-3 max-w-3xl text-[clamp(2.1rem,5.2vw,3.9rem)] font-medium leading-[1.05] tracking-[-0.03em] text-[#1f1b1d]"
              style={{ animation: "pitch-rise 0.55s ease 0.14s both" }}
            >
              {PITCH_TAGLINE_A}
              <span className="mt-1 block font-normal text-[#1f1b1d]/70">
                <TaglineDemand />
              </span>
            </h1>
            <p
              className="mt-6 max-w-xl text-[16px] leading-[1.55] text-[#1f1b1d]/55"
              style={{ animation: "pitch-rise 0.55s ease 0.22s both" }}
            >
              {PITCH_ONE_DESK} {t.coverLede}
            </p>
          </div>
          <div className="relative" style={{ animation: "pitch-rise 0.6s ease 0.2s both" }}>
            <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(183,225,255,0.7),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(217,198,247,0.45),transparent_50%)]" />
            <div className="relative">
              <MapScene />
              <div className="mt-3 grid grid-cols-3 gap-2">
                {t.chips.map((c, i) => (
                  <div
                    key={c.t}
                    className="rounded-xl bg-white/90 px-3 py-2 ring-1 ring-white"
                    style={{ animation: `pitch-rise 0.4s ease ${0.35 + i * 0.1}s both` }}
                  >
                    <p className="text-[12px] font-semibold text-slate-900">{c.t}</p>
                    <p className="text-[11px] text-slate-500">{c.b}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "who",
      kicker: t.who.kicker,
      body: (
        <div>
          <h2 className="max-w-3xl text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold tracking-tight text-slate-900">
            {t.who.title}
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-500">{t.who.lede}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {t.who.cards.map((c, i) => (
              <div
                key={c.t}
                className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80"
                style={{ animation: `pitch-rise 0.4s ease ${i * 0.1}s both` }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">{c.t}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{c.b}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "pains",
      kicker: t.pains.kicker,
      body: (
        <div>
          <h2 className="max-w-3xl text-[clamp(1.55rem,3.2vw,2.4rem)] font-semibold tracking-tight text-slate-900">
            {t.pains.title}
          </h2>
          <p className="mt-2 max-w-xl text-[14px] text-slate-500">{t.pains.lede}</p>
          <div className="mt-6">
            <ProblemWall items={t.pains.items} problem={t.pains.problem} hint={t.pains.hint} />
          </div>
        </div>
      ),
    },
    {
      id: "inbox",
      kicker: t.inbox.kicker,
      body: (
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2a9bb8]">{t.inbox.eyebrow}</p>
            <h2 className="mt-2 text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold tracking-tight text-slate-900">
              {t.inbox.title}
            </h2>
            <ul className="mt-6 space-y-3 text-[14px] text-slate-600">
              {t.inbox.bullets.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-0.5 text-emerald-600">
                    <CheckIcon />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <ChatScene label={t.inbox.chatLabel} bubbles={t.inbox.bubbles} />
        </div>
      ),
    },
    {
      id: "join-till",
      kicker: t.join.kicker,
      body: (
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2a9bb8]">{t.join.eyebrow}</p>
            <h2 className="mt-2 text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold tracking-tight text-slate-900">
              {t.join.title}
            </h2>
            <div className="mt-6 space-y-4">
              {t.join.steps.map((s, i) => (
                <div key={s.t} className="flex gap-3">
                  <IconWrap className={i === 1 ? "bg-[#eef8ff] text-[#2a9bb8]" : i === 2 ? "bg-emerald-50 text-emerald-700" : undefined}>
                    {i === 0 ? <PhoneIcon /> : i === 1 ? <CameraIcon /> : <StampIcon />}
                  </IconWrap>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{s.t}</p>
                    <p className="text-[13px] text-slate-500">{s.b}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <TillScene label={t.join.tillLabel} match={t.join.match} />
        </div>
      ),
    },
    {
      id: "loyalty",
      kicker: t.loyalty.kicker,
      body: (
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2a9bb8]">{t.loyalty.eyebrow}</p>
            <h2 className="mt-2 text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold tracking-tight text-slate-900">
              {t.loyalty.title}
            </h2>
            <div className="mt-6 space-y-3">
              {t.loyalty.programs.map((c, i) => (
                <div key={c.t} className="flex gap-3">
                  <IconWrap>{programIcons[i]}</IconWrap>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{c.t}</p>
                    <p className="text-[13px] leading-relaxed text-slate-500">{c.b}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-xl bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900 ring-1 ring-amber-100">
              {t.loyalty.note}
            </p>
          </div>
          <LoyaltyScene t={t.loyalty} />
        </div>
      ),
    },
    {
      id: "reviews-outlets",
      kicker: t.reviews.kicker,
      body: (
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2a9bb8]">{t.reviews.eyebrow}</p>
            <h2 className="mt-2 text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold tracking-tight text-slate-900">
              {t.reviews.title}
            </h2>
            <ul className="mt-6 space-y-3 text-[14px] text-slate-600">
              {t.reviews.bullets.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-0.5 text-emerald-600">
                    <CheckIcon />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <ReviewScene t={t.reviews} />
            <MapScene />
          </div>
        </div>
      ),
    },
    {
      id: "flow",
      kicker: t.flow.kicker,
      body: (
        <div>
          <h2 className="text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold tracking-tight text-slate-900">
            {t.flow.title}
          </h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {t.flow.steps.map((s, i) => (
              <div
                key={s.n}
                className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80"
                style={{ animation: `pitch-rise 0.4s ease ${i * 0.1}s both` }}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-sm font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mt-3 text-[15px] font-semibold text-slate-900">{s.t}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{s.b}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 rounded-2xl bg-[#eef8ff] px-5 py-3 text-[13.5px] text-slate-600 ring-1 ring-[#b7e1ff]/70">
            <strong className="text-slate-900">{t.flow.noteGroup}</strong>
            {t.flow.noteMid}
            <strong className="text-slate-900">{t.flow.noteStore}</strong>
            {t.flow.noteAfter}
          </p>
        </div>
      ),
    },
    {
      id: "honest",
      kicker: t.honest.kicker,
      body: (
        <div>
          <h2 className="text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold tracking-tight text-slate-900">
            {t.honest.title}
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 ring-1 ring-emerald-100">
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                <CheckIcon /> {t.honest.live}
              </p>
              <ul className="mt-4 space-y-2 text-[14px] text-slate-600">
                {t.honest.liveItems.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-0.5 text-emerald-500">
                      <CheckIcon />
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-6 ring-1 ring-amber-100">
              <p className="flex items-center gap-2 text-sm font-bold text-amber-700">
                <span className="animate-pulse">
                  <ClockIcon />
                </span>
                {t.honest.later}
              </p>
              <ul className="mt-4 space-y-2 text-[14px] text-slate-600">
                {t.honest.laterItems.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-0.5 text-amber-500">
                      <ClockIcon />
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "start",
      kicker: t.start.kicker,
      body: (
        <div>
          <h2 className="text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold tracking-tight text-slate-900">
            {t.start.title}
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] text-slate-500">{t.start.lede}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {t.start.cards.map((c, i) => (
              <div
                key={c.t}
                className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80"
                style={{ animation: `pitch-rise 0.4s ease ${i * 0.1}s both` }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">{c.badge}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{c.t}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">{c.b}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[13px] text-slate-500">{t.start.foot}</p>
        </div>
      ),
    },
    {
      id: "close",
      dark: true,
      kicker: "AtlasNow",
      body: (
        <div className="flex min-h-[62vh] flex-col justify-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7ee5d6]">{t.productLine}</p>
          <h2 className="mt-4 max-w-3xl text-[clamp(2rem,5vw,3.6rem)] font-semibold leading-[1.1] tracking-tight text-white">
            {PITCH_TAGLINE_A}
            <span className="block font-normal text-white/85">
              <TaglineDemand />
            </span>
          </h2>
          <p className="mt-5 max-w-xl text-base text-white/65">{t.closeLede}</p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="https://atlasnow.co"
              className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#1f1b1d]"
            >
              atlasnow.co
            </a>
            <a href="https://atlasnow.co/pricing" className="text-sm font-medium text-[#7ee5d6] hover:text-white">
              {t.pricing}
            </a>
            <a href="mailto:hello@atlasnow.co" className="text-sm font-medium text-[#7ee5d6] hover:text-white">
              hello@atlasnow.co
            </a>
          </div>
        </div>
      ),
    },
  ];
}

export function PitchDeck({ initialLocale = "en" }: { initialLocale?: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const t = pitchCopy(locale);
  const slides = buildSlides(t);
  const [i, setI] = useState(0);
  const last = slides.length - 1;
  const slide = slides[Math.min(i, last)];

  const go = useCallback(
    (n: number) => {
      setI(Math.max(0, Math.min(last, n)));
    },
    [last]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
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
      lang={locale}
      onTouchStart={(e) => setTouchX(e.changedTouches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        if (touchX == null) return;
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

      <header className="relative z-10 flex items-center gap-3 px-4 py-3 sm:px-8">
        <Link
          href="/control-tower"
          className={`text-[12px] font-semibold ${
            slide.dark ? "text-[#7ee5d6] hover:text-white" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          ← {t.back}
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
        <span className="ml-auto">
          <LanguageSwitcher locale={locale} tone={slide.dark ? "dark" : "light"} onLocaleChange={setLocale} />
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
            slide.dark
              ? "bg-white/10 text-[#7ee5d6] ring-white/15"
              : "bg-[#eef8ff] text-[#2a9bb8] ring-[#b7e1ff]/70"
          }`}
        >
          {t.badge}
        </span>
        <span className={`tabular-nums text-[12px] font-medium ${slide.dark ? "text-slate-400" : "text-slate-400"}`}>
          {String(i + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </span>
      </header>

      <div className={`relative z-10 h-0.5 w-full ${slide.dark ? "bg-white/10" : "bg-slate-200"}`}>
        <div
          className={`h-full transition-[width] duration-300 ${slide.dark ? "bg-[#7ee5d6]" : "bg-[var(--ink)]"}`}
          style={{ width: `${((i + 1) / slides.length) * 100}%` }}
        />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">
        <div key={`${locale}-${slide.id}`} className="flex-1 animate-[anfade_0.35s_ease]">
          {slide.body}
        </div>
      </main>

      <footer className="relative z-10 flex items-center gap-3 px-4 py-4 sm:px-8">
        <button
          type="button"
          onClick={() => go(i - 1)}
          disabled={i === 0}
          className={`rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-30 ${
            slide.dark
              ? "bg-white/10 text-white hover:bg-white/15"
              : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          {t.prev}
        </button>
        <button
          type="button"
          onClick={() => go(i + 1)}
          disabled={i === last}
          className={`rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-30 ${
            slide.dark ? "bg-white text-[#1f1b1d]" : "bg-[var(--ink)] text-white"
          }`}
        >
          {t.next}
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
                  ? slide.dark
                    ? "w-6 bg-[#7ee5d6]"
                    : "w-6 bg-[var(--ink)]"
                  : slide.dark
                    ? "w-1.5 bg-white/25 hover:bg-white/50"
                    : "w-1.5 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
        <p className={`ml-auto hidden text-[11px] sm:block ${slide.dark ? "text-slate-500" : "text-slate-400"}`}>
          {t.keys}
        </p>
      </footer>
    </div>
  );
}
