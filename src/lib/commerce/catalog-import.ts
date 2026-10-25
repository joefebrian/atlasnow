import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { importSnapshot } from "@/lib/commerce/catalog-publish";
import { GraphError, listCatalogItems, type RemoteCatalogRow } from "@/lib/commerce/meta-graph";
import { decryptSecret } from "@/lib/google/crypto";

const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_PRICE = 1_000_000_000;

export type ImportMapping = "META_ONLY" | "IMPORTED" | "CONFLICT";
export type MappedReview = "UNKNOWN" | "PENDING" | "APPROVED" | "REJECTED";

export type CatalogPreviewItem = {
  metaProductId: string;
  retailerId: string;
  name: string;
  description: string;
  priceLabel: string;
  unitPriceIdr: number | null;
  currency: string;
  availability: string;
  imageUrl: string | null;
  reviewStatus: string;
  mappedReview: MappedReview;
  groupId: string;
  variantBlocked: boolean;
  missing: string[];
  mapping: ImportMapping;
  importable: boolean;
  note: string;
  atlasPriceIdr: number | null;
  lastImportedAt: string | null;
  lastSyncedAt: string | null;
};

type LocalSku = {
  sku: string;
  kind: "product" | "variant";
  productId: string;
  unitPriceIdr: number;
  metaProductId: string;
  catalogId: string;
  mappingCurrent: boolean;
  lastImportedAt: Date | null;
  lastSyncedAt: Date | null;
};

/** Import stays off for every merchant unless this tenant id is listed. An empty list allows nobody. */
export function catalogImportEnabled(tenantId: string): boolean {
  if (process.env.COMMERCE_CATALOG_IMPORT_ENABLED !== "true") return false;
  const allowed = (process.env.COMMERCE_CATALOG_IMPORT_TENANTS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return allowed.includes(tenantId);
}

export function parseIdrAmount(price: string, currency: string): number | null {
  const code = currency.trim().toUpperCase();
  let text = price.trim();
  if (!text) return null;
  const suffix = text.match(/^(.+?)\s+([A-Za-z]{3})$/);
  let amount = text;
  let seen = code;
  if (suffix) {
    amount = suffix[1].trim();
    seen = suffix[2].toUpperCase();
  }
  if (seen && seen !== "IDR") return null;
  if (!seen && !code) return null;
  if (amount.startsWith("Rp")) amount = amount.slice(2).trim();
  amount = amount.replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(amount)) amount = amount.replace(/\./g, "");
  amount = amount.replace(/,/g, "");
  if (!/^\d+(\.0+)?$/.test(amount)) return null;
  const whole = Number(amount.split(".")[0]);
  if (!Number.isSafeInteger(whole) || whole < 0 || whole > MAX_PRICE) return null;
  return whole;
}

function mappedReview(value: string): MappedReview {
  if (value === "approved") return "APPROVED";
  if (value === "pending") return "PENDING";
  if (value === "rejected") return "REJECTED";
  return "UNKNOWN";
}

function httpsImage(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || value.length > 2000) return null;
    return value;
  } catch {
    return null;
  }
}

function markGroups(rows: RemoteCatalogRow[]): Array<RemoteCatalogRow & { variantBlocked: boolean; duplicateRetailer: boolean }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.groupId) continue;
    counts.set(row.groupId, (counts.get(row.groupId) || 0) + 1);
  }
  const retailers = new Map<string, number>();
  for (const row of rows) {
    const key = row.retailerId.toLowerCase();
    if (!key) continue;
    retailers.set(key, (retailers.get(key) || 0) + 1);
  }
  return rows.map((row) => ({
    ...row,
    variantBlocked: row.variantKeys.length > 0 || Boolean(row.groupId && (counts.get(row.groupId) || 0) > 1),
    duplicateRetailer: Boolean(row.retailerId && (retailers.get(row.retailerId.toLowerCase()) || 0) > 1),
  }));
}

