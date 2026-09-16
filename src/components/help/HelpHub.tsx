"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  searchHelp,
  tHelp,
} from "@/lib/help/articles";

export function HelpHub({ locale }: { locale: Locale }) {
  const id = locale === "id";
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchHelp(q, locale), [q, locale]);
  const searching = q.trim().length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-16">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2a9bb8]">
        {id ? "Bantuan AtlasNow" : "AtlasNow help"}
      </p>
      <h1 className="mt-3 max-w-3xl text-[1.85rem] font-medium leading-[1.12] tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
        {id ? "Cara kerja meja. Yang kami hadapi." : "How the desk works. What we face."}
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink)]/55">
        {id
          ? "Jawaban singkat, angka yang kami tanggung. Bukan bot. Kalau belum ketemu, tulis ke kami."
          : "Short answers, numbers we can stand behind. Not a bot. If it isn’t here, write to us."}
      </p>
      <label className="mt-8 block max-w-xl">
        <span className="sr-only">{id ? "Cari" : "Search"}</span>
        <input
          className="an-input w-full py-3 text-[15px]"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={id ? "Cari stamp, WhatsApp, TikTok GO…" : "Search stamps, WhatsApp, TikTok GO…"}
        />
      </label>

      {searching ? (
        <ul className="mt-8 space-y-3">
          {hits.length === 0 ? (
            <li className="text-sm text-[var(--ink)]/45">
              {id ? "Tidak ketemu. Tulis ke atlasnow.co/contact." : "Nothing matched. Write to atlasnow.co/contact."}
            </li>
          ) : (
            hits.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/help/${a.slug}`}
                  className="block rounded-2xl border border-black/[0.06] bg-white p-5 hover:shadow-[0_16px_40px_rgba(183,225,255,0.35)]"
                >
                  <h2 className="text-[17px] font-semibold text-[var(--ink)]">{tHelp(a.title, locale)}</h2>
                  <p className="mt-2 text-sm text-[var(--ink)]/55">{tHelp(a.summary, locale)}</p>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : (
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HELP_CATEGORIES.map((c) => {
            const n = HELP_ARTICLES.filter((a) => a.category === c.id).length;
            return (
              <Link
                key={c.id}
                href={`/help#${c.id}`}
                className="rounded-2xl border border-black/[0.06] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(183,225,255,0.35)]"
              >
                <h2 className="text-[16px] font-semibold text-[var(--ink)]">{tHelp(c.title, locale)}</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink)]/55">{tHelp(c.lede, locale)}</p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#2a9bb8]">
                  {n} {id ? "artikel" : n === 1 ? "article" : "articles"}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {!searching &&
        HELP_CATEGORIES.map((c) => (
          <section key={c.id} id={c.id} className="mt-14 scroll-mt-24">
            <h2 className="text-xl font-semibold text-[var(--ink)]">{tHelp(c.title, locale)}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {HELP_ARTICLES.filter((a) => a.category === c.id).map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/help/${a.slug}`}
                    className="block h-full rounded-2xl border border-black/[0.06] bg-white p-5 hover:bg-[#eef8ff]/50"
                  >
                    <h3 className="text-[15px] font-semibold text-[var(--ink)]">{tHelp(a.title, locale)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]/55">{tHelp(a.summary, locale)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
