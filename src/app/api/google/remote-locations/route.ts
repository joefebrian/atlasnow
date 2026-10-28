import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgencySession } from "@/lib/auth";
import { GOOGLE_PROVIDER } from "@/lib/google/config";
import { getAgencyTenant } from "@/lib/google/connector";

export async function GET(request: Request) {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  const agency = await getAgencyTenant();
  if (!agency) {
    return NextResponse.json({ remotes: [], connector: null });
  }

  const connector = await prisma.connector.findUnique({
    where: {
      tenantId_provider_accountKey: { tenantId: agency.id, provider: GOOGLE_PROVIDER, accountKey: "" },
    },
  });
  if (!connector) {
    return NextResponse.json({ remotes: [], connector: null });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const unmappedOnly = url.searchParams.get("unmapped") === "1";

  const remotes = await prisma.googleRemoteLocation.findMany({
    where: {
      connectorId: connector.id,
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { storeCode: { contains: q } },
              { locality: { contains: q } },
              { externalId: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ locality: "asc" }, { title: "asc" }],
  });

  // Join mapping status
  const mappings = await prisma.sourceMapping.findMany({
    where: {
      sourceType: "GOOGLE_BUSINESS_PROFILE",
      status: "ACTIVE",
      externalId: { in: remotes.map((r) => r.externalId) },
    },
    include: {
      location: {
        select: {
          id: true,
          name: true,
          atlasLocationId: true,
          code: true,
          tenantId: true,
          tenant: { select: { name: true, slug: true } },
        },
      },
    },
  });
  const byExt = Object.fromEntries(mappings.map((m) => [m.externalId, m]));

  let rows = remotes.map((r) => ({
    ...r,
    mapping: byExt[r.externalId]
      ? {
          locationId: byExt[r.externalId].location.id,
          locationName: byExt[r.externalId].location.name,
          atlasLocationId: byExt[r.externalId].location.atlasLocationId,
          code: byExt[r.externalId].location.code,
          clientName: byExt[r.externalId].location.tenant.name,
          clientSlug: byExt[r.externalId].location.tenant.slug,
        }
      : null,
  }));

  if (unmappedOnly) {
    rows = rows.filter((r) => !r.mapping);
  }

  return NextResponse.json({
    connector: {
      id: connector.id,
      status: connector.status,
      mode: connector.mode,
      accountEmail: connector.accountEmail,
      lastSyncAt: connector.lastSyncAt,
      lastError: connector.lastError,
      displayName: connector.displayName,
    },
    remotes: rows,
  });
}
