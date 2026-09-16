import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";
import { listAccessibleClientTenants } from "@/lib/locations/access";
import { BroadcastDesk } from "@/components/broadcast/BroadcastDesk";

type Props = { searchParams: Promise<{ client?: string }> };

export const metadata = { title: "WhatsApp broadcast · AtlasNow" };

export default async function BroadcastPage({ searchParams }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");
  const locale = await getLocale();
  const t = getMessages(locale).broadcast;
  const { client } = await searchParams;
  const brands = await listAccessibleClientTenants(session);
  const clientId = session.isAgencyStaff ? brands.find((b) => b.id === client)?.id ?? null : session.tenantId;

  return (
    <BroadcastDesk
      t={t}
      clientId={clientId}
      isGroup={session.isAgencyStaff}
      isPlatformAdmin={session.isPlatformAdmin}
      brands={brands.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
