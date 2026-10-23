import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { canReadCommerce, canWriteCommerce } from "@/lib/commerce/access";
import { emptyConnection } from "@/lib/commerce/connection";
import { getCommerceConnection } from "@/lib/commerce/connection-service";
import {
  ensureCommerceReadiness,
  listCommerceProducts,
  listStoreLocations,
} from "@/lib/commerce/service";
import { canAccessTenant, listAccessibleClientTenants } from "@/lib/locations/access";
import { CommerceDesk } from "@/components/commerce/CommerceDesk";
import { homePathForNav } from "@/lib/nav-access";

type Props = { searchParams: Promise<{ client?: string; commerceError?: string }> };

export default async function CommercePage({ searchParams }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!canReadCommerce(session)) {
    redirect(homePathForNav({ role: session.role, mode: session.mode, isAgencyStaff: session.isAgencyStaff, isPlatformAdmin: session.isPlatformAdmin }));
  }

  const { client, commerceError } = await searchParams;
  const clients = await listAccessibleClientTenants(session);
  const selectedClientId = session.isAgencyStaff
    ? clients.find((row) => row.id === client)?.id ?? null
    : session.tenantId;

  const allowed = selectedClientId ? await canAccessTenant(session, selectedClientId) : false;
  const tenantId = allowed ? selectedClientId : null;
  const [products, locations, connection] = tenantId
    ? await Promise.all([
        listCommerceProducts(tenantId, "ALL"),
        listStoreLocations(tenantId),
        ensureCommerceReadiness(tenantId).then(() => getCommerceConnection(tenantId)),
      ])
    : [[], [], emptyConnection()];

  return (
    <CommerceDesk
      tenantId={tenantId}
      canWrite={canWriteCommerce(session)}
      isAgency={session.isAgencyStaff}
      brands={clients.map((row) => ({ id: row.id, name: row.name }))}
      products={products}
      locations={locations}
      connection={connection}
      commerceError={typeof commerceError === "string" ? commerceError.slice(0, 180) : ""}
    />
  );
}
