import { batchBody, catalogItems, decideCatalogSync, knownReviewStatus, type CatalogItem, type SyncProduct } from "@/lib/commerce/catalog-sync";
import { feedSchemaForVertical, localLocation, type FeedOutlet } from "@/lib/commerce/catalog-feed";
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

export function simulatedCatalogPublish(opts: {
  catalogState: ConnectionState;
  liveSwitch: boolean;
  catalogId: string;
  product: SyncProduct;
  /** Live route still passes null. The saved link is used only in the simulated batch. */
  storedPublicUrl: string | null;
  vertical: string;
  outlets: FeedOutlet[];
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
  const decision = decideCatalogSync({
    catalogState: opts.catalogState,
    liveSwitch: opts.liveSwitch,
    catalogId: opts.catalogId,
    product: opts.product,
    publicUrl: null,
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
  const blockers = [...decision.blockers];
  for (const row of methods) {
    if (row.reason) blockers.push(row.reason);
  }
  let extras: Record<string, Record<string, string>> | undefined;
  if (schema.schema === "unsupported") blockers.push(schema.note);
  if (schema.schema === "local") {
    const location = localLocation(opts.outlets);
    if (!location.ok) blockers.push(location.message);
    else {
      extras = {};
      for (const item of decision.items) {
        extras[item.retailerId] = {
          address: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
        };
      }
    }
  }
  const localFailed = schema.schema === "local" && !extras;
  const blocked = methods.some((row) => row.method === "BLOCKED") || schema.schema === "unsupported" || localFailed;
  const storedLink = opts.storedPublicUrl?.startsWith("https://") ? opts.storedPublicUrl : "";
  const batch = blocked
    ? null
    : batchBody(catalogItems(opts.product), updateRetailerIds(methods), storedLink, extras);
  const parent = opts.parent;
  return {
    networkCalled: false,
    liveSyncEnabled: opts.liveSwitch,
    wouldSend: false,
    syncStatus: decision.syncStatus,
    message: decision.message,
    blockers,
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
