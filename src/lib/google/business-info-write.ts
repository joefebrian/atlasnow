import { prisma } from "@/lib/db";
import { getValidAccessToken } from "@/lib/google/oauth";
import {
  googleErrorMessage,
  googleFetch,
  toLocationResourceName,
} from "@/lib/google/http";
import { GOOGLE_PROVIDER } from "@/lib/google/config";
import { getAgencyTenant } from "@/lib/google/connector";
import { applyReadiness } from "@/lib/locations/service";

export type ProfilePushFields = {
  title?: boolean;
  phone?: boolean;
  website?: boolean;
  address?: boolean;
  storeCode?: boolean;
};

export type LocationProfile = {
  name: string;
  code: string | null;
  phone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
};

const DEFAULT_FIELDS: ProfilePushFields = {
  title: true,
  phone: true,
  website: true,
  address: true,
  storeCode: true,
};

export function buildGoogleLocationBody(
  profile: LocationProfile,
  fields: ProfilePushFields = DEFAULT_FIELDS
): { body: Record<string, unknown>; updateMask: string[] } {
  const body: Record<string, unknown> = {};
  const updateMask: string[] = [];

  if (fields.title && profile.name?.trim()) {
    body.title = profile.name.trim();
    updateMask.push("title");
  }
  if (fields.storeCode && profile.code?.trim()) {
    body.storeCode = profile.code.trim();
    updateMask.push("storeCode");
  }
  if (fields.phone && profile.phone?.trim()) {
    body.phoneNumbers = { primaryPhone: profile.phone.trim() };
    updateMask.push("phoneNumbers");
  }
  if (fields.website && profile.website?.trim()) {
    // Don't push google maps URLs as websiteUri — Google rejects some
    const w = profile.website.trim();
    if (!/google\.(com|co)|maps\.app\.goo/i.test(w)) {
      body.websiteUri = w;
      updateMask.push("websiteUri");
    }
  }
  if (fields.address && (profile.addressLine1 || profile.city)) {
    const lines = [profile.addressLine1, profile.addressLine2]
      .map((s) => s?.trim())
      .filter(Boolean) as string[];
    body.storefrontAddress = {
      regionCode: (profile.country || "ID").slice(0, 2).toUpperCase(),
      languageCode: "id",
      postalCode: profile.postalCode || undefined,
      administrativeArea: profile.region || undefined,
      locality: profile.city || undefined,
      addressLines: lines.length ? lines : undefined,
    };
    updateMask.push("storefrontAddress");
  }

  return { body, updateMask };
}

/**
 * Push Atlas location profile → Google Business Profile (Business Information API).
 * Requires LIVE connector + active GOOGLE_BUSINESS_PROFILE mapping.
 * MOCK mode updates local remote cache only (dev).
 */
