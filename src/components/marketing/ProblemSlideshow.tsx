"use client";

import { useEffect, useState } from "react";

export function ProblemSlideshow({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string;
  title: string;
  items: { title: string; pain: string; solve: string }[];
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;

  useEffect(() => {
    if (paused || n < 2) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % n), 8000);
    return () => window.clearInterval(t);
  }, [paused, n]);

  const item = items[i];
  if (!item) return null;

  return (
    <section
      id="problems"
      className="an-brand-hairline bg-white/50 py-12 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2a9bb8]">{eyebrow}</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          {title}
        </h2>
        <ol className="sr-only">
          {items.map((p) => (
            <li key={`crawl-${p.title}`}>
              <h3>{p.title}</h3>
              <p>{p.pain}</p>
              <p>AtlasNow: {p.solve}</p>
            </li>
          ))}
        </ol>
        <div
          className="mt-8 sm:mt-12"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <article className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-6 sm:p-10">
            <p className="text-[12px] font-bold tracking-[0.2em] text-[#2a9bb8]">
              {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
            </p>
            <h3 className="mt-4 max-w-3xl text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)] sm:text-3xl">
              {item.title}
            </h3>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink)]/55 sm:text-[17px]">
              {item.pain}
            </p>
            <div className="mt-6 max-w-2xl rounded-2xl border border-[#2a9bb8]/20 bg-[#eef8ff] px-4 py-4 sm:px-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2a9bb8]">
                AtlasNow
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]/80 sm:text-[16px]">
                {item.solve}
              </p>
            </div>
          </article>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {items.map((p, idx) => (
              <button
                key={p.title}
                type="button"
                aria-label={p.title}
                onClick={() => setI(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === i ? "w-8 bg-[var(--ink)]" : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
