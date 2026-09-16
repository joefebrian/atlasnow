import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/ContactForm";
import { PublicSiteShell } from "@/components/marketing/PublicSiteShell";
import { getLocale } from "@/lib/i18n/get-locale";
import { LEGAL_PRODUCT } from "@/lib/legal/copy";
import { publicMetadata } from "@/lib/seo/site";
import { getLocalizedSitePages } from "@/lib/site-pages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicMetadata({
  path: "/contact",
  title: `Contact ${LEGAL_PRODUCT}`,
  description: `Write to ${LEGAL_PRODUCT} about WhatsApp CRM, Google Business Profile, outlet operations, or pricing. A person reads it.`,
});

export default async function ContactPage() {
  const locale = await getLocale();
  const pages = await getLocalizedSitePages(locale);
  const id = locale === "id";

  return (
    <PublicSiteShell>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2a9bb8]">
        {id ? "Kontak" : "Contact"}
      </p>
      <h1 className="mt-3 text-[1.85rem] font-medium leading-[1.12] tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
        {pages.contactHeadline}
      </h1>
      <p className="mt-5 text-[15px] leading-relaxed text-[var(--ink)]/55">{pages.contactBody}</p>
      {pages.contactNote ? (
        <p className="mt-3 text-[13px] text-[var(--ink)]/45">{pages.contactNote}</p>
      ) : null}
      <ContactForm locale={locale} />
    </PublicSiteShell>
  );
}
