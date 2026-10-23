import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/google/crypto";
import { resolvedMetaApp } from "@/lib/integrations/service";
import { commerceAuthSecret } from "@/lib/commerce/meta-oauth";
import {
  CATALOG_SCOPES,
  COMMERCE_META_SCOPES,
  WHATSAPP_SCOPES,
  emptyConnection,
  maskPhone,
  missingScopes,
  parseScopes,
  presentConnection,
  type CommerceConnectionView,
  type ConnectionRecord,
} from "@/lib/commerce/connection";
import { decideCatalogSync, type CatalogItem, type SyncProduct } from "@/lib/commerce/catalog-sync";
import {
  GraphError,
  batchFailureMessage,
  checkBatchStatus,
  classifyBatchStatus,
  inspectCommerceToken,
  listBusinesses,
  listCatalogs,
  listPhones,
  listWabas,
  lookupCatalogProducts,
  pushCatalogItems,
  scrubSecret,
  type ItemValidation,
} from "@/lib/commerce/meta-graph";

type FetchLike = typeof fetch;
type MetaApp = { appId: string; appSecret: string };

const CLEARED_ASSETS = {
  businessId: "",
  businessName: "",
  wabaId: "",
  phoneNumberId: "",
  phoneMasked: "",
  catalogId: "",
  catalogName: "",
};

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
  return { ...row, lastError: scrubSecret(row.lastError) };
}

async function metaCredentials(app?: MetaApp): Promise<MetaApp> {
  if (app?.appId && app.appSecret) return app;
  const meta = await resolvedMetaApp();
  return { appId: meta.appId, appSecret: meta.appSecret };
}

export async function getCommerceConnection(tenantId: string): Promise<CommerceConnectionView> {
  const row = await prisma.commerceConnection.findUnique({ where: { tenantId } });
  if (!row) return emptyConnection(liveSyncEnabled());
  const expired = Boolean(row.tokenExpiresAt && row.tokenExpiresAt.getTime() <= Date.now());
  if (!expired) return presentConnection(asRecord(row), liveSyncEnabled());
  return presentConnection(
    asRecord({
      ...row,
      ...CLEARED_ASSETS,
      tokenEnc: null,
      disconnectedAt: row.disconnectedAt || new Date(),
      lastError: "Meta token expired. Connect again.",
    }),
    liveSyncEnabled()
  );
}

async function revokeToken(tenantId: string, reason: string) {
  await prisma.commerceConnection.update({
    where: { tenantId },
    data: {
      ...CLEARED_ASSETS,
      tokenEnc: null,
      disconnectedAt: new Date(),
      permissionError: true,
      lastError: scrubSecret(reason),
      lastCheckedAt: new Date(),
    },
  });
}

