import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { listAccessibleClientTenants, withStoreCounts } from "@/lib/locations/access";
import { BackLink, PageHeader } from "@/components/ui";
import { LocationForm } from "@/components/locations/LocationForm";

type Props = { searchParams: Promise<{ tenantId?: string }> };

export default async function NewLocationPage({ searchParams }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const clients = await withStoreCounts(await listAccessibleClientTenants(session));
  const defaultTenantId =
    sp.tenantId && clients.some((c) => c.id === sp.tenantId)
      ? sp.tenantId
      : session.tenantType === "CLIENT"
        ? session.tenantId
        : clients[0]?.id;

  return (
    <div className="an-section mx-auto w-full max-w-3xl">
      <PageHeader
        back={<BackLink href="/locations">Back to outlets</BackLink>}
        eyebrow="Outlet"
        badge="New"
        title="Add outlet"
        description="Paste a Google Maps link to fill the address, then check it before saving."
      />
      <LocationForm
        clients={clients}
        defaultTenantId={defaultTenantId}
        isAgency={session.isAgencyStaff}
      />
    </div>
  );
}
