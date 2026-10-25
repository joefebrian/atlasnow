import { batchBody, catalogItems, decideCatalogSync, knownReviewStatus, type CatalogItem, type SyncProduct } from "@/lib/commerce/catalog-sync";
import { feedSchemaForVertical, productLocalValues, type FeedOutlet, type LocalFeedArea } from "@/lib/commerce/catalog-feed";
import type { ConnectionState } from "@/lib/commerce/connection";

/** Publish plan for a preview. This module does not call Graph and does not mark a product synced. */

export type PublishMapping = {
  retailerId: string;
  externalProductId: string;
  mappingCurrent: boolean;
  externalCatalogId?: string;
  metaProductId?: string;
};

export type PublishMethod = {
  retailerId: string;
  method: "CREATE" | "UPDATE" | "BLOCKED";
  reason: string;
};

const DIFF_FIELDS = ["name", "description", "unitPriceIdr", "availability", "imageUrl"] as const;

export type FieldDiff = {
  field: (typeof DIFF_FIELDS)[number];
  imported: string;
  current: string;
  changed: boolean;
};

export function importSnapshot(opts: {
  name: string;
  description: string;
  unitPriceIdr: number;
  availability: string;
  imageUrl: string | null;
}): string {
  return JSON.stringify({
    name: opts.name,
    description: opts.description,
    unitPriceIdr: opts.unitPriceIdr,
    availability: opts.availability,
    imageUrl: opts.imageUrl || "",
  });
}

export function catalogFieldDiffs(
  current: { name: string; description: string; unitPriceIdr: number; availability: string; imageUrl: string | null },
  snapshotRaw: string
): { hasSnapshot: boolean; diffs: FieldDiff[] } {
  if (!snapshotRaw.trim()) return { hasSnapshot: false, diffs: [] };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(snapshotRaw) as Record<string, unknown>;
  } catch {
    return { hasSnapshot: false, diffs: [] };
  }
  const imported = {
    name: String(parsed.name || ""),
    description: String(parsed.description || ""),
    unitPriceIdr: String(parsed.unitPriceIdr ?? ""),
    availability: String(parsed.availability || ""),
    imageUrl: String(parsed.imageUrl || ""),
  };
  const now = {
    name: current.name,
    description: current.description,
    unitPriceIdr: String(current.unitPriceIdr),
    availability: current.availability,
    imageUrl: current.imageUrl || "",
  };
  return {
    hasSnapshot: true,
    diffs: DIFF_FIELDS.map((field) => ({
      field,
      imported: imported[field],
      current: now[field],
      changed: imported[field] !== now[field],
    })),
  };
}

export function publishMethods(opts: {
  catalogId: string;
  parentSku: string;
  variantSkus: string[];
  parent: PublishMapping | null;
  variants: PublishMapping[];
}): PublishMethod[] {
  const methods: PublishMethod[] = [parentMethod(opts.parentSku, opts.parent, opts.catalogId)];
  for (const sku of opts.variantSkus) {
    const map = opts.variants.find((row) => row.retailerId === sku) || null;
    methods.push(variantMethod(sku, map));
  }
  return methods;
}

function parentMethod(sku: string, link: PublishMapping | null, catalogId: string): PublishMethod {
  if (!link || !link.externalProductId || link.mappingCurrent === false) {
    return { retailerId: sku, method: "CREATE", reason: "" };
  }
  if (link.externalCatalogId && catalogId && link.externalCatalogId !== catalogId) {
    return {
      retailerId: sku,
      method: "BLOCKED",
      reason: "Stored Meta ids belong to another catalog. No catalog item was changed.",
    };
  }
  if (link.retailerId !== sku) {
    return {
      retailerId: sku,
      method: "BLOCKED",
      reason: "SKU does not match the stored Meta retailer id. No catalog item was changed.",
    };
  }
  return { retailerId: sku, method: "UPDATE", reason: "" };
}

function variantMethod(sku: string, link: PublishMapping | null): PublishMethod {
  if (!link || !link.externalProductId || link.mappingCurrent === false) {
    return { retailerId: sku, method: "CREATE", reason: "" };
  }
  if (link.retailerId !== sku) {
    return {
      retailerId: sku,
      method: "BLOCKED",
      reason: "SKU does not match the stored Meta retailer id. No catalog item was changed.",
    };
  }
  return { retailerId: sku, method: "UPDATE", reason: "" };
}

export function updateRetailerIds(methods: PublishMethod[]): Set<string> {
  return new Set(methods.filter((row) => row.method === "UPDATE").map((row) => row.retailerId));
}

const EXECUTION_LABELS = new Set([
  "Meta Catalog is not connected for this merchant.",
  "Live catalog push is off until the server switch is on.",
]);

export const PREVIEW_SEND_BLOCK =
  "The live catalog route does not read the saved product link, so this preview does not send.";

