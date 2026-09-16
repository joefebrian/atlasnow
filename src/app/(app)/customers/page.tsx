import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { listAccessibleClientTenants } from "@/lib/locations/access";
import { summarizeClientsForCustomers } from "@/lib/conversations/portfolio";
import { CustomerClientCards } from "@/components/customers/CustomerClientCards";
import { CustomersDirectory } from "@/components/customers/CustomersDirectory";

type Props = { searchParams: Promise<{ client?: string }> };

export default async function CustomersPage({ searchParams }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");
  const locale = await getLocale();
  const { client } = await searchParams;
  const clients = await listAccessibleClientTenants(session);

  const selectedClientId = session.isAgencyStaff
    ? clients.find((c) => c.id === client)?.id ?? null
    : session.tenantId;

  if (session.isAgencyStaff && !selectedClientId) {
    const tenantIds = clients.map((c) => c.id);
    const [locations, members, chats] = await Promise.all([
      tenantIds.length === 0
        ? Promise.resolve([])
        : prisma.location.findMany({
            where: { tenantId: { in: tenantIds }, status: { not: "ARCHIVED" } },
            select: { tenantId: true },
          }),
      tenantIds.length === 0
        ? Promise.resolve([])
        : prisma.loyaltyMember.findMany({
            where: { tenantId: { in: tenantIds } },
            select: { tenantId: true, phone: true },
          }),
      tenantIds.length === 0
        ? Promise.resolve([])
        : prisma.waContact.findMany({
            where: {
              tenantId: { in: tenantIds },
              AND: [{ phone: { not: null } }, { phone: { not: "" } }],
            },
            select: { tenantId: true, phone: true },
          }),
    ]);
    return (
      <CustomerClientCards
        locale={locale}
        summaries={summarizeClientsForCustomers(clients, locations, [...members, ...chats])}
      />
    );
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;

  return (
    <CustomersDirectory
      locale={locale}
      isAgencyStaff={session.isAgencyStaff}
      selectedClientId={selectedClientId}
      selectedClientName={selectedClient?.name ?? null}
    />
  );
}
