import type { Metadata } from "next";
import Link from "next/link";
import { PublicSiteShell } from "@/components/marketing/PublicSiteShell";
import { getLocale } from "@/lib/i18n/get-locale";
import { LEGAL_CONTACT_EMAIL, LEGAL_OPERATOR, LEGAL_OPERATOR_LINE, LEGAL_PRODUCT } from "@/lib/legal/copy";
import { landingCopy } from "@/lib/marketing/landing";
import { publicMetadata } from "@/lib/seo/site";
import { getLocalizedSitePages } from "@/lib/site-pages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicMetadata({
  path: "/about",
  title: `About ${LEGAL_PRODUCT} — WhatsApp CRM and outlet operations`,
  description: `${LEGAL_PRODUCT} is multi-location outlet operations: WhatsApp CRM, Google Business Profile, Google Maps, honest stamps, and revenue attribution from till receipts. A ${LEGAL_OPERATOR} product.`,
});

export default async function AboutPage() {
  const locale = await getLocale();
  const pages = await getLocalizedSitePages(locale);
  const t = landingCopy(locale);
  const id = locale === "id";
  const paragraphs = pages.aboutBody
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <PublicSiteShell wide>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2a9bb8]">
        {id ? "Tentang AtlasNow" : "About AtlasNow"}
      </p>
      <h1 className="mt-3 max-w-3xl text-[1.85rem] font-medium leading-[1.12] tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
        {pages.aboutHeadline}
      </h1>
      {paragraphs.map((p) => (
        <p key={p.slice(0, 48)} className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--ink)]/55">
          {p}
        </p>
      ))}

      <section className="mt-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2a9bb8]">
          {t.navProduct}
        </p>
        <h2 className="mt-3 text-2xl font-medium tracking-[-0.02em] text-[var(--ink)]">{t.productTitle}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {t.products.map((item) => (
            <article
              key={item.kicker}
              className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_0_rgba(31,27,29,0.04)] sm:p-6"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2a9bb8]">
                {item.kicker}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--ink)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]/55">{item.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 text-[13px] text-[var(--ink)]/45">
          {id
            ? "Post Google, iklan, dan to-do masih coming later. Inbox HQ, QR daftar, kasir foto struk, stamp / top spender / ultah, dan laporan loyalty bulanan sudah live. Tidak kami jual yang belum live."
            : "Google posts, ads, and to-do are coming later. HQ inbox, join QR, till with receipt photo, stamp / top spender / birthday, and the monthly loyalty report are live. We don’t sell the rest as live."}
        </p>
      </section>

      <section className="mt-14 rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_0_rgba(31,27,29,0.04)] sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2a9bb8]">
          {id ? "Developer" : "Developer"}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--ink)]">{t.labTitle}</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--ink)]/55">{t.labBody}</p>
        <p className="mt-4 text-[13px] text-[var(--ink)]/45">
          {LEGAL_OPERATOR_LINE} ·{" "}
          <a
            className="font-medium text-[#2a9bb8] underline decoration-[#2a9bb8]/30 underline-offset-4 hover:text-[var(--ink)]"
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
        </p>
      </section>

      <p className="mt-10">
        <Link href="/contact" className="an-btn-primary inline-flex px-5 py-2.5">
          {id ? "Hubungi kami" : "Contact us"}
        </Link>
      </p>
    </PublicSiteShell>
  );
}