export function simulatedCatalogPublish(opts: {
  catalogState: ConnectionState;
  liveSwitch: boolean;
  catalogId: string;
  product: SyncProduct;
  /** Saved https link. The live route still ignores it. */
  storedPublicUrl: string | null;
  vertical: string;
  outlets: FeedOutlet[];
  /** Explicit circle. Outlet coordinates are not a substitute. */
  localArea?: LocalFeedArea | null;
  parent: PublishMapping | null;
  variants: PublishMapping[];
  snapshot: string;
  reviewStatus: string;
  lastImportedAt: string | null;
  lastSyncedAt: string | null;
}): {
  networkCalled: false;
  liveSyncEnabled: boolean;
  wouldSend: false;
  syncStatus: string;
  message: string;
  blockers: string[];
  productBlockers: string[];
  executionBlockers: string[];
  readiness: string;
  items: CatalogItem[];
  methods: { retailerId: string; method: "CREATE" | "UPDATE" | "BLOCKED" }[];
  batch: ReturnType<typeof batchBody> | null;
  diffs: FieldDiff[];
  hasSnapshot: boolean;
  source: "META" | "ATLASNOW";
  reviewStatus: string;
  lastImportedAt: string | null;
  lastSyncedAt: string | null;
  mappings: { retailerId: string; externalProductId: string; metaProductId: string; externalCatalogId: string };
  acceptanceNote: string;
  schemaNote: string;
} {
  const storedLink = opts.storedPublicUrl?.startsWith("https://") ? opts.storedPublicUrl : null;
  const decision = decideCatalogSync({
    catalogState: opts.catalogState,
    liveSwitch: opts.liveSwitch,
    catalogId: opts.catalogId,
    product: opts.product,
    publicUrl: storedLink,
  });
  const compared = catalogFieldDiffs(opts.product, opts.snapshot);
  const methods = publishMethods({
    catalogId: opts.catalogId,
    parentSku: opts.product.sku,
    variantSkus: opts.product.variants.filter((row) => row.status !== "ARCHIVED" && row.sku).map((row) => row.sku),
    parent: opts.parent,
    variants: opts.variants,
  });
  const schema = feedSchemaForVertical(opts.vertical);
  const productBlockers = decision.blockers.filter((row) => !EXECUTION_LABELS.has(row));
  const executionBlockers = decision.blockers.filter((row) => EXECUTION_LABELS.has(row));
  for (const row of methods) {
    if (row.reason) executionBlockers.push(row.reason);
  }
  let extras: Record<string, Record<string, string>> | undefined;
  if (schema.schema === "unsupported" || schema.schema === "unverified") executionBlockers.push(schema.note);
  if (schema.schema === "local") {
    const located = productLocalValues({ sku: opts.product.sku, localArea: opts.localArea, outlets: opts.outlets });
    if (!located.ok) {
      for (const issue of located.issues) executionBlockers.push(issue.message);
    } else {
      extras = {};
      for (const item of decision.items) extras[item.retailerId] = located.values;
    }
  }
  executionBlockers.push(PREVIEW_SEND_BLOCK);
  const localFailed = schema.schema === "local" && !extras;
  const schemaBlocked = schema.schema === "unsupported" || schema.schema === "unverified";
  const blocked =
    productBlockers.length > 0 ||
    methods.some((row) => row.method === "BLOCKED") ||
    schemaBlocked ||
    localFailed;
  const batch = blocked
    ? null
    : batchBody(catalogItems(opts.product), updateRetailerIds(methods), storedLink || "", extras);
  const productReady = productBlockers.length === 0;
  const parent = opts.parent;
  return {
    networkCalled: false,
    liveSyncEnabled: opts.liveSwitch,
    wouldSend: false,
    syncStatus: decision.syncStatus === "NOT_CONNECTED" && productReady ? "NOT_CONNECTED" : "BLOCKED",
    message: productReady ? "Product data is ready. No request was sent." : "Product data is incomplete.",
    blockers: productBlockers,
    productBlockers,
    executionBlockers,
    readiness: productReady ? "Product data is ready. Live send stays off." : "Blocked by product data.",
    items: decision.items,
    methods: methods.map((row) => ({ retailerId: row.retailerId, method: row.method })),
    batch,
    diffs: compared.diffs,
    hasSnapshot: compared.hasSnapshot,
    source: opts.lastImportedAt ? "META" : "ATLASNOW",
    reviewStatus: knownReviewStatus(opts.reviewStatus),
    lastImportedAt: opts.lastImportedAt,
    lastSyncedAt: opts.lastSyncedAt,
    mappings: {
      retailerId: parent?.retailerId || opts.product.sku,
      externalProductId: parent?.mappingCurrent === false ? "" : parent?.externalProductId || "",
      metaProductId: parent?.mappingCurrent === false ? "" : parent?.metaProductId || "",
      externalCatalogId: parent?.externalCatalogId || "",
    },
    acceptanceNote: "A Meta batch acceptance is not a Meta product approval.",
    schemaNote: schema.note,
  };
}