export function previewCatalogItem(
  row: RemoteCatalogRow & { variantBlocked?: boolean; duplicateRetailer?: boolean },
  local: LocalSku[],
  catalogId: string
): CatalogPreviewItem {
  const currency = row.currency || (/\s[A-Za-z]{3}$/.test(row.price) ? row.price.slice(-3).toUpperCase() : "");
  const unitPriceIdr = parseIdrAmount(row.price, currency || "IDR");
  const missing: string[] = [];
  if (!row.retailerId) missing.push("retailer id");
  else if (!SKU.test(row.retailerId)) missing.push("retailer id format");
  if (!row.name) missing.push("name");
  if (unitPriceIdr == null) missing.push("IDR price");
  const variantBlocked = Boolean(row.variantBlocked) || row.variantKeys.length > 0;
  const duplicateRetailer = Boolean(row.duplicateRetailer);
  const folded = row.retailerId.toLowerCase();
  const matches = local.filter((item) => item.sku.toLowerCase() === folded);
  const product = matches.find((item) => item.kind === "product");
  const variant = matches.find((item) => item.kind === "variant");
  let mapping: ImportMapping = "META_ONLY";
  let note = "";
  if (!row.retailerId) {
    mapping = "META_ONLY";
  } else if (variant && !product) {
    mapping = "CONFLICT";
    note = "This retailer id is already a variant SKU.";
  } else if (matches.filter((item) => item.kind === "product").length > 1) {
    mapping = "CONFLICT";
    note = "More than one product uses this SKU.";
  } else if (product) {
    const sameItem =
      product.mappingCurrent &&
      product.metaProductId === row.id &&
      product.catalogId === catalogId &&
      product.metaProductId !== "";
    mapping = sameItem ? "IMPORTED" : "CONFLICT";
    if (!sameItem) note = "This SKU already exists. AtlasNow was not changed.";
    else if (product.unitPriceIdr !== unitPriceIdr && unitPriceIdr != null) {
      note = "Imported. The product master price was kept.";
    }
  }
  if (duplicateRetailer) {
    note = "More than one Meta item uses this retailer id.";
  } else if (variantBlocked && mapping === "META_ONLY") {
    note = "This Meta item has variants. Only a single product can be imported.";
  }
  const importable =
    mapping === "META_ONLY" && missing.length === 0 && !variantBlocked && !duplicateRetailer && Boolean(row.id);
  return {
    metaProductId: row.id,
    retailerId: row.retailerId,
    name: row.name,
    description: row.description.slice(0, 4000),
    priceLabel: row.price,
    unitPriceIdr,
    currency: currency || (unitPriceIdr != null ? "IDR" : ""),
    availability: row.availability,
    imageUrl: httpsImage(row.imageUrl),
    reviewStatus: row.reviewStatus,
    mappedReview: mappedReview(row.reviewStatus),
    groupId: row.groupId,
    variantBlocked,
    missing,
    mapping,
    importable,
    note,
    atlasPriceIdr: product?.unitPriceIdr ?? null,
    lastImportedAt: product?.lastImportedAt?.toISOString() ?? null,
    lastSyncedAt: product?.lastSyncedAt?.toISOString() ?? null,
  };
}

async function loadLocalSkus(tenantId: string): Promise<LocalSku[]> {
  const [products, variants] = await Promise.all([
    prisma.commerceProduct.findMany({
      where: { tenantId },
      select: {
        id: true,
        sku: true,
        unitPriceIdr: true,
        catalogLink: {
          select: {
            metaProductId: true,
            externalCatalogId: true,
            mappingCurrent: true,
            lastImportedAt: true,
            lastSyncedAt: true,
          },
        },
      },
    }),
    prisma.commerceVariant.findMany({
      where: { tenantId },
      select: { sku: true, productId: true, unitPriceIdr: true, product: { select: { unitPriceIdr: true } } },
    }),
  ]);
  const rows: LocalSku[] = products.map((product) => ({
    sku: product.sku,
    kind: "product",
    productId: product.id,
    unitPriceIdr: product.unitPriceIdr,
    metaProductId: product.catalogLink?.metaProductId || "",
    catalogId: product.catalogLink?.externalCatalogId || "",
    mappingCurrent: product.catalogLink?.mappingCurrent !== false,
    lastImportedAt: product.catalogLink?.lastImportedAt || null,
    lastSyncedAt: product.catalogLink?.lastSyncedAt || null,
  }));
  for (const variant of variants) {
    rows.push({
      sku: variant.sku,
      kind: "variant",
      productId: variant.productId,
      unitPriceIdr: variant.unitPriceIdr ?? variant.product.unitPriceIdr,
      metaProductId: "",
      catalogId: "",
      mappingCurrent: false,
      lastImportedAt: null,
      lastSyncedAt: null,
    });
  }
  return rows;
}

