import { prisma } from "@/lib/db";
import { getValidAccessToken } from "@/lib/google/oauth";
import type { RemoteLocationInput } from "@/lib/google/mock-locations";
import {
  ACCOUNT_LIST_CACHE_TTL_MS,
  acquireGoogleRateSlot,
  backoffDelayMs,
  cacheDelete,
  cacheGet,
  cacheSet,
  humanizeGoogleQuotaError,
  isGoogleQuotaError,
  LOCATION_LIST_CACHE_TTL_MS,
  sleep,
  withSyncLock,
} from "@/lib/google/rate-limit";

export type RemoteLocation = RemoteLocationInput;

type GoogleAccount = { name: string; accountName?: string };

async function googleGet(
  url: string,
  accessToken: string,
  attempt = 0
): Promise<unknown> {
  await acquireGoogleRateSlot();

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err = json as { error?: { message?: string; status?: string } };
    const raw = err?.error?.message || `Google API ${res.status}`;
    if (isGoogleQuotaError(raw, res.status) && attempt < 5) {
      // Exponential backoff: 2s → 4s → 8s → 16s → 32s (+ jitter)
      await sleep(backoffDelayMs(attempt));
      return googleGet(url, accessToken, attempt + 1);
    }
    throw new Error(humanizeGoogleQuotaError(raw, res.status));
  }
  return json;
}

async function listGoogleAccounts(
  accessToken: string,
  connectorId: string
): Promise<GoogleAccount[]> {
  const cacheKey = `gbp:accounts:${connectorId}`;
  const cached = cacheGet<GoogleAccount[]>(cacheKey);
  if (cached?.length) return cached;

  const accountsJson = (await googleGet(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    accessToken
  )) as { accounts?: GoogleAccount[] };

  const accounts = accountsJson.accounts || [];
  if (accounts.length > 0) {
    cacheSet(cacheKey, accounts, ACCOUNT_LIST_CACHE_TTL_MS);
    // Persist account names on connector for debugging / offline hints
    try {
      const connector = await prisma.connector.findUnique({
        where: { id: connectorId },
        select: { metaJson: true },
      });
      const meta = connector?.metaJson ? JSON.parse(connector.metaJson) : {};
      await prisma.connector.update({
        where: { id: connectorId },
        data: {
          metaJson: JSON.stringify({
            ...meta,
            accounts: accounts.map((a) => ({
              name: a.name,
              accountName: a.accountName,
            })),
            accountsCachedAt: new Date().toISOString(),
          }),
        },
      });
    } catch {
      /* non-fatal */
    }
  }
  return accounts;
}

/**
 * List accounts then locations via Business Profile Account Management + Business Information APIs.
 * Rate-limited + backoff; account list is memory-cached.
 */
