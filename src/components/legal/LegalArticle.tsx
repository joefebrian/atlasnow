import type { LegalDoc } from "@/lib/legal/copy";

export function LegalArticle({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <p className="mt-2 text-sm text-[var(--ink)]/40">{doc.updated}</p>
      <p className="mt-6 text-[15px] leading-relaxed text-[var(--ink)]/55">{doc.intro}</p>
      {doc.sections.map((section) => (
        <section key={section.heading} id={section.id} className="mt-10 scroll-mt-24">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--ink)]">{section.heading}</h2>
          {section.paragraphs.map((p) => (
            <p key={p.slice(0, 48)} className="mt-3 text-[15px] leading-relaxed text-[var(--ink)]/55">
              {p}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}