export async function pushLocationProfileToGoogle(
  locationId: string,
  fields: ProfilePushFields = DEFAULT_FIELDS
): Promise<{
  mode: "LIVE" | "MOCK";
  externalId: string;
  updateMask: string[];
  googleResponse?: unknown;
}> {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: {
      mappings: {
        where: { sourceType: "GOOGLE_BUSINESS_PROFILE", status: "ACTIVE" },
      },
    },
  });
  if (!location) throw new Error("Location not found");

  const mapping = location.mappings[0];
  if (!mapping) {
    throw new Error(
      "No Google Business Profile mapping. Map this location on Data Health first."
    );
  }

  const agency = await getAgencyTenant();
  if (!agency) throw new Error("Agency tenant missing");

  const connector = await prisma.connector.findUnique({
    where: {
      tenantId_provider_accountKey: {
        tenantId: agency.id,
        provider: GOOGLE_PROVIDER,
        accountKey: "",
      },
    },
  });
  if (!connector || connector.status === "DISCONNECTED") {
    throw new Error("Google Business Profile not connected (Data Health)");
  }

  const profile: LocationProfile = {
    name: location.name,
    code: location.code,
    phone: location.phone,
    website: location.website,
    addressLine1: location.addressLine1,
    addressLine2: location.addressLine2,
    city: location.city,
    region: location.region,
    postalCode: location.postalCode,
    country: location.country,
  };

  const { body, updateMask } = buildGoogleLocationBody(profile, fields);
  if (updateMask.length === 0) {
    throw new Error("Nothing to push — fill name/phone/address/website first");
  }

  const run = await prisma.syncRun.create({
    data: {
      connectorId: connector.id,
      kind: "PUSH_LOCATION",
      status: "RUNNING",
      statsJson: JSON.stringify({
        locationId,
        externalId: mapping.externalId,
        updateMask,
      }),
    },
  });

  try {
    if (connector.mode === "MOCK") {
      // Dev: reflect into remote cache
      await prisma.googleRemoteLocation.updateMany({
        where: {
          connectorId: connector.id,
          externalId: mapping.externalId,
        },
        data: {
          title: profile.name,
          storeCode: profile.code,
          phone: profile.phone,
          website: profile.website,
          addressLine: profile.addressLine1,
          locality: profile.city,
          administrativeArea: profile.region,
          postalCode: profile.postalCode,
          regionCode: profile.country,
          lastSeenAt: new Date(),
        },
      });

      await prisma.sourceMapping.update({
        where: { id: mapping.id },
        data: {
          externalLabel: profile.name,
          metaJson: JSON.stringify({
            lastPushAt: new Date().toISOString(),
            mode: "MOCK",
            updateMask,
          }),
        },
      });

      await prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          statsJson: JSON.stringify({
            mode: "MOCK",
            locationId,
            updateMask,
          }),
        },
      });

      return {
        mode: "MOCK",
        externalId: mapping.externalId,
        updateMask,
      };
    }

    // LIVE write
    const token = await getValidAccessToken(connector.id);
    if (!token) throw new Error("No valid Google access token — reconnect OAuth");

    const resource = toLocationResourceName(mapping.externalId);
    const qs = new URLSearchParams({ updateMask: updateMask.join(",") });
    const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${resource}?${qs}`;

    const result = await googleFetch(url, token, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    if (!result.ok) {
      throw new Error(googleErrorMessage(result.json, result.status));
    }

    await prisma.sourceMapping.update({
      where: { id: mapping.id },
      data: {
        externalLabel: profile.name,
        metaJson: JSON.stringify({
          lastPushAt: new Date().toISOString(),
          mode: "LIVE",
          updateMask,
          resource,
        }),
      },
    });

    // Refresh remote cache row if present
    await prisma.googleRemoteLocation.updateMany({
      where: {
        connectorId: connector.id,
        externalId: mapping.externalId,
      },
      data: {
        title: profile.name,
        storeCode: profile.code,
        phone: profile.phone,
        website: profile.website,
        addressLine: profile.addressLine1,
        locality: profile.city,
        administrativeArea: profile.region,
        postalCode: profile.postalCode,
        regionCode: profile.country,
        lastSeenAt: new Date(),
      },
    });

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        statsJson: JSON.stringify({
          mode: "LIVE",
          locationId,
          updateMask,
          resource,
        }),
      },
    });

    await prisma.connector.update({
      where: { id: connector.id },
      data: { lastSyncAt: new Date(), lastError: null, status: "CONNECTED" },
    });

    return {
      mode: "LIVE",
      externalId: mapping.externalId,
      updateMask,
      googleResponse: result.json,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Push failed";
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "ERROR",
        finishedAt: new Date(),
        error: message,
      },
    });
    await prisma.connector.update({
      where: { id: connector.id },
      data: { lastError: message },
    });
    throw e;
  }
}

/**
 * Pull Google profile → update Atlas location fields (does not overwrite empty Google with blanks if missing).
 */
export async function pullLocationProfileFromGoogle(locationId: string): Promise<{
  mode: "LIVE" | "MOCK";
  updated: string[];
}> {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: {
      mappings: {
        where: { sourceType: "GOOGLE_BUSINESS_PROFILE", status: "ACTIVE" },
      },
    },
  });
  if (!location) throw new Error("Location not found");
  const mapping = location.mappings[0];
  if (!mapping) throw new Error("No Google Business Profile mapping");

  const agency = await getAgencyTenant();
  if (!agency) throw new Error("Agency tenant missing");
  const connector = await prisma.connector.findUnique({
    where: {
      tenantId_provider_accountKey: { tenantId: agency.id, provider: GOOGLE_PROVIDER, accountKey: "" },
    },
  });
  if (!connector || connector.status === "DISCONNECTED") {
    throw new Error("Google not connected");
  }

  let remote: {
    title?: string | null;
    storeCode?: string | null;
    phone?: string | null;
    website?: string | null;
    addressLine?: string | null;
    locality?: string | null;
    administrativeArea?: string | null;
    postalCode?: string | null;
    regionCode?: string | null;
  } | null = null;

  if (connector.mode === "MOCK") {
    remote = await prisma.googleRemoteLocation.findFirst({
      where: { connectorId: connector.id, externalId: mapping.externalId },
    });
  } else {
    const token = await getValidAccessToken(connector.id);
    if (!token) throw new Error("No valid Google access token");
    const resource = toLocationResourceName(mapping.externalId);
    const readMask =
      "name,title,storeCode,phoneNumbers,websiteUri,storefrontAddress";
    const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${resource}?readMask=${encodeURIComponent(readMask)}`;
    const result = await googleFetch(url, token);
    if (!result.ok) {
      throw new Error(googleErrorMessage(result.json, result.status));
    }
    const loc = result.json as {
      title?: string;
      storeCode?: string;
      phoneNumbers?: { primaryPhone?: string };
      websiteUri?: string;
      storefrontAddress?: {
        addressLines?: string[];
        locality?: string;
        administrativeArea?: string;
        postalCode?: string;
        regionCode?: string;
      };
    };
    remote = {
      title: loc.title,
      storeCode: loc.storeCode,
      phone: loc.phoneNumbers?.primaryPhone,
      website: loc.websiteUri,
      addressLine: loc.storefrontAddress?.addressLines?.join(", "),
      locality: loc.storefrontAddress?.locality,
      administrativeArea: loc.storefrontAddress?.administrativeArea,
      postalCode: loc.storefrontAddress?.postalCode,
      regionCode: loc.storefrontAddress?.regionCode,
    };
  }

  if (!remote) throw new Error("Could not load Google location");

  const updated: string[] = [];
  const data: Record<string, string | null> = {};
  if (remote.title) {
    data.name = remote.title;
    updated.push("name");
  }
  if (remote.storeCode) {
    data.code = remote.storeCode;
    updated.push("code");
  }
  if (remote.phone) {
    data.phone = remote.phone;
    updated.push("phone");
  }
  if (remote.website) {
    data.website = remote.website;
    updated.push("website");
  }
  if (remote.addressLine) {
    data.addressLine1 = remote.addressLine;
    updated.push("addressLine1");
  }
  if (remote.locality) {
    data.city = remote.locality;
    updated.push("city");
  }
  if (remote.administrativeArea) {
    data.region = remote.administrativeArea;
    updated.push("region");
  }
  if (remote.postalCode) {
    data.postalCode = remote.postalCode;
    updated.push("postalCode");
  }
  if (remote.regionCode) {
    data.country = remote.regionCode;
    updated.push("country");
  }

  if (updated.length) {
    await prisma.location.update({
      where: { id: locationId },
      data,
    });
    await applyReadiness(locationId);
  }

  return {
    mode: connector.mode === "MOCK" ? "MOCK" : "LIVE",
    updated,
  };
}
