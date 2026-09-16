import { prisma } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth";
import { canAccessTenant, canUseLocation, locationScopeWhere } from "@/lib/locations/access";
import { mapsUrlFromLocation, resolvePlaceIdFromHint } from "@/lib/locations/maps-url";
import {
  capturePublicUrl,
  captureWindowStart,
  coarseDevice,
  estimatedCaptureRate,
  formatEstimatedRate,
  isWritablePlaceId,
  mappingPlaceIdCandidates,
  newCaptureToken,
  parseCaptureUtm,
  placeIdFromInputs,
  writeReviewUrl,
} from "./capture";

export type OpenCaptureResult =
  | { kind: "redirect"; url: string }
  | { kind: "unmapped" }
  | { kind: "missing" };

export function placeIdFromLocationRow(loc: {
  website?: string | null;
  notes?: string | null;
  mappings: { sourceType: string; externalId: string; status: string; metaJson?: string | null }[];
}): string | null {
  return placeIdFromInputs({
    website: loc.website,
    notes: loc.notes,
    mappingExternalIds: mappingPlaceIdCandidates(loc.mappings),
  });
}

const mappingSelect = { sourceType: true, externalId: true, status: true, metaJson: true } as const;

export async function loadLocationForCapture(locationId: string) {
  return prisma.location.findFirst({
    where: { id: locationId, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      name: true,
      tenantId: true,
      website: true,
      notes: true,
      latitude: true,
      longitude: true,
      reviewCaptureToken: true,
      mappings: { select: mappingSelect },
    },
  });
}

async function persistWritablePlaceId(locationId: string, placeId: string, locName: string) {
  if (!isWritablePlaceId(placeId)) return;
  const existing = await prisma.sourceMapping.findUnique({
    where: { sourceType_externalId: { sourceType: "GOOGLE_MAPS", externalId: placeId } },
  });
  if (existing && existing.locationId !== locationId) return;
  const metaJson = JSON.stringify({ placeId, via: "review_capture" });
  if (existing) {
    await prisma.sourceMapping.update({
      where: { id: existing.id },
      data: { status: "ACTIVE", externalLabel: locName, metaJson },
    });
    return;
  }
  await prisma.sourceMapping.create({
    data: {
      locationId,
      sourceType: "GOOGLE_MAPS",
      externalId: placeId,
      externalLabel: locName,
      confidence: "MEDIUM",
      status: "ACTIVE",
      metaJson,
    },
  });
}

async function resolveWritablePlaceId(loc: {
  id: string;
  name: string;
  website?: string | null;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  mappings: { sourceType: string; externalId: string; status: string; metaJson?: string | null }[];
}): Promise<string | null> {
  const existing = placeIdFromLocationRow(loc);
  if (existing) return existing;
  const resolved = await resolvePlaceIdFromHint({
    mapsUrl: mapsUrlFromLocation({ website: loc.website, notes: loc.notes }),
    name: loc.name,
    latitude: loc.latitude,
    longitude: loc.longitude,
  });
  if (!isWritablePlaceId(resolved.placeId)) return null;
  await persistWritablePlaceId(loc.id, resolved.placeId!, loc.name);
  return resolved.placeId;
}

export async function ensureCaptureToken(locationId: string): Promise<{
  token: string | null;
  placeId: string | null;
  url: string | null;
}> {
  const loc = await loadLocationForCapture(locationId);
  if (!loc) return { token: null, placeId: null, url: null };
  const placeId = await resolveWritablePlaceId(loc);
  if (!placeId) return { token: loc.reviewCaptureToken, placeId: null, url: null };
  if (loc.reviewCaptureToken) {
    return { token: loc.reviewCaptureToken, placeId, url: capturePublicUrl(loc.reviewCaptureToken) };
  }
  for (let i = 0; i < 5; i++) {
    const token = newCaptureToken();
    try {
      await prisma.location.update({
        where: { id: loc.id },
        data: { reviewCaptureToken: token },
      });
      return { token, placeId, url: capturePublicUrl(token) };
    } catch {
      /* unique collision */
    }
  }
  throw new Error("Could not allocate a review link");
}

