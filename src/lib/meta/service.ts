import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/google/crypto";
import {
  IG_WEBHOOK_FIELDS,
  listMetaPages,
  META_SCOPES,
  PAGE_WEBHOOK_FIELDS,
  subscribeInstagramToApp,
  subscribePageToApp,
  type MetaPageAsset,
} from "./oauth";

export const META_CONNECTOR = "META";

export type StoredMetaPage = {
  id: string;
  name: string;
  tokenEnc: string;
  instagram?: { id: string; username: string } | null;
};

export type PublicMetaPage = {
  id: string;
  name: string;
  instagram?: { id: string; username: string } | null;
};

export function parsePages(metaJson: string | null): StoredMetaPage[] {
  if (!metaJson) return [];
  try {
    const o = JSON.parse(metaJson) as { pages?: StoredMetaPage[] };
    return Array.isArray(o.pages) ? o.pages : [];
  } catch {
    return [];
  }
}

export function findMetaPageForThread(
  metaJson: string | null,
  provider: "FACEBOOK" | "INSTAGRAM",
  sessionId: string
): StoredMetaPage | null {
  const pages = parsePages(metaJson);
  if (provider === "FACEBOOK") return pages.find((p) => p.id === sessionId) || null;
  return pages.find((p) => p.instagram?.id === sessionId) || null;
}

export function publicPages(metaJson: string | null): PublicMetaPage[] {
  return parsePages(metaJson).map((p) => ({
    id: p.id,
    name: p.name,
    instagram: p.instagram || null,
  }));
}

export async function getMetaConnector(tenantId: string) {
  return prisma.connector.findUnique({
    where: { tenantId_provider: { tenantId, provider: META_CONNECTOR } },
  });
}

export async function upsertMetaConnector(
  tenantId: string,
  opts: {
    accessToken: string;
    expiresAt: Date | null;
    accountEmail?: string | null;
    pages: MetaPageAsset[];
  }
) {
  const pages: StoredMetaPage[] = opts.pages.map((p) => ({
    id: p.id,
    name: p.name,
    tokenEnc: encryptSecret(p.accessToken),
    instagram: p.instagram || null,
  }));

  for (const p of opts.pages) {
    try {
      await subscribePageToApp(p.id, p.accessToken);
    } catch (e) {
      console.error("[meta subscribe]", p.id, e);
    }
    if (p.instagram?.id) {
      try {
        await subscribeInstagramToApp(p.instagram.id, p.accessToken);
      } catch (e) {
        console.error("[meta ig subscribe]", p.instagram.id, e);
      }
    }
  }

  return prisma.connector.upsert({
    where: { tenantId_provider: { tenantId, provider: META_CONNECTOR } },
    create: {
      tenantId,
      provider: META_CONNECTOR,
      status: "CONNECTED",
      mode: "LIVE",
      displayName: pages.map((p) => p.name).join(", ") || "Meta",
      accountEmail: opts.accountEmail || null,
      accessTokenEnc: encryptSecret(opts.accessToken),
      tokenExpiresAt: opts.expiresAt,
      scopes: META_SCOPES,
      lastError: null,
      lastSyncAt: new Date(),
      metaJson: JSON.stringify({
        pages,
        webhook: {
          pageFields: PAGE_WEBHOOK_FIELDS,
          igFields: IG_WEBHOOK_FIELDS,
          subscribedAt: new Date().toISOString(),
        },
      }),
    },
    update: {
      status: "CONNECTED",
      mode: "LIVE",
      displayName: pages.map((p) => p.name).join(", ") || "Meta",
      accountEmail: opts.accountEmail || null,
      accessTokenEnc: encryptSecret(opts.accessToken),
      tokenExpiresAt: opts.expiresAt,
      lastError: null,
      lastSyncAt: new Date(),
      scopes: META_SCOPES,
      metaJson: JSON.stringify({
        pages,
        webhook: {
          pageFields: PAGE_WEBHOOK_FIELDS,
          igFields: IG_WEBHOOK_FIELDS,
          subscribedAt: new Date().toISOString(),
        },
      }),
    },
  });
}

export async function refreshMetaPages(tenantId: string) {
  const row = await getMetaConnector(tenantId);
  if (!row?.accessTokenEnc) throw new Error("Meta not connected");
  const userToken = decryptSecret(row.accessTokenEnc);
  const pages = await listMetaPages(userToken);
  return upsertMetaConnector(tenantId, {
    accessToken: userToken,
    expiresAt: row.tokenExpiresAt,
    accountEmail: row.accountEmail,
    pages,
  });
}

export async function disconnectMeta(tenantId: string) {
  const row = await getMetaConnector(tenantId);
  if (!row) return null;
  return prisma.connector.update({
    where: { id: row.id },
    data: {
      status: "DISCONNECTED",
      accessTokenEnc: null,
      lastError: null,
      metaJson: JSON.stringify({ pages: [] }),
    },
  });
}

export async function mapMetaAsset(opts: {
  tenantId: string;
  locationId: string;
  sourceType: "FACEBOOK" | "INSTAGRAM";
  externalId: string;
  label: string;
}) {
  const loc = await prisma.location.findFirst({
    where: { id: opts.locationId, tenantId: opts.tenantId, status: { not: "ARCHIVED" } },
  });
  if (!loc) throw new Error("Location not found for this client");

  const clash = await prisma.sourceMapping.findFirst({
    where: {
      sourceType: opts.sourceType,
      externalId: opts.externalId,
      status: "ACTIVE",
      locationId: { not: opts.locationId },
    },
    include: { location: { select: { name: true, atlasLocationId: true } } },
  });
  if (clash) {
    throw new Error(
      `Already mapped to ${clash.location.name} (${clash.location.atlasLocationId})`
    );
  }

  const existing = await prisma.sourceMapping.findFirst({
    where: {
      locationId: opts.locationId,
      sourceType: opts.sourceType,
      status: "ACTIVE",
    },
  });
  if (existing) {
    return prisma.sourceMapping.update({
      where: { id: existing.id },
      data: { externalId: opts.externalId, externalLabel: opts.label },
    });
  }
  return prisma.sourceMapping.create({
    data: {
      locationId: opts.locationId,
      sourceType: opts.sourceType,
      externalId: opts.externalId,
      externalLabel: opts.label,
      confidence: "HIGH",
      status: "ACTIVE",
    },
  });
}
