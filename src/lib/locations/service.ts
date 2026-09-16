import { prisma } from "@/lib/db";
import { generateAtlasLocationId } from "@/lib/locations/ids";
import { freeOutletCapReached, LocationCapError } from "@/lib/locations/plan";
import { computeReadiness } from "@/lib/locations/readiness";

async function countStoreOutlets(tenantId: string, exceptId?: string) {
  return prisma.location.count({
    where: {
      tenantId,
      status: { not: "ARCHIVED" },
      kind: { not: "HQ" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
}

async function assertFreeOutletRoom(tenantId: string, kind: string | null | undefined, exceptId?: string) {
  if (kind === "HQ") return;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) return;
  const n = await countStoreOutlets(tenantId, exceptId);
  if (freeOutletCapReached(tenant.plan, n)) {
    throw new LocationCapError();
  }
}

export type LocationWriteInput = {
  tenantId: string;
  name: string;
  code?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  status?: string | null;
  notes?: string | null;
  waOutletPhone?: string | null;
  waOutletConfirmed?: boolean;
};

async function hasGoogleMapping(locationId: string) {
  const m = await prisma.sourceMapping.findFirst({
    where: {
      locationId,
      sourceType: "GOOGLE_BUSINESS_PROFILE",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  return Boolean(m);
}

export async function applyReadiness(locationId: string) {
  const loc = await prisma.location.findUnique({ where: { id: locationId } });
  if (!loc) return null;
  const mapped = await hasGoogleMapping(locationId);
  const { readiness, reasons } = computeReadiness({
    status: loc.status,
    name: loc.name,
    city: loc.city,
    addressLine1: loc.addressLine1,
    phone: loc.phone,
    hasActiveGoogleMapping: mapped,
  });
  return prisma.location.update({
    where: { id: locationId },
    data: {
      readiness,
      readinessJson: JSON.stringify(reasons),
    },
  });
}

export async function createLocation(input: LocationWriteInput) {
  await assertFreeOutletRoom(input.tenantId, "STORE");
  const atlasLocationId = generateAtlasLocationId();
  const status = input.status || "ACTIVE";
  const { readiness, reasons } = computeReadiness({
    status,
    name: input.name,
    city: input.city,
    addressLine1: input.addressLine1,
    phone: input.phone,
    hasActiveGoogleMapping: false,
  });

  const created = await prisma.location.create({
    data: {
      atlasLocationId,
      tenantId: input.tenantId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      addressLine1: input.addressLine1?.trim() || null,
      addressLine2: input.addressLine2?.trim() || null,
      city: input.city?.trim() || null,
      region: input.region?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      country: input.country?.trim() || "ID",
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      timezone: input.timezone?.trim() || "Asia/Jakarta",
      status,
      readiness,
      readinessJson: JSON.stringify(reasons),
      notes: input.notes?.trim() || null,
      archivedAt: status === "ARCHIVED" ? new Date() : null,
    },
  });

  return created;
}

export async function updateLocation(id: string, input: Partial<LocationWriteInput>) {
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) return null;

  // atlasLocationId is immutable — never accept updates to it
  const status = input.status ?? existing.status;
  if (existing.status === "ARCHIVED" && status !== "ARCHIVED") {
    await assertFreeOutletRoom(existing.tenantId, existing.kind, existing.id);
  }
  const next = {
    name: input.name?.trim() ?? existing.name,
    code: input.code === undefined ? existing.code : input.code?.trim() || null,
    addressLine1:
      input.addressLine1 === undefined
        ? existing.addressLine1
        : input.addressLine1?.trim() || null,
    addressLine2:
      input.addressLine2 === undefined
        ? existing.addressLine2
        : input.addressLine2?.trim() || null,
    city: input.city === undefined ? existing.city : input.city?.trim() || null,
    region:
      input.region === undefined ? existing.region : input.region?.trim() || null,
    postalCode:
      input.postalCode === undefined
        ? existing.postalCode
        : input.postalCode?.trim() || null,
    country:
      input.country === undefined
        ? existing.country
        : input.country?.trim() || "ID",
    phone: input.phone === undefined ? existing.phone : input.phone?.trim() || null,
    website:
      input.website === undefined ? existing.website : input.website?.trim() || null,
    latitude: input.latitude === undefined ? existing.latitude : input.latitude,
    longitude:
      input.longitude === undefined ? existing.longitude : input.longitude,
    timezone:
      input.timezone === undefined
        ? existing.timezone
        : input.timezone?.trim() || "Asia/Jakarta",
    status,
    notes: input.notes === undefined ? existing.notes : input.notes?.trim() || null,
    waOutletPhone:
      input.waOutletPhone === undefined
        ? existing.waOutletPhone
        : input.waOutletPhone?.trim() || null,
    waOutletConfirmed:
      input.waOutletConfirmed === undefined
        ? existing.waOutletConfirmed
        : input.waOutletConfirmed,
    archivedAt:
      status === "ARCHIVED"
        ? existing.archivedAt || new Date()
        : status !== "ARCHIVED"
          ? null
          : existing.archivedAt,
  };

  const mapped = await hasGoogleMapping(id);
  const { readiness, reasons } = computeReadiness({
    status: next.status,
    name: next.name,
    city: next.city,
    addressLine1: next.addressLine1,
    phone: next.phone,
    hasActiveGoogleMapping: mapped,
  });

  const updated = await prisma.location.update({
    where: { id },
    data: {
      ...next,
      readiness,
      readinessJson: JSON.stringify(reasons),
    },
  });

  return updated;
}

export async function assertExternalIdFree(
  sourceType: string,
  externalId: string,
  exceptLocationId?: string
) {
  const hit = await prisma.sourceMapping.findFirst({
    where: {
      sourceType,
      externalId,
      status: "ACTIVE",
      ...(exceptLocationId ? { locationId: { not: exceptLocationId } } : {}),
    },
    include: {
      location: { select: { id: true, name: true, atlasLocationId: true } },
    },
  });
  return hit;
}
