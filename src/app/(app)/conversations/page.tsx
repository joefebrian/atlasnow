import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { listAccessibleClientTenants } from "@/lib/locations/access";
import { summarizeClientsForConversations } from "@/lib/conversations/portfolio";
import { ConversationClientCards } from "@/components/conversations/ConversationClientCards";
import { ConversationsInbox } from "@/components/conversations/ConversationsInbox";

type Props = { searchParams: Promise<{ client?: string }> };

export default async function ConversationsPage({ searchParams }: Props) {
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
    const [locations, conversations] = await Promise.all([
      tenantIds.length === 0
        ? Promise.resolve([])
        : prisma.location.findMany({
            where: { tenantId: { in: tenantIds }, status: { not: "ARCHIVED" } },
            select: { tenantId: true },
          }),
      tenantIds.length === 0
        ? Promise.resolve([])
        : prisma.waConversation.findMany({
            where: { status: "OPEN", tenantId: { in: tenantIds } },
            select: {
              tenantId: true,
              lastInboundAt: true,
              lastOutboundAt: true,
            },
          }),
    ]);
    const summaries = summarizeClientsForConversations(
      clients,
      locations,
      conversations
    );
    return <ConversationClientCards locale={locale} summaries={summaries} />;
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;
  const locations = selectedClientId
    ? await prisma.location.findMany({
        where: { tenantId: selectedClientId, status: { not: "ARCHIVED" } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <ConversationsInbox
      locale={locale}
      selectedClientId={selectedClientId}
      selectedClientName={selectedClient?.name ?? null}
      isAgency={session.isAgencyStaff}
      locations={locations}
    />
  );
}
