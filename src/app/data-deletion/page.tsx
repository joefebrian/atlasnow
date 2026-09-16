import type { Metadata } from "next";
import { DeletionRequestForm } from "@/components/legal/DeletionRequestForm";
import { LegalArticle } from "@/components/legal/LegalArticle";
import { LegalShell } from "@/components/legal/LegalShell";
import { getLocale } from "@/lib/i18n/get-locale";
import { getLegalDoc, LEGAL_CONTACT_EMAIL } from "@/lib/legal/copy";

import { publicMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicMetadata({
  path: "/data-deletion",
  title: "User data deletion — AtlasNow",
  description:
    "How to request deletion of AtlasNow account data and Facebook Messenger or WhatsApp CRM conversations stored for a client.",
});

export default async function DataDeletionPage() {
  const locale = await getLocale();
  const doc = getLegalDoc("deletion", locale);
  return (
    <LegalShell title={doc.title}>
      <LegalArticle doc={doc} />
      <p className="mt-8 text-sm text-[var(--ink)]/55">
        {locale === "id" ? "Atau email langsung" : "Or email"}{" "}
        <a
          className="font-medium text-[#2a9bb8] underline decoration-[#2a9bb8]/30 underline-offset-4 hover:text-[var(--ink)]"
          href={`mailto:${LEGAL_CONTACT_EMAIL}`}
        >
          {LEGAL_CONTACT_EMAIL}
        </a>
        .
      </p>
      <DeletionRequestForm locale={locale} />
    </LegalShell>
  );
}
