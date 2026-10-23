import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/google/crypto";
import { resolvedMetaApp } from "@/lib/integrations/service";
import {
  emptyConnection,
  maskPhone,
  missingScopes,
  parseScopes,
  presentConnection,
  COMMERCE_META_SCOPES,
  type CommerceConnectionView,
  type ConnectionRecord,
} from "@/lib/commerce/connection";
import { decideCatalogSync, type CatalogItem, type SyncProduct } from "@/lib/commerce/catalog-sync";
import { debugTokenScopes, GraphError, listBusinesses, listCatalogs, listPhones, listWabas, pushCatalogItems } from "@/lib/commerce/meta-graph";

type FetchLike = typeof fetch;

function liveSyncEnabled() {
  return process.env.COMMERCE_CATALOG_SYNC_ENABLED === "true";
}

function asRecord(row: {
  businessId: string;
  businessName: string;
  wabaId: string;
  phoneNumberId: string;
  phoneMasked: string;
  catalogId: string;
  catalogName: string;
  grantedScopes: string;
  tokenEnc: string | null;
  lastError: string;
  permissionError: boolean;
  disconnectedAt: Date | null;
}): ConnectionRecord {
  return row;
}

export async function getCommerceConnection(tenantId: string): Promise<CommerceConnectionView> {
  const row = await prisma.commerceConnection.findUnique({ where: { tenantId } });
  if (!row) return emptyConnection(liveSyncEnabled());
  return presentConnection(asRecord(row), liveSyncEnabled());
}

export async function saveCommerceToken(opts: {
  tenantId: string;
  accessToken: string;
  expiresAt: Date | null;
  scopes: string[];
  actorId: string;
  fetchImpl?: FetchLike;
}) {
  let scopes = opts.scopes;
  let permissionError = missingScopes(scopes, COMMERCE_META_SCOPES).length > 0;
  let lastError = permissionError ? `Missing ${missingScopes(scopes, COMMERCE_META_SCOPES).join(", ")}.` : "";
  if (scopes.length === 0) {
    try {
      const meta = await resolvedMetaApp();
      scopes = await debugTokenScopes({
        inputToken: opts.accessToken,
        appId: meta.appId,
        appSecret: meta.appSecret,
        fetchImpl: opts.fetchImpl,
      });
      permissionError = missingScopes(scopes, COMMERCE_META_SCOPES).length > 0;
      lastError = permissionError ? `Missing ${missingScopes(scopes, COMMERCE_META_SCOPES).join(", ")}.` : "";
    } catch (error) {
      permissionError = true;
      lastError = error instanceof Error ? error.message : "Could not read Meta permissions";
    }
  }
  await prisma.commerceConnection.upsert({
    where: { tenantId: opts.tenantId },
    create: {
      tenantId: opts.tenantId,
      tokenEnc: encryptSecret(opts.accessToken),
      tokenExpiresAt: opts.expiresAt,
      grantedScopes: scopes.join(","),
      permissionError,
      lastError,
      disconnectedAt: null,
      lastCheckedAt: new Date(),
    },
    update: {
      tokenEnc: encryptSecret(opts.accessToken),
      tokenExpiresAt: opts.expiresAt,
      grantedScopes: scopes.join(","),
      permissionError,
      lastError,
      disconnectedAt: null,
      lastCheckedAt: new Date(),
    },
  });
  await writeAudit({
    tenantId: opts.tenantId,
    actorId: opts.actorId,
    action: "commerce.connection.save",
    objectType: "CommerceConnection",
    objectId: opts.tenantId,
    meta: { scopes, permissionError },
  });
  return getCommerceConnection(opts.tenantId);
}

async function tokenFor(tenantId: string): Promise<{ token: string } | { error: string; status: number }> {
  const row = await prisma.commerceConnection.findUnique({ where: { tenantId } });
  if (!row?.tokenEnc) return { error: "Meta is not connected for this merchant", status: 400 };
  try {
    return { token: decryptSecret(row.tokenEnc) };
  } catch {
    return { error: "Stored Meta credential could not be read", status: 400 };
  }
}

