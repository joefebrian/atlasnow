import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/get-locale";
import { PageHeader } from "@/components/ui";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { ErrorLogPanel } from "@/components/settings/ErrorLogPanel";

export default async function SettingsErrorsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  const locale = await getLocale();

  if (!session.isAgencyStaff) {
    return (
      <ModulePlaceholder
        title="Error log"
        description="Hanya staf agency yang melihat log ini."
        fase="E0"
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        badge="Errors only"
        title="Error log"
        description="Kalau ada yang rusak, muncul di sini — bahasa biasa. Copy lalu kirim ke Grok."
      />
      <ErrorLogPanel locale={locale} />
    </>
  );
}
