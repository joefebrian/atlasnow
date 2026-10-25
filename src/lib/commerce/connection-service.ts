import { randomBytes } from "crypto";
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
import {
  batchSyncDecision,
  catalogItems,
  decideCatalogSync,
  payloadHash,
  type CatalogItem,
  type SyncProduct,
} from "@/lib/commerce/catalog-sync";
import { feedSchemaForVertical, localAreaFromOutlets } from "@/lib/commerce/catalog-feed";
import { loadFeedOutlets } from "@/lib/commerce/catalog-export";
import { publishMethods, simulatedCatalogPublish, updateRetailerIds } from "@/lib/commerce/catalog-publish";
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
  catalogVertical: "",
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
  catalogVertical?: string;
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
  await retireForeignCatalogMappings(opts.tenantId, "");
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

const PREVIOUS_CATALOG_MESSAGE =
  "Stored item ids belong to a previous Meta catalog and are not used for the current catalog.";

async function retireForeignCatalogMappings(tenantId: string, activeCatalogId: string) {
  await prisma.commerceCatalogLink.updateMany({
    where: {
      tenantId,
      mappingCurrent: true,
      externalCatalogId: { not: "" },
      ...(activeCatalogId ? { NOT: { externalCatalogId: activeCatalogId } } : {}),
    },
    data: {
      mappingCurrent: false,
      syncStatus: "OUTDATED",
      lastError: PREVIOUS_CATALOG_MESSAGE,
    },
  });
  const stale = await prisma.commerceCatalogLink.findMany({
    where: { tenantId, mappingCurrent: false },
    select: { productId: true },
  });
  if (!stale.length) return;
  await prisma.commerceVariantMap.updateMany({
    where: {
      tenantId,
      productId: { in: stale.map((row) => row.productId) },
      mappingCurrent: true,
    },
    data: {
      mappingCurrent: false,
      syncStatus: "OUTDATED",
      lastError: PREVIOUS_CATALOG_MESSAGE,
    },
  });
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
          ...(missingScopes(inspection.scopes, CATALOG_SCOPES).length
            ? { catalogId: "", catalogName: "", catalogVertical: "" }
            : {}),
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
    const current = await prisma.commerceConnection.findUnique({ where: { tenantId }, select: { catalogId: true } });
    const linkedCatalog = catalogs.find((catalog) => catalog.id === current?.catalogId);
    if (current?.catalogId && linkedCatalog?.vertical) {
      await prisma.commerceConnection.update({
        where: { tenantId },
        data: { catalogVertical: linkedCatalog.vertical.slice(0, 80) },
      });
    }
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
      catalogVertical: catalog.vertical.slice(0, 80),
      wabaId: phone.wabaId,
      phoneNumberId: phone.id,
      phoneMasked: phone.masked,
      lastError: "",
      lastCheckedAt: new Date(),
    },
  });
  await retireForeignCatalogMappings(tenantId, catalog.id);
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
      publicUrl: true,
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
    publicUrl: row.publicUrl,
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
  const [link, variantMaps, outlets] = await Promise.all([
    prisma.commerceCatalogLink.findFirst({
      where: { productId, tenantId },
      select: {
        retailerId: true,
        externalProductId: true,
        externalCatalogId: true,
        metaProductId: true,
        mappingCurrent: true,
        reviewStatus: true,
        sourceSnapshot: true,
        lastImportedAt: true,
        lastSyncedAt: true,
      },
    }),
    prisma.commerceVariantMap.findMany({
      where: { productId, tenantId },
      select: { retailerId: true, externalProductId: true, metaProductId: true, mappingCurrent: true },
    }),
    loadFeedOutlets(tenantId, productId),
  ]);
  const plan = simulatedCatalogPublish({
    catalogState: connection.catalog.status,
    liveSwitch: connection.liveSyncEnabled,
    catalogId: connection.catalogId,
    product,
    storedPublicUrl: product.publicUrl || null,
    vertical: connection.catalogVertical,
    outlets,
    parent: link,
    variants: variantMaps,
    snapshot: link?.sourceSnapshot || "",
    reviewStatus: link?.reviewStatus || "UNKNOWN",
    lastImportedAt: link?.lastImportedAt ? link.lastImportedAt.toISOString() : null,
    lastSyncedAt: link?.lastSyncedAt ? link.lastSyncedAt.toISOString() : null,
  });
  return {
    ok: true as const,
    networkCalled: false as const,
    liveSyncEnabled: plan.liveSyncEnabled,
    syncStatus: plan.syncStatus,
    message: plan.message,
    blockers: plan.blockers,
    productBlockers: plan.productBlockers,
    executionBlockers: plan.executionBlockers,
    readiness: plan.readiness,
    items: plan.items,
    reviewStatus: plan.reviewStatus,
    methods: plan.methods,
    batch: plan.batch,
    diffs: plan.diffs,
    hasSnapshot: plan.hasSnapshot,
    source: plan.source,
    lastImportedAt: plan.lastImportedAt,
    lastSyncedAt: plan.lastSyncedAt,
    mappings: plan.mappings,
    wouldSend: false as const,
    acceptanceNote: plan.acceptanceNote,
    schemaNote: plan.schemaNote,
  };
}

