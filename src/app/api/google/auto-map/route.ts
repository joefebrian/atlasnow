import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgencySession, writeAudit } from "@/lib/auth";
import { GOOGLE_PROVIDER } from "@/lib/google/config";
import { getAgencyTenant } from "@/lib/google/connector";
import { applyReadiness, assertExternalIdFree } from "@/lib/locations/service";

/**
 * Best-effort auto-map: match Google storeCode → Location.code (same string).
 * Agency only. Skips conflicts.
 */
export async function POST() {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  const agency = await getAgencyTenant();
  if (!agency) {
    return NextResponse.json({ error: "Agency tenant missing" }, { status: 500 });
  }

  const connector = await prisma.connector.findUnique({
    where: {
      tenantId_provider: { tenantId: agency.id, provider: GOOGLE_PROVIDER },
    },
  });
  if (!connector) {
    return NextResponse.json({ error: "Google not connected" }, { status: 400 });
  }

  const remotes = await prisma.googleRemoteLocation.findMany({
    where: { connectorId: connector.id, storeCode: { not: null } },
  });

  let mapped = 0;
  let skipped = 0;
  const details: { remote: string; result: string }[] = [];

  for (const remote of remotes) {
    if (!remote.storeCode) continue;

    const already = await prisma.sourceMapping.findFirst({
      where: {
        sourceType: "GOOGLE_BUSINESS_PROFILE",
        externalId: remote.externalId,
        status: "ACTIVE",
      },
    });
    if (already) {
      skipped++;
      details.push({ remote: remote.title, result: "already mapped" });
      continue;
    }

    const loc = await prisma.location.findFirst({
      where: {
        code: remote.storeCode,
        status: { not: "ARCHIVED" },
        tenant: { type: "CLIENT" },
      },
    });
    if (!loc) {
      skipped++;
      details.push({ remote: remote.title, result: `no location code ${remote.storeCode}` });
      continue;
    }

    const clash = await assertExternalIdFree(
      "GOOGLE_BUSINESS_PROFILE",
      remote.externalId,
      loc.id
    );
    if (clash) {
      skipped++;
      details.push({ remote: remote.title, result: "external id conflict" });
      continue;
    }

    await prisma.sourceMapping.create({
      data: {
        locationId: loc.id,
        sourceType: "GOOGLE_BUSINESS_PROFILE",
        externalId: remote.externalId,
        externalLabel: remote.title,
        confidence: "MEDIUM",
        status: "ACTIVE",
        metaJson: JSON.stringify({ auto: true, storeCode: remote.storeCode }),
      },
    });
    await applyReadiness(loc.id);
    mapped++;
    details.push({ remote: remote.title, result: `→ ${loc.name}` });
  }

  await writeAudit({
    tenantId: agency.id,
    actorId: session.userId,
    action: "GOOGLE_AUTO_MAP",
    objectType: "connector",
    objectId: connector.id,
    meta: { mapped, skipped },
  });

  return NextResponse.json({ mapped, skipped, details });
}
