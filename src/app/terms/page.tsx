import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/LegalArticle";
import { LegalShell } from "@/components/legal/LegalShell";
import { getLocale } from "@/lib/i18n/get-locale";
import { getLegalDoc } from "@/lib/legal/copy";
import { publicMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicMetadata({
  path: "/terms",
  title: "Terms of Service — AtlasNow",
  description:
    "Terms for using AtlasNow: B2B workspace, monthly invoice in advance, 30-day cancel notice, no cash refund of paid time. P2P Labs WhatsApp CRM and outlet operations.",
});

export default async function TermsPage() {
  const locale = await getLocale();
  const doc = getLegalDoc("terms", locale);
  return (
    <LegalShell title={doc.title}>
      <LegalArticle doc={doc} />
    </LegalShell>
  );
}