export async function openCapture(
  token: string,
  params: URLSearchParams,
  userAgent: string | null,
): Promise<OpenCaptureResult> {
  const loc = await prisma.location.findFirst({
    where: { reviewCaptureToken: token, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      website: true,
      notes: true,
      reviewCaptureToken: true,
      mappings: { select: mappingSelect },
    },
  });
  if (!loc) return { kind: "missing" };

  const utm = parseCaptureUtm(params);
  await prisma.reviewCaptureEvent.create({
    data: {
      locationId: loc.id,
      token,
      eventType: "opened",
      utmSource: utm.utmSource,
      utmMedium: utm.utmMedium,
      utmCampaign: utm.utmCampaign,
      utmContent: utm.utmContent,
      deviceType: coarseDevice(userAgent),
    },
  });

  const dest = writeReviewUrl(placeIdFromLocationRow(loc));
  if (!dest) return { kind: "unmapped" };
  return { kind: "redirect", url: dest };
}

export async function captureStatsForLocations(locationIds: string[], since = captureWindowStart()) {
  if (locationIds.length === 0) {
    return { intents: 0, newReviews: 0, estimatedRate: null as number | null };
  }
  const [intents, newReviews] = await Promise.all([
    prisma.reviewCaptureEvent.count({
      where: { locationId: { in: locationIds }, eventType: "opened", createdAt: { gte: since } },
    }),
    prisma.review.count({
      where: {
        locationId: { in: locationIds },
        createTime: { gte: since },
      },
    }),
  ]);
  return { intents, newReviews, estimatedRate: estimatedCaptureRate(intents, newReviews) };
}

export async function staffCaptureForLocation(session: SessionPayload, locationId: string) {
  const loc = await loadLocationForCapture(locationId);
  if (!loc) return null;
  if (!(await canAccessTenant(session, loc.tenantId))) return null;
  if (!canUseLocation(session, loc.id)) return null;
  const ensured = await ensureCaptureToken(loc.id);
  const stats = await captureStatsForLocations([loc.id]);
  return {
    locationId: loc.id,
    locationName: loc.name,
    tenantId: loc.tenantId,
    placeId: ensured.placeId,
    token: ensured.placeId ? ensured.token : null,
    url: ensured.placeId ? ensured.url : null,
    mapped: Boolean(ensured.placeId),
    intents: stats.intents,
    newReviews: stats.newReviews,
    estimatedRate: stats.estimatedRate,
    estimatedLabel: formatEstimatedRate(stats.estimatedRate),
    windowDays: 30,
  };
}

export async function staffCaptureSummary(session: SessionPayload, tenantId: string) {
  if (!(await canAccessTenant(session, tenantId))) return null;
  const locations = await prisma.location.findMany({
    where: {
      ...locationScopeWhere(session, tenantId),
      status: { not: "ARCHIVED" },
    },
    select: {
      id: true,
      name: true,
      website: true,
      notes: true,
      reviewCaptureToken: true,
      mappings: { select: mappingSelect },
    },
    orderBy: { name: "asc" },
  });
  const stats = await captureStatsForLocations(locations.map((l) => l.id));
  return {
    tenantId,
    intents: stats.intents,
    newReviews: stats.newReviews,
    estimatedRate: stats.estimatedRate,
    estimatedLabel: formatEstimatedRate(stats.estimatedRate),
    windowDays: 30,
    outlets: locations.map((l) => {
      const placeId = placeIdFromLocationRow(l);
      return {
        id: l.id,
        name: l.name,
        mapped: Boolean(placeId),
        url: placeId && l.reviewCaptureToken ? capturePublicUrl(l.reviewCaptureToken) : null,
      };
    }),
  };
}
