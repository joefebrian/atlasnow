"use client";

import { useEffect, useState } from "react";

const SCENES = [
  {
    id: "loyalty",
    nav: "Loyalty",
    hint: "Stamp · top spender · birthday",
    badge: "Live",
    chipTitle: "Outlet 04",
    chipBody: "Loyalty · stamp after struk photo",
    stats: [
      ["Stamps ready", "12"],
      ["Member", "41"],
      ["Birthday 7d", "3"],
    ],
  },
  {
    id: "inbox",
    nav: "HQ inbox",
    hint: "Official WhatsApp",
    badge: "HQ",
    chipTitle: "HQ WhatsApp",
    chipBody: "Live agent · not a chatbot",
    stats: [
      ["Open", "8"],
      ["Replied", "14"],
      ["Opt-in", "41"],
    ],
  },
  {
    id: "till",
    nav: "Cashier",
    hint: "Photo → match",
    badge: "Cashier",
    chipTitle: "Struk photo",
    chipBody: "Match · Atlas can Approve",
    stats: [
      ["Matched", "9"],
      ["HQ queue", "2"],
      ["Redeemed", "4"],
    ],
  },
  {
    id: "reviews",
    nav: "Reviews",
    hint: "Person replies",
    badge: "Human",
    chipTitle: "1★ today",
    chipBody: "Draft in Atlas · a person sends it",
    stats: [
      ["Need reply", "3"],
      ["Drafted", "2"],
      ["Sent", "11"],
    ],
  },
  {
    id: "outlets",
    nav: "Outlets",
    hint: "Every branch",
    badge: "Mapped",
    chipTitle: "12 doors",
    chipBody: "One brand desk · every location",
    stats: [
      ["Outlets", "12"],
      ["Mapped", "12"],
      ["Need look", "1"],
    ],
  },
] as const;