async function connectedCatalog(tenantId: string): Promise<
  | { ok: true; catalogId: string; token: string }
  | { ok: false; status: number; error: string }
> {
  const row = await prisma.commerceConnection.findUnique({ where: { tenantId } });
  if (!row?.tokenEnc || row.disconnectedAt || !row.catalogId) {
    return { ok: false, status: 400, error: "Link a Meta catalog before reading products." };
  }
  if (row.tokenExpiresAt && row.tokenExpiresAt.getTime() <= Date.now()) {
    return { ok: false, status: 401, error: "Meta token expired. Connect again." };
  }
  try {
    return { ok: true, catalogId: row.catalogId, token: decryptSecret(row.tokenEnc) };
  } catch {
    return { ok: false, status: 400, error: "Stored Meta credential could not be read." };
  }
}

function graphFailure(error: unknown): { ok: false; status: number; error: string } {
  if (error instanceof GraphError) {
    return { ok: false, status: error.permission ? 403 : 502, error: error.message };
  }
  return { ok: false, status: 502, error: "Meta catalog could not be read." };
}

export async function listMetaCatalogProducts(tenantId: string, fetchImpl: typeof fetch = fetch) {
  if (!tenantId) return { ok: false as const, status: 400, error: "Pick a brand" };
  if (!catalogImportEnabled(tenantId)) {
    return { ok: true as const, enabled: false as const, catalogId: "", products: [] as CatalogPreviewItem[], truncated: false };
  }
  const connected = await connectedCatalog(tenantId);
  if (!connected.ok) return connected;
  let listed: { items: RemoteCatalogRow[]; truncated: boolean };
  try {
    listed = await listCatalogItems(connected.catalogId, connected.token, fetchImpl);
  } catch (error) {
    return graphFailure(error);
  }
  const local = await loadLocalSkus(tenantId);
  const products = markGroups(listed.items)
    .filter((row) => row.id)
    .map((row) => previewCatalogItem(row, local, connected.catalogId));
  console.info(
    JSON.stringify({
      source: "commerce.import",
      outcome: "list",
      tenantId,
      catalogId: connected.catalogId,
      count: products.length,
      truncated: listed.truncated,
    })
  );
  return {
    ok: true as const,
    enabled: true as const,
    catalogId: connected.catalogId,
    products,
    truncated: listed.truncated,
  };
}

async function createImportedProduct(tenantId: string, catalogId: string, item: CatalogPreviewItem) {
  if (item.unitPriceIdr == null) throw new Error("missing price");
  return prisma.commerceProduct.create({
    data: {
      tenantId,
      sku: item.retailerId,
      name: item.name.slice(0, 160),
      description: item.description,
      imageUrl: item.imageUrl,
      unitPriceIdr: item.unitPriceIdr,
      status: "ACTIVE",
      availability: item.availability === "in stock" ? "AVAILABLE" : "UNAVAILABLE",
      catalogEligibility: "UNKNOWN",
      catalogLink: {
        create: {
          tenantId,
          externalProductId: item.metaProductId,
          externalCatalogId: catalogId,
          metaProductId: item.metaProductId,
          retailerId: item.retailerId,
          syncStatus: "IMPORTED",
          reviewStatus: item.mappedReview,
          mappingCurrent: true,
          lastImportedAt: new Date(),
          sourceSnapshot: importSnapshot({
            name: item.name.slice(0, 160),
            description: item.description,
            unitPriceIdr: item.unitPriceIdr,
            availability: item.availability === "in stock" ? "AVAILABLE" : "UNAVAILABLE",
            imageUrl: item.imageUrl,
          }),
          lastError: "",
        },
      },
    },
    select: { id: true },
  });
}

