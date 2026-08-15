import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { ConversationsInbox } from "@/components/conversations/ConversationsInbox";

export default async function ConversationsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  const locale = await getLocale();
  const t = getMessages(locale);

  if (!session.isAgencyStaff) {
    return (
      <ModulePlaceholder
        title={t.conversations.title}
        description={t.conversations.agencyOnly}
        fase="E3 · S9"
        bullets={[t.conversations.agencyOnly]}
      />
    );
  }

  return <ConversationsInbox locale={locale} />;
}
