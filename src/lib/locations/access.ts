import { prisma } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth";
import { brandWhereForSession, canEnterAgency, canManageClient, isPlatformMode } from "@/lib/tenancy";

export type ClientLocationOpt = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  storeCount: number;
};

/** Resolve which client tenant IDs a session may access for locations. */
export async function listAccessibleClientTenants(session: SessionPayload) {
  return prisma.tenant.findMany({
    where: brandWhereForSession(session),
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, plan: true },
  });
}

export async function withStoreCounts<T extends { id: string }>(
  clients: T[]
): Promise<Array<T & { storeCount: number }>> {
  if (clients.length === 0) return [];
  const rows = await prisma.location.findMany({
    where: {
      tenantId: { in: clients.map((c) => c.id) },
      status: { not: "ARCHIVED" },
      kind: { not: "HQ" },
    },
    select: { tenantId: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.tenantId, (map.get(r.tenantId) || 0) + 1);
  return clients.map((c) => ({ ...c, storeCount: map.get(c.id) ?? 0 }));
}

export async function canAccessTenant(
  session: SessionPayload,
  tenantId: string
): Promise<boolean> {
  const t = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { id: true, type: true, agencyId: true },
  });
  if (!t) return false;
  if (t.type === "AGENCY") return canEnterAgency(session, t);
  return canManageClient(session, t);
}

export async function listAgenciesForPlatform(session: SessionPayload) {
  if (!isPlatformMode(session) && !session.isPlatformAdmin) return [];
  return prisma.tenant.findMany({
    where: { type: "AGENCY", status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      loginEnabled: true,
      status: true,
      createdAt: true,
      notes: true,
      contactEmail: true,
      _count: { select: { managedBrands: true } },
    },
  });
}

export function branchLocationId(session: SessionPayload): string | null {
  if (session.role === "BRANCH" && session.locationId) return session.locationId;
  return null;
}

export function locationScopeWhere(
  session: SessionPayload,
  tenantId: string
): { tenantId: string; id?: string } {
  const id = branchLocationId(session);
  return id ? { tenantId, id } : { tenantId };
}

export async function listStoreLocations(session: SessionPayload, tenantId: string) {
  const scope = locationScopeWhere(session, tenantId);
  return prisma.location.findMany({
    where: { ...scope, status: { not: "ARCHIVED" }, kind: { not: "HQ" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export function canUseLocation(session: SessionPayload, locationId: string | null | undefined): boolean {
  const locked = branchLocationId(session);
  if (!locked) return true;
  return Boolean(locationId && locationId === locked);
}

export async function getLocationForSession(
  session: SessionPayload,
  locationId: string
) {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: {
      tenant: { select: { id: true, name: true, slug: true, type: true } },
      mappings: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!location) return null;
  if (!(await canAccessTenant(session, location.tenantId))) return null;
  if (!canUseLocation(session, location.id)) return null;
  return location;
}
