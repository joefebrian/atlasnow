import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { branchLocationId, listAccessibleClientTenants, withStoreCounts } from "@/lib/locations/access";
import { PageHeader } from "@/components/ui";
import { LocationsPortfolio } from "@/components/locations/LocationsPortfolio";

type Props = { searchParams: Promise<{ client?: string }> };

export default async function LocationsPage({ searchParams }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");

  const { client: clientParam } = await searchParams;
  const clients = await withStoreCounts(await listAccessibleClientTenants(session));
  const tenantIds = clients.map((c) => c.id);

  const selectedClientId = session.isAgencyStaff
    ? clients.find((c) => c.id === clientParam)?.id ?? null
    : session.tenantId;

  const selectedClient = selectedClientId
    ? clients.find((c) => c.id === selectedClientId) ?? null
    : null;

  const locations =
    tenantIds.length === 0
      ? []
      : await prisma.location.findMany({
          where: {
            tenantId: { in: tenantIds },
            status: { not: "ARCHIVED" },
            ...(branchLocationId(session) ? { id: branchLocationId(session)! } : {}),
          },
          orderBy: [{ city: "asc" }, { name: "asc" }],
          include: {
            tenant: { select: { id: true, name: true, slug: true } },
            mappings: {
              where: { status: "ACTIVE" },
              select: { id: true, sourceType: true, externalId: true, externalLabel: true },
            },
          },
        });

  const title = selectedClient ? selectedClient.name : "Locations";
  const description = session.isAgencyStaff
    ? selectedClient
      ? `Branches for ${selectedClient.name}. Open 360 to edit a store.`
      : "Pick a client to see their branches."
    : "Your store entities. Ready for Google Business Profile mapping.";

  return (
    <div className="an-section">
      <PageHeader
        eyebrow="Location Master · S2"
        badge="atlas_location_id"
        title={title}
        description={description}
      />
      <LocationsPortfolio
        initialLocations={locations}
        clients={clients}
        isAgency={session.isAgencyStaff}
        selectedClientId={selectedClientId}
      />
    </div>
  );
}
