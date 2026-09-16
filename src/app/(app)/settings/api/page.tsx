import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { ApiConfigPanel } from "@/components/settings/ApiConfigPanel";
import { listIntegrationViews } from "@/lib/integrations/service";
import { getLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export default async function SettingsApiPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const t = getMessages(locale).settings;

  if (!session.isAgencyStaff && !session.isPlatformAdmin) {
    return (
      <ModulePlaceholder
        title={t.navApi}
        description={t.agencyOnly}
        fase="E0"
        bullets={[t.hubApiBody]}
      />
    );
  }

  const integrations = await listIntegrationViews();

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        badge={t.apiBadge}
        title={t.navApi}
        description={t.apiDescription}
      />
      <ApiConfigPanel initial={integrations} locale={locale} />
    </>
  );
}
