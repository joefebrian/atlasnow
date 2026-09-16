import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAgencySession, writeAudit } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { isLocationCapError } from "@/lib/locations/plan";
import { applyReadiness, assertExternalIdFree, createLocation } from "@/lib/locations/service";

const bodySchema = z.object({
  remoteId: z.string().min(1),
  /** Map to existing atlas location */
  locationId: z.string().optional(),
  /** Or create under this client then map */
  createUnderTenantId: z.string().optional(),
});

/**
 * Map a cached Google remote location → atlas_location_id (SourceMapping).
 * Optionally create a new Location under a client first.
 */
export async function POST(request: Request) {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const remote = await prisma.googleRemoteLocation.findUnique({
    where: { id: parsed.data.remoteId },
  });
  if (!remote) {
    return NextResponse.json({ error: "Remote location not found" }, { status: 404 });
  }

  let locationId = parsed.data.locationId;

  if (!locationId && parsed.data.createUnderTenantId) {
    if (!(await canAccessTenant(session, parsed.data.createUnderTenantId))) {
      return NextResponse.json({ error: "Forbidden tenant" }, { status: 403 });
    }
    try {
      const created = await createLocation({
        tenantId: parsed.data.createUnderTenantId,
        name: remote.title,
        code: remote.storeCode,
        addressLine1: remote.addressLine,
        city: remote.locality,
        region: remote.administrativeArea,
        postalCode: remote.postalCode,
        country: remote.regionCode || "ID",
        phone: remote.phone,
        website: remote.website,
      });
      locationId = created.id;
    } catch (e) {
      if (isLocationCapError(e)) {
        return NextResponse.json({ error: e.message, code: e.code }, { status: 403 });
      }
      throw e;
    }
  }

  if (!locationId) {
    return NextResponse.json(
      { error: "Provide locationId or createUnderTenantId" },
      { status: 400 }
    );
  }

  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: { tenant: { select: { id: true, name: true, type: true } } },
  });
  if (!location || location.tenant.type !== "CLIENT") {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }
  if (!(await canAccessTenant(session, location.tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clash = await assertExternalIdFree(
    "GOOGLE_BUSINESS_PROFILE",
    remote.externalId,
    locationId
  );
  if (clash) {
    return NextResponse.json(
      {
        error: "This Google location is already mapped",
        conflict: {
          name: clash.location.name,
          atlasLocationId: clash.location.atlasLocationId,
        },
      },
      { status: 409 }
    );
  }

  // Upsert mapping on this location for GBP
  const existingOnLoc = await prisma.sourceMapping.findFirst({
    where: {
      locationId,
      sourceType: "GOOGLE_BUSINESS_PROFILE",
      status: "ACTIVE",
    },
  });
  if (existingOnLoc && existingOnLoc.externalId !== remote.externalId) {
    await prisma.sourceMapping.update({
      where: { id: existingOnLoc.id },
      data: { status: "INACTIVE" },
    });
  }

  const mapping = await prisma.sourceMapping.upsert({
    where: {
      sourceType_externalId: {
        sourceType: "GOOGLE_BUSINESS_PROFILE",
        externalId: remote.externalId,
      },
    },
    create: {
      locationId,
      sourceType: "GOOGLE_BUSINESS_PROFILE",
      externalId: remote.externalId,
      externalLabel: remote.title,
      confidence: "HIGH",
      status: "ACTIVE",
      metaJson: JSON.stringify({ remoteId: remote.id, storeCode: remote.storeCode }),
    },
    update: {
      locationId,
      externalLabel: remote.title,
      status: "ACTIVE",
      confidence: "HIGH",
      metaJson: JSON.stringify({ remoteId: remote.id, storeCode: remote.storeCode }),
    },
  });

  await applyReadiness(locationId);

  await writeAudit({
    tenantId: location.tenantId,
    actorId: session.userId,
    action: "GOOGLE_MAP_LOCATION",
    objectType: "source_mapping",
    objectId: mapping.id,
    meta: {
      externalId: remote.externalId,
      locationId,
      atlasLocationId: location.atlasLocationId,
    },
  });

  const refreshed = await prisma.location.findUnique({
    where: { id: locationId },
    include: {
      tenant: { select: { name: true, slug: true } },
      mappings: { where: { status: "ACTIVE" } },
    },
  });

  return NextResponse.json({ mapping, location: refreshed });
}
