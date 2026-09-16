import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { listAccessibleClientTenants, listStoreLocations } from "@/lib/locations/access";
import { LoyaltyDesk } from "@/components/loyalty/LoyaltyDesk";
import { getLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

type Props = { searchParams: Promise<{ client?: string }> };

export default async function LoyaltyPage({ searchParams }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");
  const locale = await getLocale();
  const t = getMessages(locale).loyaltyDesk;
  const { client } = await searchParams;
  const clients = await listAccessibleClientTenants(session);
  const selectedClientId = session.isAgencyStaff
    ? clients.find((c) => c.id === client)?.id ?? null
    : session.tenantId;

  const locations = selectedClientId ? await listStoreLocations(session, selectedClientId) : [];

  return (
    <LoyaltyDesk
      clientId={selectedClientId}
      isAgency={session.isAgencyStaff}
      canReview={session.role !== "BRANCH"}
      locations={locations}
      brands={clients.map((c) => ({ id: c.id, name: c.name }))}
      t={t}
    />
  );
}