function SceneArt({ id }: { id: (typeof SCENES)[number]["id"] }) {
  if (id === "inbox") {
    return (
      <div className="flex h-full flex-col justify-end gap-2 pb-14 sm:pb-16">
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-3 py-2 text-[12px] shadow-sm ring-1 ring-black/[0.04]">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#2a9bb8]">Customer</p>
          <p className="mt-0.5 text-[var(--ink)]">Hi, still open? Table for 2 tonight.</p>
        </div>
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[var(--ink)] px-3 py-2 text-[12px] text-white">
          <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">HQ · Live agent</p>
          <p className="mt-0.5">Yes — 19:30 at Outlet 04. We saved your name on the member card.</p>
        </div>
      </div>
    );
  }
  if (id === "till") {
    return (
      <div className="flex h-full items-center justify-center pb-10">
        <div className="w-full max-w-[16rem] rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.06]">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#2a9bb8]">Receipt</p>
          <p className="mt-1 font-mono text-[13px] text-[var(--ink)]">INV-2408-04</p>
          <p className="mt-0.5 text-[13px] text-[var(--ink)]/60">Rp 185.000</p>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#c5f0c1]/70 px-3 py-2">
            <span className="text-[12px] font-semibold text-[var(--ink)]">MATCH</span>
            <span className="text-[11px] text-[var(--ink)]/55">1 stamp</span>
          </div>
        </div>
      </div>
    );
  }
  if (id === "reviews") {
    return (
      <div className="flex h-full items-center justify-center pb-10">
        <div className="w-full max-w-[18rem] rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.06]">
          <p className="text-[15px] tracking-widest text-[#ff8aa1]">★☆☆☆☆</p>
          <p className="mt-2 text-[13px] leading-snug text-[var(--ink)]">
            Waited 20 minutes. Nobody checked the chat.
          </p>
          <p className="mt-3 rounded-xl bg-[#eef8ff] px-3 py-2 text-[12px] text-[var(--ink)]/70">
            Draft: We’re sorry — HQ is on this. A person will send the reply, not a bot.
          </p>
        </div>
      </div>
    );
  }
  if (id === "loyalty") {
    return (
      <div className="flex h-full items-center justify-center pb-10">
        <div className="w-full max-w-[16rem] rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.06]">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#2a9bb8]">Stamp card</p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--ink)]">4 / 10 to tumbler</p>
          <div className="mt-3 flex gap-1.5">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={`h-2.5 flex-1 rounded-full ${i < 4 ? "bg-[#2a9bb8]" : "bg-slate-200"}`}
              />
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[var(--ink)]/50">Join is daftar. Stamp after struk photo.</p>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="absolute inset-x-8 top-10 h-px bg-[#b7e1ff]" />
      <div className="absolute inset-y-8 left-12 w-px bg-[#c5f0c1]/80" />
      {[
        { x: "22%", y: "38%", color: "#c5f0c1", cls: "an-pin-pulse" },
        { x: "58%", y: "28%", color: "#6fd6f6", cls: "an-pin-pulse-amber" },
        { x: "72%", y: "58%", color: "#ffd6b3", cls: "an-pin-pulse" },
      ].map((p) => (
        <span
          key={p.x}
          className={`absolute h-3 w-3 rounded-full ring-4 ring-white ${p.cls}`}
          style={{ left: p.x, top: p.y, background: p.color }}
        />
      ))}
    </>
  );
}

export function ProductPreview() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || paused) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % SCENES.length), 3800);
    return () => window.clearInterval(t);
  }, [paused]);

  const scene = SCENES[i];

  return (
    <div
      className="relative mx-auto w-full max-w-5xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute -inset-3 rounded-[2rem] bg-[#b7e1ff]/40 blur-2xl sm:-inset-8 sm:blur-3xl" />
      <div className="relative overflow-hidden rounded-[1.15rem] border border-black/[0.06] bg-white shadow-[0_24px_48px_rgba(183,225,255,0.4)] sm:rounded-[1.4rem] sm:shadow-[0_40px_80px_rgba(183,225,255,0.45)]">
        <div className="flex items-center gap-2 border-b border-black/[0.04] px-3 py-2.5 sm:px-4 sm:py-3">
          <span className="h-2 w-2 rounded-full bg-[#ffc1d6] sm:h-2.5 sm:w-2.5" />
          <span className="h-2 w-2 rounded-full bg-[#ffd6b3] sm:h-2.5 sm:w-2.5" />
          <span className="h-2 w-2 rounded-full bg-[#c5f0c1] sm:h-2.5 sm:w-2.5" />
          <span className="ml-2 flex min-w-0 items-center gap-2 text-[11px] font-medium tracking-wide text-[var(--ink)] sm:ml-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/atlasnow_logo.png" alt="" className="h-4 w-4 object-contain" />
            AtlasNow
          </span>
          <span className="an-connected ml-auto shrink-0 rounded-full bg-[#eef8ff] px-2 py-0.5 text-[10px] font-semibold text-[#2a9bb8] ring-1 ring-[#b7e1ff]">
            {scene.badge}
          </span>
        </div>
        <div className="grid lg:grid-cols-[220px_1fr_240px]">
          <aside className="hidden space-y-1 border-r border-black/[0.04] p-3 lg:block">
            {SCENES.map((row, idx) => {
              const on = idx === i;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setI(idx)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] transition ${
                    on ? "bg-[var(--ink)] text-white" : "text-[var(--ink)]/55 hover:bg-slate-50"
                  }`}
                >
                  <div className="font-medium">{row.nav}</div>
                  <div className={`text-[10px] ${on ? "text-white/60" : "text-[var(--ink)]/40"}`}>
                    {row.hint}
                  </div>
                </button>
              );
            })}
          </aside>
          <div className="relative min-h-[220px] overflow-hidden bg-gradient-to-br from-[#eef8ff] to-[#f3eeff] p-4 sm:min-h-[280px]">
            <div key={scene.id} className="absolute inset-0 p-4 transition-opacity duration-500">
              <SceneArt id={scene.id} />
            </div>
            <div className="an-chip-nudge absolute bottom-3 left-3 rounded-2xl bg-white px-3 py-2 text-[12px] shadow-sm ring-1 ring-black/[0.04] sm:bottom-4 sm:left-4">
              <div className="font-semibold text-[var(--ink)]">{scene.chipTitle}</div>
              <div className="text-[10px] text-[#2a9bb8]">{scene.chipBody}</div>
            </div>
          </div>
          <aside className="grid grid-cols-3 gap-2 border-t border-black/[0.04] p-3 lg:flex lg:flex-col lg:space-y-2 lg:border-l lg:border-t-0">
            {scene.stats.map(([l, v]) => (
              <div key={l} className="rounded-xl bg-[#faf8fc] px-2.5 py-2 sm:px-3 sm:py-2.5">
                <div className="truncate text-[9px] font-bold uppercase tracking-wide text-[var(--ink)]/40 sm:text-[10px]">
                  {l}
                </div>
                <div className="text-base font-semibold tracking-tight text-[var(--ink)] sm:text-lg">{v}</div>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}
