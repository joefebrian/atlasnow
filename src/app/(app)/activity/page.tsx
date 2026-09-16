import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/get-locale";
import { PageHeader } from "@/components/ui";
import { listActivity } from "@/lib/activity-query";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { prisma } from "@/lib/db";

export default async function ActivityPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  const locale = await getLocale();
  const items = await listActivity(session, locale);
  await prisma.user.update({
    where: { id: session.userId },
    data: { noticeSeenAt: new Date() },
  });

  const id = locale === "id";
  return (
    <div className="an-section">
      <PageHeader
        eyebrow={id ? "Jejak" : "Log"}
        badge={id ? "Orang + sistem" : "People + system"}
        title={id ? "Log perubahan" : "Change log"}
        description={
          id
            ? "Siapa yang mengubah apa di workspace ini — termasuk Super Admin AtlasNow dan WhatsApp yang terputus."
            : "Who changed what in this workspace — including AtlasNow Super Admin and WhatsApp disconnects."
        }
      />
      <ActivityFeed items={items} locale={locale} />
    </div>
  );
}
