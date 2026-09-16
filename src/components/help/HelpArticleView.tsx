import Link from "next/link";
import type { Locale } from "@/lib/i18n/locale";
import {
  HELP_CATEGORIES,
  helpInCategory,
  tHelp,
  type HelpArticle,
} from "@/lib/help/articles";

export function HelpArticleView({ article, locale }: { article: HelpArticle; locale: Locale }) {
  const id = locale === "id";
  const cat = HELP_CATEGORIES.find((c) => c.id === article.category);
  const siblings = helpInCategory(article.category).filter((a) => a.slug !== article.slug);

  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-4 py-10 sm:px-8 sm:py-16">
      <aside className="hidden w-56 shrink-0 lg:block">
        <Link href="/help" className="text-[12px] font-semibold text-[#2a9bb8]">
          {id ? "← Semua bantuan" : "← All help"}
        </Link>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ink)]/40">
          {cat ? tHelp(cat.title, locale) : ""}
        </p>
        <nav className="mt-3 space-y-1 text-[13px]">
          {helpInCategory(article.category).map((a) => (
            <Link
              key={a.slug}
              href={`/help/${a.slug}`}
              className={`block rounded-lg px-2 py-1.5 ${
                a.slug === article.slug
                  ? "bg-[#eef8ff] font-semibold text-[var(--ink)]"
                  : "text-[var(--ink)]/55 hover:text-[var(--ink)]"
              }`}
            >
              {tHelp(a.title, locale)}
            </Link>
          ))}
        </nav>
      </aside>
      <article className="min-w-0 max-w-2xl flex-1">
        <Link href="/help" className="text-[12px] font-semibold text-[#2a9bb8] lg:hidden">
          {id ? "← Semua bantuan" : "← All help"}
        </Link>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[#2a9bb8]">
          {cat ? tHelp(cat.title, locale) : "Help"}
        </p>
        <h1 className="mt-3 text-[1.75rem] font-medium leading-[1.15] tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
          {tHelp(article.title, locale)}
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--ink)]/55">{tHelp(article.summary, locale)}</p>
        <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-[var(--ink)]/80">
          {article.body.map((p, i) => (
            <p key={i}>{tHelp(p, locale)}</p>
          ))}
        </div>
        {siblings.length > 0 && (
          <div className="mt-12 border-t border-black/[0.06] pt-8">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink)]/40">
              {id ? "Berdekatan" : "Related"}
            </p>
            <ul className="mt-3 space-y-2">
              {siblings.map((a) => (
                <li key={a.slug}>
                  <Link href={`/help/${a.slug}`} className="text-sm font-semibold text-[var(--ink)] hover:underline">
                    {tHelp(a.title, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-12 text-[13px] text-[var(--ink)]/45">
          {id ? "Belum ketemu? " : "Still stuck? "}
          <Link href="/contact" className="font-semibold text-[var(--ink)] underline">
            {id ? "Tulis ke kami." : "Write to us."}
          </Link>
        </p>
      </article>
    </div>
  );
}