export async function saveCommerceToken(opts: {
  tenantId: string;
  accessToken: string;
  expiresAt: Date | null;
  scopes: string[];
  actorId: string;
  fetchImpl?: FetchLike;
  app?: MetaApp;
}) {
  commerceAuthSecret();
  const app = await metaCredentials(opts.app);
  let scopes = opts.scopes;
  let expiresAt = opts.expiresAt;
  let permissionError = true;
  let lastError = "Meta App ID / Secret not set (Settings → API)";
  let storeToken = false;
  if (app.appId && app.appSecret) {
    try {
      const inspection = await inspectCommerceToken({
        inputToken: opts.accessToken,
        appId: app.appId,
        appSecret: app.appSecret,
        fetchImpl: opts.fetchImpl,
      });
      scopes = inspection.scopes;
      expiresAt = inspection.expiresAt || opts.expiresAt;
      if (!inspection.valid) {
        lastError = inspection.reason;
      } else {
        const missing = missingScopes(scopes, COMMERCE_META_SCOPES);
        permissionError = missing.length > 0;
        lastError = permissionError ? `Missing ${missing.join(", ")}.` : "";
        storeToken = true;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Could not read Meta permissions";
    }
  }
  await prisma.commerceConnection.upsert({
    where: { tenantId: opts.tenantId },
    create: {
      tenantId: opts.tenantId,
      ...CLEARED_ASSETS,
      tokenEnc: storeToken ? encryptSecret(opts.accessToken) : null,
      tokenExpiresAt: expiresAt,
      grantedScopes: scopes.join(","),
      permissionError,
      lastError: scrubSecret(lastError),
      disconnectedAt: storeToken ? null : new Date(),
      lastCheckedAt: new Date(),
    },
    update: {
      ...CLEARED_ASSETS,
      tokenEnc: storeToken ? encryptSecret(opts.accessToken) : null,
      tokenExpiresAt: expiresAt,
      grantedScopes: scopes.join(","),
      permissionError,
      lastError: scrubSecret(lastError),
      disconnectedAt: storeToken ? null : new Date(),
      lastCheckedAt: new Date(),
    },
  });
  await writeAudit({
    tenantId: opts.tenantId,
    actorId: opts.actorId,
    action: "commerce.connection.save",
    objectType: "CommerceConnection",
    objectId: opts.tenantId,
    meta: { scopes, permissionError, stored: storeToken },
  });
  return getCommerceConnection(opts.tenantId);
}

async function tokenFor(tenantId: string): Promise<{ token: string } | { error: string; status: number }> {
  const row = await prisma.commerceConnection.findUnique({ where: { tenantId } });
  if (!row?.tokenEnc) return { error: "Meta is not connected for this merchant", status: 400 };
  if (row.tokenExpiresAt && row.tokenExpiresAt.getTime() <= Date.now()) {
    await revokeToken(tenantId, "Meta token expired. Connect again.");
    return { error: "Meta token expired. Connect again.", status: 401 };
  }
  try {
    return { token: decryptSecret(row.tokenEnc) };
  } catch {
    return { error: "Stored Meta credential could not be read", status: 400 };
  }
}

export async function discoverCommerceAssets(
  tenantId: string,
  fetchImpl: FetchLike = fetch,
  businessId = "",
  app?: MetaApp
) {
  const loaded = await tokenFor(tenantId);
  if ("error" in loaded) return { ok: false as const, status: loaded.status, error: loaded.error };
  const row = await prisma.commerceConnection.findUnique({ where: { tenantId } });
  const credentials = await metaCredentials(app);
  if (credentials.appId && credentials.appSecret) {
    try {
      const inspection = await inspectCommerceToken({
        inputToken: loaded.token,
        appId: credentials.appId,
        appSecret: credentials.appSecret,
        fetchImpl,
      });
      if (!inspection.valid) {
        await revokeToken(tenantId, inspection.reason);
        return {
          ok: false as const,
          status: 401,
          error: inspection.reason,
          connection: await getCommerceConnection(tenantId),
        };
      }
      const missing = missingScopes(inspection.scopes, COMMERCE_META_SCOPES);
      await prisma.commerceConnection.update({
        where: { tenantId },
        data: {
          grantedScopes: inspection.scopes.join(","),
          tokenExpiresAt: inspection.expiresAt,
          permissionError: missing.length > 0,
          lastError: missing.length ? `Missing ${missing.join(", ")}.` : "",
          lastCheckedAt: new Date(),
          ...(missingScopes(inspection.scopes, CATALOG_SCOPES).length ? { catalogId: "", catalogName: "" } : {}),
          ...(missingScopes(inspection.scopes, WHATSAPP_SCOPES).length
            ? { wabaId: "", phoneNumberId: "", phoneMasked: "" }
            : {}),
        },
      });
    } catch (error) {
      if (error instanceof GraphError && error.code === 190) {
        await revokeToken(tenantId, error.message);
        return {
          ok: false as const,
          status: 401,
          error: error.message,
          connection: await getCommerceConnection(tenantId),
        };
      }
      const message = scrubSecret(error instanceof Error ? error.message : "Could not read Meta permissions");
      await prisma.commerceConnection.update({
        where: { tenantId },
        data: { lastError: message, lastCheckedAt: new Date() },
      });
      return {
        ok: false as const,
        status: 502,
        error: message,
        connection: await getCommerceConnection(tenantId),
      };
    }
  }
  try {
    const businesses = await listBusinesses(loaded.token, fetchImpl);
    const selected = businessId && businesses.some((business) => business.id === businessId) ? businessId : "";
    if (businessId && !selected) {
      return { ok: false as const, status: 400, error: "That Meta Business is not on this connection" };
    }
    const catalogs = selected ? await listCatalogs(selected, loaded.token, fetchImpl) : [];
    const wabas = selected ? await listWabas(selected, loaded.token, fetchImpl) : [];
    const phones: { id: string; wabaId: string; wabaName: string; masked: string }[] = [];
    for (const waba of wabas) {
      const listed = await listPhones(waba.id, loaded.token, fetchImpl);
      for (const phone of listed) {
        phones.push({ id: phone.id, wabaId: waba.id, wabaName: waba.name, masked: maskPhone(phone.display) });
      }
    }
    if (row) {
      const current = await prisma.commerceConnection.findUnique({ where: { tenantId } });
      const missing = missingScopes(parseScopes(current?.grantedScopes || ""), COMMERCE_META_SCOPES);
      await prisma.commerceConnection.update({
        where: { tenantId },
        data: {
          lastCheckedAt: new Date(),
          permissionError: missing.length > 0,
          lastError: missing.length ? `Missing ${missing.join(", ")}.` : current?.lastError || "",
        },
      });
    }
    return { ok: true as const, businesses, catalogs, phones, connection: await getCommerceConnection(tenantId) };
  } catch (error) {
    if (error instanceof GraphError && error.code === 190) {
      await revokeToken(tenantId, error.message);
    } else {
      const message = scrubSecret(error instanceof Error ? error.message : "Meta discovery failed");
      const permission = error instanceof GraphError && error.permission;
      await prisma.commerceConnection.update({
        where: { tenantId },
        data: { lastError: message, permissionError: permission, lastCheckedAt: new Date() },
      });
    }
    const message = scrubSecret(error instanceof Error ? error.message : "Meta discovery failed");
    const permission = error instanceof GraphError && error.permission;
    return {
      ok: false as const,
      status: error instanceof GraphError && error.code === 190 ? 401 : permission ? 403 : 502,
      error: message,
      connection: await getCommerceConnection(tenantId),
    };
  }
}

export async function linkCommerceAssets(
  tenantId: string,
  input: { businessId: string; catalogId: string; wabaId: string; phoneNumberId: string },
  actorId: string,
  fetchImpl: FetchLike = fetch,
  app?: MetaApp
) {
  const discovered = await discoverCommerceAssets(tenantId, fetchImpl, input.businessId, app);
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

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function linkSyncStatus(jobStatus: string, fallback: string) {
  if (jobStatus === "SUCCEEDED") return "SYNCED";
  if (jobStatus === "SUBMITTED" || jobStatus === "PROCESSING" || jobStatus === "FAILED") return jobStatus;
  return fallback;
}

async function claimCatalogJob(opts: { tenantId: string; productId: string | null; key: string; hash: string }) {
  const existing = await prisma.commerceSyncJob.findUnique({
    where: { tenantId_idempotencyKey: { tenantId: opts.tenantId, idempotencyKey: opts.key } },
  });
  if (existing?.status === "SUCCEEDED" && existing.payloadHash === opts.hash) {
    return { mode: "done" as const, job: existing };
  }
  if (existing?.status === "FAILED" && existing.attempts >= 3) {
    return { mode: "stopped" as const, job: existing };
  }
  if (existing && (existing.status === "SUBMITTED" || existing.status === "PROCESSING") && existing.batchHandle) {
    return { mode: "poll" as const, job: existing };
  }
  if (existing && (existing.status === "SUBMITTED" || existing.status === "PROCESSING") && !existing.batchHandle) {
    const age = Date.now() - existing.updatedAt.getTime();
    if (age < 20000) return { mode: "busy" as const, job: existing };
  }
  if (!existing) {
    try {
      const job = await prisma.commerceSyncJob.create({
        data: {
          tenantId: opts.tenantId,
          productId: opts.productId,
          idempotencyKey: opts.key,
          action: "UPSERT",
          status: "SUBMITTED",
          attempts: 1,
          lastError: "",
          payloadHash: opts.hash,
          batchHandle: "",
          itemResults: "",
        },
      });
      return { mode: "push" as const, job };
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const winner = await prisma.commerceSyncJob.findUnique({
        where: { tenantId_idempotencyKey: { tenantId: opts.tenantId, idempotencyKey: opts.key } },
      });
      if (!winner) throw new Error("Catalog sync claim was lost");
      if (winner.batchHandle) return { mode: "poll" as const, job: winner };
      return { mode: "busy" as const, job: winner };
    }
  }
  const claimed = await prisma.commerceSyncJob.updateMany({
    where: { id: existing.id, status: existing.status, attempts: existing.attempts },
    data: {
      status: "SUBMITTED",
      attempts: { increment: 1 },
      batchHandle: "",
      payloadHash: opts.hash,
      finishedAt: null,
    },
  });
  const job = await prisma.commerceSyncJob.findUnique({ where: { id: existing.id } });
  if (!job) return { mode: "busy" as const, job: existing };
  if (claimed.count !== 1) {
    return job.batchHandle ? { mode: "poll" as const, job } : { mode: "busy" as const, job };
  }
  return { mode: "push" as const, job };
}

async function rememberJob(opts: {
  jobId: string;
  status: string;
  message: string;
  handle?: string;
  items?: ItemValidation[];
  finished?: boolean;
}) {
  await prisma.commerceSyncJob.update({
    where: { id: opts.jobId },
    data: {
      status: opts.status,
      lastError: scrubSecret(opts.message),
      ...(opts.handle !== undefined ? { batchHandle: opts.handle } : {}),
      ...(opts.items ? { itemResults: JSON.stringify(opts.items).slice(0, 8000) } : {}),
      ...(opts.finished ? { finishedAt: new Date() } : {}),
    },
  });
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
  const publicUrl = opts.publicUrl ?? null;
  const decision = decideCatalogSync({
    catalogState: connection.catalog.status,
    liveSwitch,
    catalogId: connection.catalogId,
    product,
    publicUrl,
  });
  const key = decision.payloadHash || `none:${opts.productId || "catalog"}`;
  const canSend = decision.execute && Boolean(opts.productId && product && publicUrl?.startsWith("https://"));

  if (!canSend) {
    const existing = await prisma.commerceSyncJob.findUnique({
      where: { tenantId_idempotencyKey: { tenantId: opts.tenantId, idempotencyKey: key } },
    });
    const samePayload = existing && existing.payloadHash === decision.payloadHash;
    if (samePayload && existing.status === "SUCCEEDED") {
      const link = opts.productId
        ? await prisma.commerceCatalogLink.findFirst({
            where: { productId: opts.productId, tenantId: opts.tenantId },
            select: { externalProductId: true },
          })
        : null;
      return {
        ok: true as const,
        plan: {
          syncStatus: "SYNCED" as const,
          externalProductId: link?.externalProductId || "",
          networkCalled: false,
          message: "Catalog batch already processed. Meta review is separate from the offer status.",
        },
        items: decision.items,
        blockers: decision.blockers,
        jobId: existing.id,
        retried: false,
      };
    }
    if (samePayload && (existing.status === "SUBMITTED" || existing.status === "PROCESSING")) {
      return {
        ok: true as const,
        plan: {
          syncStatus: existing.status,
          externalProductId: "",
          networkCalled: false,
          message: existing.lastError || "Catalog batch is already in progress.",
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
          externalProductId: "",
          networkCalled: false,
          message: existing.lastError || "Sync stopped after 3 attempts.",
        },
        items: decision.items,
        blockers: decision.blockers,
        jobId: existing.id,
        retried: false,
      };
    }
    if (samePayload && existing.status === "BLOCKED") {
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
    const attempts = (existing?.attempts || 0) + 1;
    const job = existing
      ? await prisma.commerceSyncJob.update({
          where: { id: existing.id },
          data: {
            status: "BLOCKED",
            attempts,
            lastError: decision.message,
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
            status: "BLOCKED",
            attempts,
            lastError: decision.message,
            payloadHash: decision.payloadHash,
            finishedAt: new Date(),
          },
        });
    if (opts.productId) {
      const prior = await prisma.commerceCatalogLink.findFirst({
        where: { productId: opts.productId, tenantId: opts.tenantId },
        select: { processedPayloadHash: true },
      });
      const stale = Boolean(prior?.processedPayloadHash) && prior?.processedPayloadHash !== decision.payloadHash;
      await prisma.commerceCatalogLink.updateMany({
        where: { productId: opts.productId, tenantId: opts.tenantId },
        data: {
          syncStatus: stale ? "OUTDATED" : decision.syncStatus,
          lastError: stale ? "Product details changed. Preview sync again before a live push." : decision.message,
          lastAttemptAt: new Date(),
        },
      });
    }
    await prisma.commerceSyncLog.create({
      data: {
        tenantId: opts.tenantId,
        productId: opts.productId,
        action: "CATALOG_SYNC",
        outcome: decision.syncStatus,
        message: decision.message,
      },
    });
    await writeAudit({
      tenantId: opts.tenantId,
      actorId: opts.actorId,
      action: "commerce.catalog.sync_refused",
      objectType: "CommerceProduct",
      objectId: opts.productId ?? undefined,
      meta: { networkCalled: false },
    });
    return {
      ok: true as const,
      plan: {
        syncStatus: decision.syncStatus,
        externalProductId: "" as const,
        networkCalled: false,
        message: decision.message,
      },
      items: decision.items as CatalogItem[],
      blockers: decision.blockers,
      jobId: job.id,
      retried: Boolean(existing),
    };
  }

  const claim = await claimCatalogJob({
    tenantId: opts.tenantId,
    productId: opts.productId,
    key,
    hash: decision.payloadHash,
  });
  if (claim.mode === "done") {
    const link = opts.productId
      ? await prisma.commerceCatalogLink.findFirst({
          where: { productId: opts.productId, tenantId: opts.tenantId },
          select: { externalProductId: true },
        })
      : null;
    return {
      ok: true as const,
      plan: {
        syncStatus: "SYNCED" as const,
        externalProductId: link?.externalProductId || "",
        networkCalled: false,
        message: "Catalog batch already processed. Meta review is separate from the offer status.",
      },
      items: decision.items,
      blockers: decision.blockers,
      jobId: claim.job.id,
      retried: false,
    };
  }
  if (claim.mode === "stopped") {
    return {
      ok: true as const,
      plan: {
        syncStatus: "FAILED" as const,
        externalProductId: "",
        networkCalled: false,
        message: claim.job.lastError || "Sync stopped after 3 attempts.",
      },
      items: decision.items,
      blockers: decision.blockers,
      jobId: claim.job.id,
      retried: false,
    };
  }
  if (claim.mode === "busy") {
    return {
      ok: true as const,
      plan: {
        syncStatus: claim.job.status === "PROCESSING" ? ("PROCESSING" as const) : ("SUBMITTED" as const),
        externalProductId: "",
        networkCalled: false,
        message: "Catalog batch is already in progress.",
      },
      items: decision.items,
      blockers: decision.blockers,
      jobId: claim.job.id,
      retried: true,
    };
  }

  const loaded = await tokenFor(opts.tenantId);
  let networkCalled = false;
  let status = claim.mode === "poll" ? "PROCESSING" : "SUBMITTED";
  let message = "Catalog batch submitted. Processing is not confirmed yet.";
  let handle = claim.job.batchHandle;
  let itemResults: ItemValidation[] = [];
  let mappings = new Map<string, string>();

  if ("error" in loaded) {
    status = "FAILED";
    message = loaded.error;
  } else if (claim.mode === "push") {
    const linkRow = await prisma.commerceCatalogLink.findFirst({
      where: { productId: opts.productId || "", tenantId: opts.tenantId },
      select: { externalProductId: true, retailerId: true },
    });
    const maps = await prisma.commerceVariantMap.findMany({
      where: { productId: opts.productId || "", tenantId: opts.tenantId },
      select: { retailerId: true, externalProductId: true },
    });
    const existingIds = new Set(
      [linkRow, ...maps].filter((row) => row && row.externalProductId).map((row) => row!.retailerId)
    );
    try {
      const accepted = await pushCatalogItems({
        catalogId: connection.catalogId,
        token: loaded.token,
        items: decision.items,
        existingRetailerIds: existingIds,
        link: publicUrl || "",
        fetchImpl: opts.fetchImpl,
      });
      networkCalled = true;
      itemResults = accepted.validation;
      handle = accepted.handles[0] || "";
      if (!handle) {
        status = "FAILED";
        message = "Meta rejected the catalog batch. No item was confirmed.";
      } else {
        status = "SUBMITTED";
        message = "Catalog batch submitted. Processing is not confirmed yet.";
        await rememberJob({ jobId: claim.job.id, status, message, handle, items: itemResults });
      }
    } catch (error) {
      networkCalled = true;
      status = "FAILED";
      message = error instanceof Error ? error.message : "Catalog batch failed";
      if (error instanceof GraphError && error.code === 190) await revokeToken(opts.tenantId, message);
      else if (error instanceof GraphError && error.permission) {
        await prisma.commerceConnection.update({
          where: { tenantId: opts.tenantId },
          data: { permissionError: true, lastError: scrubSecret(message) },
        });
      }
    }
  }

  if ((status === "SUBMITTED" || claim.mode === "poll") && handle && status !== "FAILED" && !("error" in loaded)) {
    try {
      const report = await checkBatchStatus({
        catalogId: connection.catalogId,
        handle,
        token: loaded.token,
        fetchImpl: opts.fetchImpl,
      });
      networkCalled = true;
      itemResults = report.items.length ? report.items : itemResults;
      const classified = classifyBatchStatus(report);
      if (classified === "SUCCEEDED") {
        const found = await lookupCatalogProducts({
          catalogId: connection.catalogId,
          retailerIds: decision.items.map((item) => item.retailerId),
          token: loaded.token,
          fetchImpl: opts.fetchImpl,
        });
        mappings = new Map(found.map((row) => [row.retailerId, row.metaProductId]));
        const confirmed = decision.items.every((item) => mappings.get(item.retailerId));
        if (confirmed) {
          status = "SUCCEEDED";
          message = "Catalog batch processed. Meta review is separate from the offer status.";
        } else {
          status = "PROCESSING";
          message = "Meta finished the batch. Product ids are not confirmed yet.";
        }
      } else if (classified === "FAILED") {
        status = "FAILED";
        message = batchFailureMessage({ invalidIds: report.invalidIds, itemCount: decision.items.length });
      } else {
        status = classified;
        message =
          classified === "PROCESSING"
            ? "Catalog batch is still processing. Meta review has not started."
            : "Catalog batch submitted. Processing is not confirmed yet.";
      }
    } catch (error) {
      networkCalled = true;
      status = "FAILED";
      message = error instanceof Error ? error.message : "Catalog batch status failed";
      if (error instanceof GraphError && error.code === 190) await revokeToken(opts.tenantId, message);
    }
  }

  message = scrubSecret(message);
  await rememberJob({
    jobId: claim.job.id,
    status,
    message,
    handle,
    items: itemResults,
    finished: status === "SUCCEEDED" || status === "FAILED",
  });

  let externalProductId = "";
  if (opts.productId && product) {
    const parentMetaId = mappings.get(product.sku) || "";
    if (status === "SUCCEEDED" && parentMetaId) externalProductId = parentMetaId;
    else {
      const current = await prisma.commerceCatalogLink.findFirst({
        where: { productId: opts.productId, tenantId: opts.tenantId },
        select: { externalProductId: true },
      });
      externalProductId = current?.externalProductId || "";
    }
    await prisma.commerceCatalogLink.updateMany({
      where: { productId: opts.productId, tenantId: opts.tenantId },
      data: {
        syncStatus: linkSyncStatus(status, decision.syncStatus),
        lastError: message,
        lastAttemptAt: new Date(),
        ...(status === "SUCCEEDED"
          ? {
              lastSyncedAt: new Date(),
              externalCatalogId: connection.catalogId,
              processedPayloadHash: decision.payloadHash,
              processedPublicUrl: publicUrl || "",
              ...(externalProductId ? { externalProductId, metaProductId: externalProductId } : {}),
            }
          : {}),
      },
    });
    if (status === "SUCCEEDED") {
      const variants = await prisma.commerceVariant.findMany({
        where: { productId: opts.productId, tenantId: opts.tenantId },
        select: { id: true, sku: true },
      });
      for (const variant of variants) {
        const metaProductId = mappings.get(variant.sku);
        if (!metaProductId) continue;
        await prisma.commerceVariantMap.upsert({
          where: { variantId: variant.id },
          create: {
            tenantId: opts.tenantId,
            productId: opts.productId,
            variantId: variant.id,
            retailerId: variant.sku,
            externalProductId: metaProductId,
            metaProductId,
            syncStatus: "SYNCED",
            reviewStatus: "UNKNOWN",
            lastSyncedAt: new Date(),
          },
          update: {
            retailerId: variant.sku,
            externalProductId: metaProductId,
            metaProductId,
            syncStatus: "SYNCED",
            lastSyncedAt: new Date(),
          },
        });
      }
    }
  }

  await prisma.commerceSyncLog.create({
    data: {
      tenantId: opts.tenantId,
      productId: opts.productId,
      action: "CATALOG_SYNC",
      outcome: linkSyncStatus(status, decision.syncStatus),
      message,
    },
  });
  await writeAudit({
    tenantId: opts.tenantId,
    actorId: opts.actorId,
    action: networkCalled ? "commerce.catalog.sync" : "commerce.catalog.sync_refused",
    objectType: "CommerceProduct",
    objectId: opts.productId ?? undefined,
    meta: { networkCalled, status },
  });
  return {
    ok: true as const,
    plan: {
      syncStatus: linkSyncStatus(status, decision.syncStatus),
      externalProductId,
      networkCalled,
      message,
    },
    items: decision.items as CatalogItem[],
    blockers: decision.blockers,
    jobId: claim.job.id,
    retried: claim.mode !== "push",
  };
}