export async function fetchLiveGoogleLocations(
  accessToken: string,
  connectorId?: string
): Promise<RemoteLocation[]> {
  const cid = connectorId || "default";
  const accounts = await listGoogleAccounts(accessToken, cid);
  if (accounts.length === 0) {
    throw new Error(
      "No Google Business Profile accounts returned for this login. " +
        "Confirm the connected account is manager/owner on the business group (e.g. PJP Labs)."
    );
  }

  const out: RemoteLocation[] = [];

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    if (i > 0) await sleep(500);
    const accountName = acc.name;
    let pageToken: string | undefined;
    do {
      const qs = new URLSearchParams({
        pageSize: "100",
        readMask:
          "name,title,storeCode,phoneNumbers,websiteUri,storefrontAddress",
      });
      if (pageToken) qs.set("pageToken", pageToken);

      const locJson = (await googleGet(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?${qs}`,
        accessToken
      )) as {
        locations?: Array<{
          name: string;
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
        }>;
        nextPageToken?: string;
      };

      for (const loc of locJson.locations || []) {
        const addr = loc.storefrontAddress;
        out.push({
          externalId: loc.name,
          title: loc.title || loc.name,
          storeCode: loc.storeCode || null,
          addressLine: addr?.addressLines?.join(", ") || null,
          locality: addr?.locality || null,
          administrativeArea: addr?.administrativeArea || null,
          postalCode: addr?.postalCode || null,
          regionCode: addr?.regionCode || null,
          phone: loc.phoneNumbers?.primaryPhone || null,
          website: loc.websiteUri || null,
          raw: loc,
        });
      }
      pageToken = locJson.nextPageToken;
      if (pageToken) await sleep(400);
    } while (pageToken);
  }

  return out;
}

async function remotesFromDb(connectorId: string): Promise<RemoteLocation[]> {
  const rows = await prisma.googleRemoteLocation.findMany({
    where: { connectorId },
    orderBy: { title: "asc" },
  });
  return rows.map((r) => ({
    externalId: r.externalId,
    title: r.title,
    storeCode: r.storeCode,
    addressLine: r.addressLine,
    locality: r.locality,
    administrativeArea: r.administrativeArea,
    postalCode: r.postalCode,
    regionCode: r.regionCode,
    phone: r.phone,
    website: r.website,
    raw: r.rawJson ? JSON.parse(r.rawJson) : undefined,
  }));
}

function cacheIsFresh(lastSyncAt: Date | null | undefined, ttlMs: number): boolean {
  if (!lastSyncAt) return false;
  return Date.now() - lastSyncAt.getTime() < ttlMs;
}

export type SyncRemoteResult = {
  count: number;
  mode: "LIVE";
  runId: string;
  /** google = live API pull; cache = served from DB without Google call */
  source: "google" | "cache";
  cacheAgeSeconds?: number;
};

/**
 * Sync remote GBP locations into GoogleRemoteLocation cache.
 * - Default: if last sync is fresh (< 15 min) and rows exist → return DB cache (no Google calls).
 * - force: true → always hit Google (rate-limited + backoff).
 */
export async function syncRemoteLocations(
  connectorId: string,
  opts?: { forceMock?: boolean; force?: boolean }
): Promise<SyncRemoteResult> {
  return withSyncLock(connectorId, () => syncRemoteLocationsInner(connectorId, opts));
}

async function syncRemoteLocationsInner(
  connectorId: string,
  opts?: { forceMock?: boolean; force?: boolean }
): Promise<SyncRemoteResult> {
  const connector = await prisma.connector.findUnique({ where: { id: connectorId } });
  if (!connector) throw new Error("Connector not found");

  if (connector.mode === "MOCK" || opts?.forceMock) {
    throw new Error(
      "Mock Google sync is disabled. Disconnect the mock connector and Connect Google (live OAuth) on Data Health."
    );
  }

  const force = Boolean(opts?.force);
  const existingCount = await prisma.googleRemoteLocation.count({
    where: { connectorId },
  });

  // Serve DB cache — avoids Account Management RPM hits on every click
  if (
    !force &&
    existingCount > 0 &&
    cacheIsFresh(connector.lastSyncAt, LOCATION_LIST_CACHE_TTL_MS)
  ) {
    const age = connector.lastSyncAt
      ? Math.round((Date.now() - connector.lastSyncAt.getTime()) / 1000)
      : undefined;
    const run = await prisma.syncRun.create({
      data: {
        connectorId,
        kind: "LIST_LOCATIONS_CACHE",
        status: "SUCCESS",
        finishedAt: new Date(),
        statsJson: JSON.stringify({
          count: existingCount,
          mode: "LIVE",
          source: "cache",
          cacheAgeSeconds: age,
        }),
      },
    });
    return {
      count: existingCount,
      mode: "LIVE",
      runId: run.id,
      source: "cache",
      cacheAgeSeconds: age,
    };
  }

  const run = await prisma.syncRun.create({
    data: {
      connectorId,
      kind: "LIST_LOCATIONS",
      status: "RUNNING",
    },
  });

  try {
    const mode = "LIVE" as const;
    const token = await getValidAccessToken(connectorId);
    if (!token || token === "mock-access-token") {
      throw new Error(
        "No valid Google access token. Connect Google with a live agency account."
      );
    }

    // Bust short-lived account memory cache on force
    if (force) {
      cacheDelete(`gbp:accounts:${connectorId}`);
    }

    const remotes = await fetchLiveGoogleLocations(token, connectorId);

    const seen = new Set<string>();
    for (const r of remotes) {
      seen.add(r.externalId);
      await prisma.googleRemoteLocation.upsert({
        where: {
          connectorId_externalId: {
            connectorId,
            externalId: r.externalId,
          },
        },
        create: {
          connectorId,
          externalId: r.externalId,
          title: r.title,
          storeCode: r.storeCode,
          addressLine: r.addressLine,
          locality: r.locality,
          administrativeArea: r.administrativeArea,
          postalCode: r.postalCode,
          regionCode: r.regionCode,
          phone: r.phone,
          website: r.website,
          rawJson: r.raw ? JSON.stringify(r.raw) : null,
          lastSeenAt: new Date(),
        },
        update: {
          title: r.title,
          storeCode: r.storeCode,
          addressLine: r.addressLine,
          locality: r.locality,
          administrativeArea: r.administrativeArea,
          postalCode: r.postalCode,
          regionCode: r.regionCode,
          phone: r.phone,
          website: r.website,
          rawJson: r.raw ? JSON.stringify(r.raw) : null,
          lastSeenAt: new Date(),
        },
      });
    }

    const stale = await prisma.googleRemoteLocation.findMany({
      where: {
        connectorId,
        externalId: { notIn: seen.size ? [...seen] : ["__none__"] },
      },
      select: { id: true },
    });
    if (stale.length > 0) {
      await prisma.googleRemoteLocation.deleteMany({
        where: { id: { in: stale.map((s) => s.id) } },
      });
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        statsJson: JSON.stringify({
          count: remotes.length,
          mode,
          source: "google",
        }),
      },
    });

    await prisma.connector.update({
      where: { id: connectorId },
      data: {
        status: "CONNECTED",
        mode,
        lastSyncAt: new Date(),
        lastError: null,
      },
    });

    return {
      count: remotes.length,
      mode,
      runId: run.id,
      source: "google",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";

    // On quota failure: if we already have cached remotes, recover with cache
    const cached = await remotesFromDb(connectorId);
    if (cached.length > 0 && isGoogleQuotaError(message)) {
      await prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          error: null,
          statsJson: JSON.stringify({
            count: cached.length,
            mode: "LIVE",
            source: "cache",
            note: "Served DB cache after Google quota error",
            googleError: message.slice(0, 300),
          }),
        },
      });
      await prisma.connector.update({
        where: { id: connectorId },
        data: {
          status: "CONNECTED",
          mode: "LIVE",
          lastError:
            "Google quota hit — showing last cached locations. Wait 1–2 min then Force refresh.",
        },
      });
      return {
        count: cached.length,
        mode: "LIVE",
        runId: run.id,
        source: "cache",
      };
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "ERROR",
        finishedAt: new Date(),
        error: message,
      },
    });
    await prisma.connector.update({
      where: { id: connectorId },
      data: {
        status: "CONNECTED",
        mode: "LIVE",
        lastError: message,
      },
    });
    throw e;
  }
}
