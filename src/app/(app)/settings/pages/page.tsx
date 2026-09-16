import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { SitePagesForm } from "@/components/settings/SitePagesForm";
import { listRecentContactMessages } from "@/lib/contact/send";
import { getLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";
import { ensureSitePagesSeeded, getSitePages } from "@/lib/site-pages";

export default async function SettingsPagesPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const t = getMessages(locale).settings;

  if (!session.isAgencyStaff && !session.isPlatformAdmin) {
    return (
      <ModulePlaceholder
        title={t.navPages}
        description={t.agencyOnly}
        fase="E0"
        bullets={[t.hubPagesBody]}
      />
    );
  }

  await ensureSitePagesSeeded();
  const pages = await getSitePages();
  const messages = await listRecentContactMessages();

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.navPages}
        description={t.hubPagesBody}
      />
      <SitePagesForm
        initial={pages}
        messages={messages.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        }))}
        locale={locale}
      />
    </>
  );
}