function linkSyncStatus(jobStatus: string, fallback: string) {
  if (jobStatus === "SUCCEEDED") return "SYNCED";
  if (jobStatus === "SUBMITTED" || jobStatus === "PROCESSING" || jobStatus === "FAILED") return jobStatus;
  return fallback;
}

const POLL_BACKOFF_MS = [15_000, 30_000, 60_000, 120_000, 300_000, 600_000, 900_000];
const MAX_POLLS = 8;
const MAX_JOB_MS = 2 * 60 * 60 * 1000;
const LOCK_MS = 60_000;
const STALE_BATCH_MESSAGE = "This batch finished after the product or catalog changed. It was not applied.";
const POLL_STOPPED_MESSAGE = "Catalog batch polling stopped before Meta confirmed it.";

function backoffMs(attempt: number) {
  return POLL_BACKOFF_MS[Math.min(Math.max(attempt, 0), POLL_BACKOFF_MS.length - 1)];
}

function validationErrorCount(items: ItemValidation[]) {
  return items.reduce((sum, row) => sum + row.errors.length, 0);
}

function storedValidation(raw: string): ItemValidation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ItemValidation[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row.retailerId === "string").map((row) => ({
      retailerId: row.retailerId,
      errors: Array.isArray(row.errors) ? row.errors.map(String) : [],
      warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    }));
  } catch {
    return [];
  }
}

/** Keeps earlier item errors. A later clean status poll must not erase them. */
function mergeValidation(prior: ItemValidation[], next: ItemValidation[]): ItemValidation[] {
  const byId = new Map<string, ItemValidation>();
  for (const row of [...prior, ...next]) {
    const current = byId.get(row.retailerId) || { retailerId: row.retailerId, errors: [], warnings: [] };
    current.errors.push(...row.errors);
    current.warnings.push(...row.warnings);
    byId.set(row.retailerId, current);
  }
  return [...byId.values()];
}

