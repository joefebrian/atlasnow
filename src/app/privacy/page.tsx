import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/LegalArticle";
import { LegalShell } from "@/components/legal/LegalShell";
import { getLocale } from "@/lib/i18n/get-locale";
import { getLegalDoc } from "@/lib/legal/copy";
import { publicMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicMetadata({
  path: "/privacy",
  title: "Privacy Policy — AtlasNow",
  description: "How AtlasNow and P2P Labs collect, use, and delete personal data, including WhatsApp CRM and Facebook Messenger.",
});

export default async function PrivacyPage() {
  const locale = await getLocale();
  const doc = getLegalDoc("privacy", locale);
  return (
    <LegalShell title={doc.title}>
      <LegalArticle doc={doc} />
    </LegalShell>
  );
}
