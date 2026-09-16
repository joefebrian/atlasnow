import { redirect } from "next/navigation";
import { requirePlatformSession } from "@/lib/auth";
import { isPlatformMode } from "@/lib/tenancy";
import { getLocale } from "@/lib/i18n/get-locale";
import { PageHeader } from "@/components/ui";
import { HelpDesk } from "@/components/support/HelpDesk";

export default async function SupportPage() {
  const session = await requirePlatformSession();
  if (!session) redirect("/control-tower");
  if (!isPlatformMode(session)) redirect("/agencies");
  const locale = await getLocale();

  return (
    <div className="an-section">
      <PageHeader
        eyebrow="Platform"
        badge="Radit"
        title={locale === "id" ? "Help desk" : "Help desk"}
        description={
          locale === "id"
            ? "Support AtlasNow. Satu percakapan. Nama agen Radit. Bukan inbox WhatsApp merek."
            : "AtlasNow support. One conversation at a time. Agent name Radit. Not the brand WhatsApp inbox."
        }
      />
      <HelpDesk locale={locale} />
    </div>
  );
}
