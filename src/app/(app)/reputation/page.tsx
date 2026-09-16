import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { listAccessibleClientTenants } from "@/lib/locations/access";
import { summarizeClientsForReviews } from "@/lib/conversations/portfolio";
import { ReviewClientCards } from "@/components/reviews/ReviewClientCards";
import { ReviewsInbox } from "@/components/reviews/ReviewsInbox";

type Props = { searchParams: Promise<{ client?: string }> };

export default async function ReputationPage({ searchParams }: Props) {
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
    const [locations, reviewRows] = await Promise.all([
      tenantIds.length === 0
        ? Promise.resolve([])
        : prisma.location.findMany({
            where: { tenantId: { in: tenantIds }, status: { not: "ARCHIVED" } },
            select: { tenantId: true },
          }),
      tenantIds.length === 0
        ? Promise.resolve([])
        : prisma.review.findMany({
            where: { location: { tenantId: { in: tenantIds } } },
            select: {
              replyComment: true,
              location: { select: { tenantId: true } },
            },
          }),
    ]);
    const summaries = summarizeClientsForReviews(
      clients,
      locations,
      reviewRows.map((r) => ({
        tenantId: r.location.tenantId,
        replied: Boolean(r.replyComment?.trim()),
      }))
    );
    return <ReviewClientCards locale={locale} summaries={summaries} />;
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
    <ReviewsInbox
      isAgencyStaff={session.isAgencyStaff}
      locale={locale}
      selectedClientId={selectedClientId}
      selectedClientName={selectedClient?.name ?? null}
      locations={locations}
    />
  );
}
