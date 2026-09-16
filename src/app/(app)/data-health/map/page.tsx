import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listAccessibleClientTenants } from "@/lib/locations/access";
import { GoogleMapPanel } from "@/components/google/GoogleMapPanel";

export default async function GoogleMapPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.isAgencyStaff) redirect("/settings/google");

  const clients = await listAccessibleClientTenants(session);
  const tenantIds = clients.map((c) => c.id);

  const locations =
    tenantIds.length === 0
      ? []
      : await prisma.location.findMany({
          where: {
            tenantId: { in: tenantIds },
            status: { not: "ARCHIVED" },
          },
          orderBy: [{ name: "asc" }],
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            atlasLocationId: true,
            readiness: true,
            tenant: { select: { id: true, name: true } },
          },
        });

  return <GoogleMapPanel locations={locations} clients={clients} />;
}
