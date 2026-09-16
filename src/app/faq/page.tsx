import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { PublicSiteShell } from "@/components/marketing/PublicSiteShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { localizeFaq } from "@/lib/faq";
import { getLocale } from "@/lib/i18n/get-locale";
import { LEGAL_CONTACT_EMAIL, LEGAL_PRODUCT } from "@/lib/legal/copy";
import { faqJsonLd } from "@/lib/seo/json-ld";
import { publicMetadata } from "@/lib/seo/site";
import { getSitePages } from "@/lib/site-pages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicMetadata({
  path: "/faq",
  title: `${LEGAL_PRODUCT} FAQ — WhatsApp CRM, stamps, Google Business Profile`,
  description: `Questions about ${LEGAL_PRODUCT}: WhatsApp CRM, Google Business Profile, Google Maps, outlet operations, revenue attribution from receipts, groups, and pricing.`,
});

export default async function FaqPage() {
  const locale = await getLocale();
  const { faqs } = await getSitePages();
  const items = localizeFaq(faqs, locale);
  const id = locale === "id";

  return (
    <PublicSiteShell>
      {items.length > 0 ? <JsonLd data={faqJsonLd(items)} /> : null}
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2a9bb8]">FAQ</p>
      <h1 className="mt-3 max-w-3xl text-[1.85rem] font-medium leading-[1.12] tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
        {id ? "Pertanyaan yang sering muncul." : "Questions we hear a lot."}
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--ink)]/55">
        {id
          ? "Jawaban singkat. Kalau belum ketemu, tulis ke kami — orang yang membaca."
          : "Short answers. If yours isn’t here, write to us — a person reads it."}
      </p>
      {items.length === 0 ? (
        <p className="mt-10 text-sm text-[var(--ink)]/45">
          {id ? "FAQ belum diisi." : "FAQ is empty for now."}
        </p>
      ) : (
        <FaqAccordion items={items} />
      )}
      <p className="mt-10 text-[13px] text-[var(--ink)]/45">
        {id ? "Masih ada yang ditanyakan? " : "Still stuck? "}
        <Link href="/contact" className="font-semibold text-[var(--ink)] hover:text-[#2a9bb8]">
          {id ? "Hubungi kami" : "Contact us"}
        </Link>
        {" · "}
        <a className="hover:text-[var(--ink)]" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
          {LEGAL_CONTACT_EMAIL}
        </a>
      </p>
    </PublicSiteShell>
  );
}