export async function importMetaCatalogProducts(opts: {
  tenantId: string;
  retailerIds: string[];
  catalogId?: string;
  fetchImpl?: typeof fetch;
}) {
  if (!opts.tenantId) return { ok: false as const, status: 400, error: "Pick a brand" };
  if (!catalogImportEnabled(opts.tenantId)) return { ok: false as const, status: 503, error: "Catalog import is off." };
  const wanted = [...new Set(opts.retailerIds.map((id) => id.trim()).filter(Boolean))].slice(0, 40);
  if (!wanted.length) return { ok: false as const, status: 400, error: "Choose a Meta product to import." };
  const connected = await connectedCatalog(opts.tenantId);
  if (!connected.ok) return connected;
  if (opts.catalogId && opts.catalogId !== connected.catalogId) {
    return { ok: false as const, status: 409, error: "The connected catalog changed. Load the products again." };
  }
  let listed: { items: RemoteCatalogRow[]; truncated: boolean };
  try {
    listed = await listCatalogItems(connected.catalogId, connected.token, opts.fetchImpl);
  } catch (error) {
    return graphFailure(error);
  }
  const local = await loadLocalSkus(opts.tenantId);
  const preview = new Map(
    markGroups(listed.items).map((row) => [row.retailerId, previewCatalogItem(row, local, connected.catalogId)])
  );
  const results: { retailerId: string; outcome: "created" | "already_imported" | "conflict" | "blocked"; productId: string }[] = [];
  for (const retailerId of wanted) {
    const item = preview.get(retailerId);
    if (!item || item.mapping === "CONFLICT" || !item.importable && item.mapping !== "IMPORTED") {
      results.push({
        retailerId,
        outcome: item?.mapping === "CONFLICT" ? "conflict" : "blocked",
        productId: "",
      });
      continue;
    }
    if (item.mapping === "IMPORTED") {
      const match = local.find((row) => row.kind === "product" && row.sku.toLowerCase() === retailerId.toLowerCase());
      results.push({ retailerId, outcome: "already_imported", productId: match?.productId || "" });
      continue;
    }
    try {
      const created = await createImportedProduct(opts.tenantId, connected.catalogId, item);
      results.push({ retailerId, outcome: "created", productId: created.id });
      local.push({
        sku: item.retailerId,
        kind: "product",
        productId: created.id,
        unitPriceIdr: item.unitPriceIdr || 0,
        metaProductId: item.metaProductId,
        catalogId: connected.catalogId,
        mappingCurrent: true,
        lastImportedAt: new Date(),
        lastSyncedAt: null,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const again = await loadLocalSkus(opts.tenantId);
      const existing = again.find((row) => row.kind === "product" && row.sku.toLowerCase() === retailerId.toLowerCase());
      const same =
        existing &&
        existing.mappingCurrent &&
        existing.metaProductId === item.metaProductId &&
        existing.catalogId === connected.catalogId;
      results.push({
        retailerId,
        outcome: same ? "already_imported" : "conflict",
        productId: same ? existing?.productId || "" : "",
      });
    }
  }
  console.info(
    JSON.stringify({
      source: "commerce.import",
      outcome: "import",
      tenantId: opts.tenantId,
      catalogId: connected.catalogId,
      created: results.filter((row) => row.outcome === "created").length,
      alreadyImported: results.filter((row) => row.outcome === "already_imported").length,
      conflict: results.filter((row) => row.outcome === "conflict").length,
      blocked: results.filter((row) => row.outcome === "blocked").length,
    })
  );
  return { ok: true as const, catalogId: connected.catalogId, results };
}