async function claimCatalogJob(opts: {
  tenantId: string;
  productId: string | null;
  key: string;
  hash: string;
  catalogId: string;
  publicUrl: string;
}) {
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
    const id = randomBytes(16).toString("hex");
    const inserted = await prisma.$executeRaw`
      INSERT INTO "CommerceSyncJob" (
        "id", "tenantId", "productId", "idempotencyKey", "action", "status",
        "attempts", "lastError", "payloadHash", "batchHandle", "itemResults",
        "catalogId", "publicUrl", "pollAttempts", "lockToken", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${opts.tenantId}, ${opts.productId}, ${opts.key}, ${"UPSERT"}, ${"SUBMITTED"},
        ${1}, ${""}, ${opts.hash}, ${""}, ${""},
        ${opts.catalogId}, ${opts.publicUrl}, ${0}, ${""}, NOW(), NOW()
      )
      ON CONFLICT ("tenantId", "idempotencyKey") DO NOTHING
    `;
    const winner = await prisma.commerceSyncJob.findUnique({
      where: { tenantId_idempotencyKey: { tenantId: opts.tenantId, idempotencyKey: opts.key } },
    });
    if (!winner) throw new Error("Catalog sync claim was lost");
    if (inserted === 1) return { mode: "push" as const, job: winner };
    if (winner.batchHandle) return { mode: "poll" as const, job: winner };
    return { mode: "busy" as const, job: winner };
  }
  const claimed = await prisma.commerceSyncJob.updateMany({
    where: { id: existing.id, status: existing.status, attempts: existing.attempts },
    data: {
      status: "SUBMITTED",
      attempts: { increment: 1 },
      batchHandle: "",
      payloadHash: opts.hash,
      catalogId: opts.catalogId,
      publicUrl: opts.publicUrl,
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
  pollAttempts?: number;
  nextPollAt?: Date | null;
}) {
  const open = opts.status === "SUBMITTED" || opts.status === "PROCESSING";
  await prisma.commerceSyncJob.update({
    where: { id: opts.jobId },
    data: {
      status: opts.status,
      lastError: scrubSecret(opts.message),
      ...(opts.handle !== undefined ? { batchHandle: opts.handle } : {}),
      ...(opts.items ? { itemResults: JSON.stringify(opts.items).slice(0, 8000) } : {}),
      ...(opts.finished ? { finishedAt: new Date(), nextPollAt: null } : {}),
      ...(open
        ? {
            pollAttempts: opts.pollAttempts,
            nextPollAt: opts.nextPollAt === undefined ? new Date(Date.now() + backoffMs(opts.pollAttempts || 0)) : opts.nextPollAt,
          }
        : {}),
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
  const parentLink = opts.productId
    ? await prisma.commerceCatalogLink.findFirst({
        where: { productId: opts.productId, tenantId: opts.tenantId },
        select: {
          retailerId: true,
          externalProductId: true,
          externalCatalogId: true,
          metaProductId: true,
          mappingCurrent: true,
        },
      })
    : null;
  const variantMaps = opts.productId
    ? await prisma.commerceVariantMap.findMany({
        where: { productId: opts.productId, tenantId: opts.tenantId },
        select: { retailerId: true, externalProductId: true, metaProductId: true, mappingCurrent: true },
      })
    : [];
  const methods = product
    ? publishMethods({
        catalogId: connection.catalogId,
        parentSku: product.sku,
        variantSkus: product.variants.filter((row) => row.status !== "ARCHIVED" && row.sku).map((row) => row.sku),
        parent: parentLink,
        variants: variantMaps,
      })
    : [];
  const methodBlockers = methods.filter((row) => row.reason).map((row) => row.reason);
  const vertical = feedSchemaForVertical(connection.catalogVertical);
  const localBlockers: string[] = [];
  // Radius and unit are not stored, so a local catalog cannot add circle columns here.
  let dataExtras: Record<string, Record<string, string>> | undefined;
  if (vertical.schema === "unsupported" || vertical.schema === "unverified") localBlockers.push(vertical.note);
  if (vertical.schema === "local" && opts.productId) {
    const outlets = await loadFeedOutlets(opts.tenantId, opts.productId);
    localBlockers.push(...localAreaFromOutlets(outlets).messages);
  }
  const blockedMessage = !decision.execute ? decision.message : methodBlockers[0] || localBlockers[0] || decision.message;
  const canSend =
    decision.execute &&
    Boolean(opts.productId && product && publicUrl?.startsWith("https://")) &&
    methodBlockers.length === 0 &&
    localBlockers.length === 0;

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
            lastError: blockedMessage,
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
            lastError: blockedMessage,
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
          lastError: stale ? "Product details changed. Preview sync again before a live push." : blockedMessage,
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
        message: blockedMessage,
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
        message: blockedMessage,
      },
      items: decision.items as CatalogItem[],
      blockers: [...decision.blockers, ...methodBlockers, ...localBlockers],
      jobId: job.id,
      retried: Boolean(existing),
    };
  }

  const claim = await claimCatalogJob({
    tenantId: opts.tenantId,
    productId: opts.productId,
    key,
    hash: decision.payloadHash,
    catalogId: connection.catalogId,
    publicUrl: publicUrl || "",
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
  let stale = false;
  const jobCatalogId = claim.job.catalogId || connection.catalogId;
  const jobPublicUrl = claim.job.publicUrl || publicUrl || "";

  if ("error" in loaded) {
    status = "FAILED";
    message = loaded.error;
  } else if (claim.mode === "push") {
    try {
      const accepted = await pushCatalogItems({
        catalogId: connection.catalogId,
        token: loaded.token,
        items: decision.items,
        existingRetailerIds: updateRetailerIds(methods),
        link: publicUrl || "",
        dataExtras,
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
        catalogId: jobCatalogId,
        handle,
        token: loaded.token,
        fetchImpl: opts.fetchImpl,
      });
      networkCalled = true;
      itemResults = mergeValidation(itemResults, report.items);
      const classified = classifyBatchStatus(report);
      const freshProduct = opts.productId ? await loadSyncProduct(opts.tenantId, opts.productId) : product;
      const freshConnection = await getCommerceConnection(opts.tenantId);
      const currentHash = freshProduct
        ? payloadHash(jobCatalogId, catalogItems(freshProduct), jobPublicUrl || null)
        : "";
      const found =
        classified === "SUCCEEDED"
          ? await lookupCatalogProducts({
              catalogId: jobCatalogId,
              retailerIds: decision.items.map((item) => item.retailerId),
              token: loaded.token,
              fetchImpl: opts.fetchImpl,
            })
          : [];
      const outcome = batchSyncDecision({
        classified,
        validationErrorCount: validationErrorCount(itemResults),
        invalidIds: report.invalidIds,
        expectedRetailerIds: decision.items.map((item) => item.retailerId),
        mappedRetailerIds: found.map((row) => row.retailerId),
        jobHash: claim.job.payloadHash || decision.payloadHash,
        currentHash,
        jobCatalogId,
        activeCatalogId: freshConnection.catalogId,
      });
      if (outcome === "SYNC") {
        mappings = new Map(found.map((row) => [row.retailerId, row.metaProductId]));
        status = "SUCCEEDED";
        message = "Catalog batch processed. Meta review is separate from the offer status.";
      } else if (outcome === "STALE") {
        stale = true;
        status = "FAILED";
        message = STALE_BATCH_MESSAGE;
        if (jobCatalogId !== freshConnection.catalogId) await retireForeignCatalogMappings(opts.tenantId, freshConnection.catalogId);
      } else if (outcome === "REJECT") {
        status = "FAILED";
        message =
          validationErrorCount(itemResults) > 0
            ? "Meta returned catalog validation errors. The batch was not marked synced."
            : batchFailureMessage({ invalidIds: report.invalidIds, itemCount: decision.items.length });
      } else if (classified === "FAILED") {
        status = "FAILED";
        message = batchFailureMessage({ invalidIds: report.invalidIds, itemCount: decision.items.length });
      } else {
        status = classified === "SUCCEEDED" ? "PROCESSING" : classified;
        message =
          classified === "SUCCEEDED"
            ? "Meta finished the batch. Product ids are not confirmed yet."
            : classified === "PROCESSING"
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
  let externalProductId = "";
  if (opts.productId && product && status === "SUCCEEDED") {
    const applied = await applyConfirmedMappings({
      tenantId: opts.tenantId,
      productId: opts.productId,
      catalogId: jobCatalogId,
      payloadHash: claim.job.payloadHash || decision.payloadHash,
      publicUrl: jobPublicUrl,
      mappings,
      message,
      when: new Date(),
    });
    if (!applied.applied) {
      status = "FAILED";
      stale = true;
      message = STALE_BATCH_MESSAGE;
    } else {
      externalProductId = applied.externalProductId;
    }
  }
  const open = status === "SUBMITTED" || status === "PROCESSING";
  await rememberJob({
    jobId: claim.job.id,
    status,
    message,
    handle,
    items: itemResults,
    finished: status === "SUCCEEDED" || status === "FAILED",
    pollAttempts: open ? claim.job.pollAttempts + 1 : claim.job.pollAttempts,
    nextPollAt: open ? new Date(Date.now() + backoffMs(claim.job.pollAttempts)) : null,
  });

  const presentedStatus = stale ? "OUTDATED" : linkSyncStatus(status, decision.syncStatus);
  if (opts.productId && product && status !== "SUCCEEDED") {
    if (!stale) {
      const current = await prisma.commerceCatalogLink.findFirst({
        where: { productId: opts.productId, tenantId: opts.tenantId },
        select: { externalProductId: true, mappingCurrent: true },
      });
      externalProductId = current?.mappingCurrent === false ? "" : current?.externalProductId || "";
    }
    await prisma.commerceCatalogLink.updateMany({
      where: {
        productId: opts.productId,
        tenantId: opts.tenantId,
        ...(stale ? { syncStatus: { not: "SYNCED" } } : {}),
      },
      data: {
        syncStatus: presentedStatus,
        lastError: message,
        lastAttemptAt: new Date(),
      },
    });
  }

  await prisma.commerceSyncLog.create({
    data: {
      tenantId: opts.tenantId,
      productId: opts.productId,
      action: "CATALOG_SYNC",
      outcome: presentedStatus,
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
      syncStatus: presentedStatus,
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

async function applyConfirmedMappings(opts: {
  tenantId: string;
  productId: string;
  catalogId: string;
  payloadHash: string;
  publicUrl: string;
  mappings: Map<string, string>;
  message: string;
  when: Date;
}): Promise<{ applied: boolean; externalProductId: string }> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "CommerceProduct"
      WHERE "id" = ${opts.productId} AND "tenantId" = ${opts.tenantId}
      FOR UPDATE
    `;
    if (!locked.length) return { applied: false, externalProductId: "" };
    const row = await tx.commerceProduct.findFirst({
      where: { id: opts.productId, tenantId: opts.tenantId },
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
        variants: { select: { id: true, sku: true, name: true, unitPriceIdr: true, status: true } },
      },
    });
    const connection = await tx.commerceConnection.findUnique({
      where: { tenantId: opts.tenantId },
      select: { catalogId: true },
    });
    if (!row || !connection) return { applied: false, externalProductId: "" };
    const current = catalogItems({
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
    });
    const retailerIds = current.map((item) => item.retailerId);
    if (
      connection.catalogId !== opts.catalogId ||
      payloadHash(opts.catalogId, current, opts.publicUrl || null) !== opts.payloadHash ||
      !retailerIds.length ||
      !retailerIds.every((id) => opts.mappings.has(id))
    ) {
      return { applied: false, externalProductId: "" };
    }
    const parentId = opts.mappings.get(row.sku) || "";
    const wrote = await tx.commerceCatalogLink.updateMany({
      where: {
        productId: opts.productId,
        tenantId: opts.tenantId,
        OR: [
          { processedPayloadHash: "" },
          { processedPayloadHash: opts.payloadHash },
          { syncStatus: { not: "SYNCED" } },
        ],
      },
      data: {
        syncStatus: "SYNCED",
        lastError: opts.message,
        lastAttemptAt: opts.when,
        lastSyncedAt: opts.when,
        externalCatalogId: opts.catalogId,
        processedPayloadHash: opts.payloadHash,
        processedPublicUrl: opts.publicUrl,
        mappingCurrent: true,
        ...(parentId ? { externalProductId: parentId, metaProductId: parentId } : {}),
      },
    });
    if (wrote.count !== 1) return { applied: false, externalProductId: "" };
    for (const variant of row.variants) {
      const metaProductId = opts.mappings.get(variant.sku);
      if (!metaProductId) continue;
      await tx.commerceVariantMap.upsert({
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
          mappingCurrent: true,
          lastSyncedAt: opts.when,
        },
        update: {
          retailerId: variant.sku,
          externalProductId: metaProductId,
          metaProductId,
          syncStatus: "SYNCED",
          mappingCurrent: true,
          lastError: "",
          lastSyncedAt: opts.when,
        },
      });
    }
    return { applied: true, externalProductId: parentId };
  });
}

async function closePolledJob(job: { id: string; tenantId: string; productId: string | null }, status: "FAILED", message: string) {
  await rememberJob({ jobId: job.id, status, message, finished: true });
  if (!job.productId) return;
  await prisma.commerceCatalogLink.updateMany({
    where: {
      productId: job.productId,
      tenantId: job.tenantId,
      syncStatus: { in: ["SUBMITTED", "PROCESSING"] },
    },
    data: { syncStatus: "FAILED", lastError: scrubSecret(message), lastAttemptAt: new Date() },
  });
}

/** Continues batches that were already accepted. Does not start a new catalog push. */
export async function resumeCatalogBatches(opts: { tenantId?: string; fetchImpl?: FetchLike; now?: Date; limit?: number } = {}) {
  const now = opts.now ?? new Date();
  const due = await prisma.commerceSyncJob.findMany({
    where: {
      ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
      status: { in: ["SUBMITTED", "PROCESSING"] },
      batchHandle: { not: "" },
      OR: [{ nextPollAt: null }, { nextPollAt: { lte: now } }],
    },
    orderBy: { nextPollAt: "asc" },
    take: opts.limit ?? 10,
  });
  const results: { jobId: string; status: string }[] = [];
  for (const job of due) {
    const lockToken = randomBytes(8).toString("hex");
    const locked = await prisma.commerceSyncJob.updateMany({
      where: {
        id: job.id,
        status: { in: ["SUBMITTED", "PROCESSING"] },
        OR: [{ lockToken: "" }, { lockedAt: { lt: new Date(now.getTime() - LOCK_MS) } }],
      },
      data: { lockToken, lockedAt: now },
    });
    if (locked.count !== 1) continue;
    try {
      results.push(await pollLockedJob(job, opts.fetchImpl, now, lockToken));
    } finally {
      await prisma.commerceSyncJob.updateMany({
        where: { id: job.id, lockToken },
        data: { lockToken: "", lockedAt: null },
      });
    }
  }
  return results;
}

async function holdPollLock(jobId: string, lockToken: string) {
  const held = await prisma.commerceSyncJob.updateMany({
    where: { id: jobId, lockToken },
    data: { lockedAt: new Date() },
  });
  return held.count === 1;
}

async function pollLockedJob(
  job: {
    id: string;
    tenantId: string;
    productId: string | null;
    payloadHash: string;
    batchHandle: string;
    itemResults: string;
    catalogId: string;
    publicUrl: string;
    pollAttempts: number;
    createdAt: Date;
    status: string;
  },
  fetchImpl: FetchLike | undefined,
  now: Date,
  lockToken: string
) {
  if (!job.productId || !job.catalogId || job.pollAttempts >= MAX_POLLS || now.getTime() - job.createdAt.getTime() > MAX_JOB_MS) {
    await closePolledJob(job, "FAILED", POLL_STOPPED_MESSAGE);
    return { jobId: job.id, status: "FAILED" };
  }
  const loaded = await tokenFor(job.tenantId);
  if ("error" in loaded) {
    await closePolledJob(job, "FAILED", loaded.error);
    return { jobId: job.id, status: "FAILED" };
  }
  const product = await loadSyncProduct(job.tenantId, job.productId);
  if (!product) {
    await closePolledJob(job, "FAILED", "Product not found");
    return { jobId: job.id, status: "FAILED" };
  }
  let report;
  try {
    if (!(await holdPollLock(job.id, lockToken))) return { jobId: job.id, status: job.status };
    report = await checkBatchStatus({
      catalogId: job.catalogId,
      handle: job.batchHandle,
      token: loaded.token,
      fetchImpl,
    });
  } catch (error) {
    const attempts = job.pollAttempts + 1;
    const message = error instanceof Error ? error.message : "Catalog batch status failed";
    if (attempts >= MAX_POLLS) {
      await closePolledJob(job, "FAILED", message);
      return { jobId: job.id, status: "FAILED" };
    }
    await rememberJob({
      jobId: job.id,
      status: job.status === "SUBMITTED" ? "SUBMITTED" : "PROCESSING",
      message,
      pollAttempts: attempts,
      nextPollAt: new Date(now.getTime() + backoffMs(attempts)),
    });
    return { jobId: job.id, status: "PROCESSING" };
  }
  if (!(await holdPollLock(job.id, lockToken))) return { jobId: job.id, status: job.status };
  const fresh = await loadSyncProduct(job.tenantId, job.productId);
  if (!fresh) {
    await closePolledJob(job, "FAILED", "Product not found");
    return { jobId: job.id, status: "FAILED" };
  }
  const items = catalogItems(fresh);
  const classified = classifyBatchStatus(report);
  const found =
    classified === "SUCCEEDED"
      ? await lookupCatalogProducts({
          catalogId: job.catalogId,
          retailerIds: items.map((item) => item.retailerId),
          token: loaded.token,
          fetchImpl,
        })
      : [];
  if (!(await holdPollLock(job.id, lockToken))) return { jobId: job.id, status: job.status };
  const current = await loadSyncProduct(job.tenantId, job.productId);
  const currentConnection = await getCommerceConnection(job.tenantId);
  const currentItems = current ? catalogItems(current) : [];
  const mergedItems = mergeValidation(storedValidation(job.itemResults), report.items);
  const outcome = batchSyncDecision({
    classified,
    validationErrorCount: validationErrorCount(mergedItems),
    invalidIds: report.invalidIds,
    expectedRetailerIds: currentItems.map((item) => item.retailerId),
    mappedRetailerIds: found.map((row) => row.retailerId),
    jobHash: job.payloadHash,
    currentHash: current ? payloadHash(job.catalogId, currentItems, job.publicUrl || null) : "",
    jobCatalogId: job.catalogId,
    activeCatalogId: currentConnection.catalogId,
  });
  if (outcome === "SYNC") {
    const mappings = new Map(found.map((row) => [row.retailerId, row.metaProductId]));
    const message = "Catalog batch processed. Meta review is separate from the offer status.";
    const applied = await applyConfirmedMappings({
      tenantId: job.tenantId,
      productId: job.productId,
      catalogId: job.catalogId,
      payloadHash: job.payloadHash,
      publicUrl: job.publicUrl,
      mappings,
      message,
      when: now,
    });
    if (!applied.applied) {
      await rememberJob({ jobId: job.id, status: "FAILED", message: STALE_BATCH_MESSAGE, items: mergedItems, finished: true });
      await prisma.commerceCatalogLink.updateMany({
        where: { productId: job.productId, tenantId: job.tenantId, syncStatus: { not: "SYNCED" } },
        data: { syncStatus: "OUTDATED", lastError: STALE_BATCH_MESSAGE, lastAttemptAt: now },
      });
      return { jobId: job.id, status: "FAILED" };
    }
    await rememberJob({
      jobId: job.id,
      status: "SUCCEEDED",
      message,
      items: mergedItems,
      finished: true,
    });
    return { jobId: job.id, status: "SUCCEEDED" };
  }
  if (outcome === "STALE") {
    await rememberJob({ jobId: job.id, status: "FAILED", message: STALE_BATCH_MESSAGE, items: report.items, finished: true });
    await prisma.commerceCatalogLink.updateMany({
      where: { productId: job.productId, tenantId: job.tenantId, syncStatus: { not: "SYNCED" } },
      data: { syncStatus: "OUTDATED", lastError: STALE_BATCH_MESSAGE, lastAttemptAt: now },
    });
    if (job.catalogId !== currentConnection.catalogId) await retireForeignCatalogMappings(job.tenantId, currentConnection.catalogId);
    return { jobId: job.id, status: "FAILED" };
  }
  if (outcome === "REJECT") {
    const message =
      validationErrorCount(report.items) > 0
        ? "Meta returned catalog validation errors. The batch was not marked synced."
        : batchFailureMessage({ invalidIds: report.invalidIds, itemCount: items.length });
    await closePolledJob(job, "FAILED", message);
    return { jobId: job.id, status: "FAILED" };
  }
  const attempts = job.pollAttempts + 1;
  if (attempts >= MAX_POLLS) {
    await closePolledJob(job, "FAILED", POLL_STOPPED_MESSAGE);
    return { jobId: job.id, status: "FAILED" };
  }
  const nextStatus = classified === "SUCCEEDED" || classified === "PROCESSING" ? "PROCESSING" : "SUBMITTED";
  const waitMessage =
    classified === "SUCCEEDED"
      ? "Meta finished the batch. Product ids are not confirmed yet."
      : classified === "PROCESSING"
        ? "Catalog batch is still processing. Meta review has not started."
        : "Catalog batch submitted. Processing is not confirmed yet.";
  await rememberJob({
    jobId: job.id,
    status: nextStatus,
    message: waitMessage,
    items: mergedItems,
    pollAttempts: attempts,
    nextPollAt: new Date(now.getTime() + backoffMs(attempts)),
  });
  await prisma.commerceCatalogLink.updateMany({
    where: {
      productId: job.productId,
      tenantId: job.tenantId,
      syncStatus: { in: ["SUBMITTED", "PROCESSING"] },
    },
    data: { syncStatus: nextStatus, lastError: waitMessage, lastAttemptAt: now },
  });
  return { jobId: job.id, status: nextStatus };
}
