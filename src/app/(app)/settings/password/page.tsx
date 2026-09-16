import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PasswordSettings } from "@/components/settings/PasswordSettings";
import { getLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export default async function SettingsPasswordPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  const locale = await getLocale();
  const t = getMessages(locale).settings;

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.navPassword}
        description={t.navPasswordHint}
      />
      <PasswordSettings locale={locale} currentEmail={session.email} />
    </>
  );
}