export async function discoverCommerceAssets(tenantId: string, fetchImpl: FetchLike = fetch) {
  const loaded = await tokenFor(tenantId);
  if ("error" in loaded) return { ok: false as const, status: loaded.status, error: loaded.error };
  const row = await prisma.commerceConnection.findUnique({ where: { tenantId } });
  try {
    const businesses = await listBusinesses(loaded.token, fetchImpl);
    const businessId = row?.businessId && businesses.some((business) => business.id === row.businessId)
      ? row.businessId
      : businesses.length === 1
        ? businesses[0].id
        : "";
    const businessName = businesses.find((business) => business.id === businessId)?.name || "";
    const catalogs = businessId ? await listCatalogs(businessId, loaded.token, fetchImpl) : [];
    const wabas = businessId ? await listWabas(businessId, loaded.token, fetchImpl) : [];
    const phones: { id: string; wabaId: string; wabaName: string; masked: string }[] = [];
    for (const waba of wabas) {
      const listed = await listPhones(waba.id, loaded.token, fetchImpl);
      for (const phone of listed) {
        phones.push({ id: phone.id, wabaId: waba.id, wabaName: waba.name, masked: maskPhone(phone.display) });
      }
    }
    const missing = missingScopes(parseScopes(row?.grantedScopes || ""), COMMERCE_META_SCOPES);
    const permissionPatch = {
      lastCheckedAt: new Date(),
      permissionError: missing.length > 0,
      lastError: missing.length ? `Missing ${missing.join(", ")}.` : "",
    };
    if (businessId && row && row.businessId !== businessId) {
      await prisma.commerceConnection.update({
        where: { tenantId },
        data: { businessId, businessName, ...permissionPatch },
      });
    } else if (row) {
      await prisma.commerceConnection.update({
        where: { tenantId },
        data: permissionPatch,
      });
    }
    return { ok: true as const, businesses, catalogs, phones, connection: await getCommerceConnection(tenantId) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta discovery failed";
    const permission = error instanceof GraphError && error.permission;
    await prisma.commerceConnection.update({
      where: { tenantId },
      data: { lastError: message, permissionError: permission, lastCheckedAt: new Date() },
    });
    return {
      ok: false as const,
      status: permission ? 403 : 502,
      error: message,
      connection: await getCommerceConnection(tenantId),
    };
  }
}

export async function linkCommerceAssets(
  tenantId: string,
  input: { businessId: string; catalogId: string; wabaId: string; phoneNumberId: string },
  actorId: string,
  fetchImpl: FetchLike = fetch
) {
  const discovered = await discoverCommerceAssets(tenantId, fetchImpl);
  if (!discovered.ok) return discovered;
  const business = discovered.businesses.find((row) => row.id === input.businessId);
  const catalog = discovered.catalogs.find((row) => row.id === input.catalogId);
  const phone = discovered.phones.find((row) => row.id === input.phoneNumberId && row.wabaId === input.wabaId);
  if (!business || !catalog || !phone) {
    return { ok: false as const, status: 400, error: "Choose a catalog and phone number from this merchant's Meta assets" };
  }
  await prisma.commerceConnection.update({
    where: { tenantId },
    data: {
      businessId: business.id,
      businessName: business.name,
      catalogId: catalog.id,
      catalogName: catalog.name,
      wabaId: phone.wabaId,
      phoneNumberId: phone.id,
      phoneMasked: phone.masked,
      lastError: "",
      lastCheckedAt: new Date(),
    },
  });
  await writeAudit({
    tenantId,
    actorId,
    action: "commerce.connection.link",
    objectType: "CommerceConnection",
    objectId: tenantId,
    meta: { catalogId: catalog.id, wabaId: phone.wabaId },
  });
  return { ok: true as const, connection: await getCommerceConnection(tenantId) };
}

export async function disconnectCommerce(tenantId: string, actorId: string) {
  await prisma.commerceConnection.updateMany({
    where: { tenantId },
    data: { tokenEnc: null, disconnectedAt: new Date(), permissionError: false, lastError: "" },
  });
  await writeAudit({
    tenantId,
    actorId,
    action: "commerce.connection.disconnect",
    objectType: "CommerceConnection",
    objectId: tenantId,
  });
  return getCommerceConnection(tenantId);
}

async function loadSyncProduct(tenantId: string, productId: string): Promise<SyncProduct | null> {
  const row = await prisma.commerceProduct.findFirst({
    where: { id: productId, tenantId },
    select: {
      sku: true,
      name: true,
      description: true,
      category: true,
      imageUrl: true,
      imageMime: true,
      unitPriceIdr: true,
      status: true,
      availability: true,
      catalogEligibility: true,
      variants: { select: { sku: true, name: true, unitPriceIdr: true, status: true } },
    },
  });
  if (!row) return null;
  return {
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
    imageUrl: row.imageUrl,
    hasImage: Boolean(row.imageMime),
    unitPriceIdr: row.unitPriceIdr,
    status: row.status,
    availability: row.availability,
    catalogEligibility: row.catalogEligibility,
    variants: row.variants,
  };
}

export async function previewCatalogSync(tenantId: string, productId: string) {
  const [product, connection] = await Promise.all([
    loadSyncProduct(tenantId, productId),
    getCommerceConnection(tenantId),
  ]);
  if (!product) return { ok: false as const, status: 404, error: "Product not found" };
  const decision = decideCatalogSync({
    catalogState: connection.catalog.status,
    liveSwitch: connection.liveSyncEnabled,
    catalogId: connection.catalogId,
    product,
    publicUrl: null,
  });
  return {
    ok: true as const,
    networkCalled: false as const,
    liveSyncEnabled: connection.liveSyncEnabled,
    syncStatus: decision.syncStatus,
    message: decision.message,
    blockers: decision.blockers,
    items: decision.items,
    reviewStatus: "UNKNOWN" as const,
  };
}

export async function requestCatalogSync(opts: {
  tenantId: string;
  productId: string | null;
  actorId: string;
  fetchImpl?: FetchLike;
  /** Tests only. Production calls leave this empty, so the public-URL blocker stays shut. */
  publicUrl?: string | null;
  liveSwitch?: boolean;
}) {
  const connection = await getCommerceConnection(opts.tenantId);
  const product = opts.productId ? await loadSyncProduct(opts.tenantId, opts.productId) : null;
  if (opts.productId && !product) return { ok: false as const, status: 404, error: "Product not found" };
  const liveSwitch = opts.liveSwitch ?? connection.liveSyncEnabled;
  const decision = decideCatalogSync({
    catalogState: connection.catalog.status,
    liveSwitch,
    catalogId: connection.catalogId,
    product,
    publicUrl: opts.publicUrl ?? null,
  });
  const key = decision.payloadHash || `none:${opts.productId || "catalog"}`;
  const existing = await prisma.commerceSyncJob.findUnique({
    where: { tenantId_idempotencyKey: { tenantId: opts.tenantId, idempotencyKey: key } },
  });
  const samePayload = existing && existing.payloadHash === decision.payloadHash;
  if (samePayload && existing.status === "SUCCEEDED") {
    return {
      ok: true as const,
      plan: {
        syncStatus: "SYNCED" as const,
        externalProductId: "" as const,
        networkCalled: false,
        message: existing.lastError || decision.message,
      },
      items: decision.items,
      blockers: decision.blockers,
      jobId: existing.id,
      retried: false,
    };
  }
  if (samePayload && existing.status === "BLOCKED" && !decision.execute) {
    return {
      ok: true as const,
      plan: {
        syncStatus: decision.syncStatus,
        externalProductId: "" as const,
        networkCalled: false,
        message: existing.lastError || decision.message,
      },
      items: decision.items,
      blockers: decision.blockers,
      jobId: existing.id,
      retried: false,
    };
  }
  if (samePayload && existing.status === "FAILED" && existing.attempts >= 3) {
    return {
      ok: true as const,
      plan: {
        syncStatus: "FAILED" as const,
        externalProductId: "" as const,
        networkCalled: false,
        message: existing.lastError || "Sync stopped after 3 attempts.",
      },
      items: decision.items,
      blockers: decision.blockers,
      jobId: existing.id,
      retried: false,
    };
  }

  let networkCalled = false;
  let status = decision.execute ? "FAILED" : "BLOCKED";
  let message = decision.message;
  if (decision.execute && opts.productId && product && opts.publicUrl?.startsWith("https://")) {
    const loaded = await tokenFor(opts.tenantId);
    if ("error" in loaded) {
      message = loaded.error;
    } else {
      const linkRow = await prisma.commerceCatalogLink.findFirst({
        where: { productId: opts.productId, tenantId: opts.tenantId },
        select: { externalProductId: true, retailerId: true },
      });
      const maps = await prisma.commerceVariantMap.findMany({
        where: { productId: opts.productId, tenantId: opts.tenantId },
        select: { retailerId: true, externalProductId: true },
      });
      const existingIds = new Set(
        [linkRow, ...maps].filter((row) => row && row.externalProductId).map((row) => row!.retailerId)
      );
      try {
        await pushCatalogItems({
          catalogId: connection.catalogId,
          token: loaded.token,
          items: decision.items,
          existingRetailerIds: existingIds,
          link: opts.publicUrl,
          fetchImpl: opts.fetchImpl,
        });
        networkCalled = true;
        status = "SUCCEEDED";
        message = "Catalog batch accepted. Meta review is separate from the offer status.";
      } catch (error) {
        networkCalled = true;
        status = "FAILED";
        message = error instanceof Error ? error.message : "Catalog batch failed";
        if (error instanceof GraphError && error.permission) {
          await prisma.commerceConnection.update({
            where: { tenantId: opts.tenantId },
            data: { permissionError: true, lastError: message },
          });
        }
      }
    }
  }

  const attempts = (existing?.attempts || 0) + 1;
  const job = existing
    ? await prisma.commerceSyncJob.update({
        where: { id: existing.id },
        data: {
          status,
          attempts,
          lastError: message,
          payloadHash: decision.payloadHash,
          finishedAt: new Date(),
        },
      })
    : await prisma.commerceSyncJob.create({
        data: {
          tenantId: opts.tenantId,
          productId: opts.productId,
          idempotencyKey: key,
          action: "UPSERT",
          status,
          attempts,
          lastError: message,
          payloadHash: decision.payloadHash,
          finishedAt: new Date(),
        },
      });

  if (opts.productId) {
    await prisma.commerceCatalogLink.updateMany({
      where: { productId: opts.productId, tenantId: opts.tenantId },
      data: {
        syncStatus: status === "SUCCEEDED" ? "SYNCED" : decision.syncStatus,
        lastError: message,
        lastAttemptAt: new Date(),
        ...(status === "SUCCEEDED" ? { lastSyncedAt: new Date(), externalCatalogId: connection.catalogId } : {}),
      },
    });
  }
  await prisma.commerceSyncLog.create({
    data: {
      tenantId: opts.tenantId,
      productId: opts.productId,
      action: "CATALOG_SYNC",
      outcome: status === "SUCCEEDED" ? "SYNCED" : decision.syncStatus,
      message,
    },
  });
  await writeAudit({
    tenantId: opts.tenantId,
    actorId: opts.actorId,
    action: networkCalled ? "commerce.catalog.sync" : "commerce.catalog.sync_refused",
    objectType: "CommerceProduct",
    objectId: opts.productId ?? undefined,
    meta: { networkCalled },
  });
  return {
    ok: true as const,
    plan: {
      syncStatus: status === "SUCCEEDED" ? "SYNCED" : decision.syncStatus,
      externalProductId: "" as const,
      networkCalled,
      message,
    },
    items: decision.items as CatalogItem[],
    blockers: decision.blockers,
    jobId: job.id,
    retried: Boolean(existing),
  };
}
