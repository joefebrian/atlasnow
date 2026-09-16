import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { listAccessibleClientTenants } from "@/lib/locations/access";
import { LoyaltySettingsForm } from "@/components/loyalty/LoyaltySettingsForm";

type Props = { searchParams: Promise<{ client?: string; tab?: string }> };

export default async function LoyaltySettingsPage({ searchParams }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");
  const { client, tab } = await searchParams;
  const clients = await listAccessibleClientTenants(session);
  const selectedClientId = session.isAgencyStaff
    ? clients.find((c) => c.id === client)?.id ?? null
    : session.tenantId;

  return (
    <LoyaltySettingsForm
      isAgency={session.isAgencyStaff}
      isPlatformAdmin={session.isPlatformAdmin}
      brands={clients.map((c) => ({ id: c.id, name: c.name }))}
      clientId={selectedClientId}
      initialTab={tab}
    />
  );
}
