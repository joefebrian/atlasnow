import { createHash } from "crypto";
import type { ConnectionState } from "@/lib/commerce/connection";

const NOT_CONNECTED_MESSAGE = "Meta Catalog is not connected. No request was sent.";

export type CatalogItem = {
  retailerId: string;
  title: string;
  description: string;
  price: string;
  currency: "IDR";
  availability: "in stock" | "out of stock";
  imageUrl: string | null;
  condition: "new";
};

export type SyncProduct = {
  sku: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  hasImage: boolean;
  unitPriceIdr: number;
  status: string;
  availability: string;
  catalogEligibility: string;
  variants: { sku: string; name: string; unitPriceIdr: number | null; status: string }[];
};

const TICKET_CATEGORY = /ticket|event|admission|voucher/i;
const SYNC_STATUSES = new Set([
  "NOT_CONNECTED",
  "BLOCKED",
  "PREVIEWED",
  "PENDING",
  "SUBMITTED",
  "PROCESSING",
  "SYNCED",
  "FAILED",
  "OUTDATED",
]);
const REVIEW_STATUSES = new Set(["UNKNOWN", "PENDING", "APPROVED", "REJECTED"]);

export function syncStatusLabel(status: string): string {
  switch (status) {
    case "BLOCKED":
      return "Blocked";
    case "PREVIEWED":
      return "Preview only";
    case "PENDING":
      return "Pending";
    case "SUBMITTED":
      return "Submitted";
    case "PROCESSING":
      return "Processing";
    case "SYNCED":
      return "Synced";
    case "FAILED":
      return "Failed";
    case "OUTDATED":
      return "Needs another sync";
    default:
      return "Not connected";
  }
}

export function reviewStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Waiting on Meta";
    case "APPROVED":
      return "Meta approved";
    case "REJECTED":
      return "Meta rejected";
    default:
      return "Not reviewed by Meta";
  }
}

export function knownSyncStatus(status: string | undefined): string {
  return status && SYNC_STATUSES.has(status) ? status : "NOT_CONNECTED";
}

export function knownReviewStatus(status: string | undefined): string {
  return status && REVIEW_STATUSES.has(status) ? status : "UNKNOWN";
}

function item(opts: {
  retailerId: string;
  title: string;
  description: string;
  unitPriceIdr: number;
  availability: string;
  imageUrl: string | null;
}): CatalogItem {
  return {
    retailerId: opts.retailerId,
    title: opts.title,
    description: opts.description,
    price: `${opts.unitPriceIdr} IDR`,
    currency: "IDR",
    availability: opts.availability === "UNAVAILABLE" ? "out of stock" : "in stock",
    imageUrl: opts.imageUrl,
    condition: "new",
  };
}

/** AtlasNow SKUs become Meta retailer ids. Offer status is stock, not Meta review. */
export function catalogItems(product: SyncProduct): CatalogItem[] {
  const parent = item({
    retailerId: product.sku,
    title: product.name,
    description: product.description,
    unitPriceIdr: product.unitPriceIdr,
    availability: product.availability,
    imageUrl: product.imageUrl,
  });
  const variants = product.variants
    .filter((variant) => variant.status !== "ARCHIVED" && variant.sku)
    .map((variant) =>
      item({
        retailerId: variant.sku,
        title: variant.name || product.name,
        description: product.description,
        unitPriceIdr: variant.unitPriceIdr ?? product.unitPriceIdr,
        availability: product.availability,
        imageUrl: product.imageUrl,
      })
    );
  return [parent, ...variants];
}

/** Hash of every attribute the catalog request sends, including the public product URL. */
export function payloadHash(catalogId: string, items: CatalogItem[], publicUrl: string | null): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        catalogId,
        publicUrl: publicUrl || "",
        items: items.map((row) => ({
          retailerId: row.retailerId,
          title: row.title,
          description: row.description,
          price: row.price,
          currency: row.currency,
          availability: row.availability,
          imageUrl: row.imageUrl || "",
          condition: row.condition,
          link: publicUrl || "",
        })),
      })
    )
    .digest("hex");
}

export function syncBlockers(opts: {
  catalogState: ConnectionState;
  liveSwitch: boolean;
  product: SyncProduct;
  publicUrl: string | null;
}): string[] {
  const blockers: string[] = [];
  if (opts.catalogState !== "CONNECTED") blockers.push("Meta Catalog is not connected for this merchant.");
  if (!opts.liveSwitch) blockers.push("Live catalog push is off until the server switch is on.");
  if (opts.product.status === "ARCHIVED") blockers.push("Archived products stay archived and are not sent.");
  if (opts.product.catalogEligibility === "INELIGIBLE") blockers.push("This product is marked not for catalog.");
  if (opts.product.catalogEligibility !== "INELIGIBLE" && opts.product.catalogEligibility !== "UNKNOWN") {
    blockers.push("Catalog eligibility cannot be marked approved from AtlasNow.");
  }
  if (!Number.isInteger(opts.product.unitPriceIdr) || opts.product.unitPriceIdr < 0) {
    blockers.push("Price must be a whole rupiah amount.");
  }
  if (TICKET_CATEGORY.test(opts.product.category)) {
    blockers.push("This category needs a Meta eligibility check before sync.");
  }
  if (!opts.product.imageUrl) {
    blockers.push(
      opts.product.hasImage
        ? "Meta needs an https image URL. The uploaded photo stays in AtlasNow."
        : "Add an https image URL before a live sync."
    );
  }
  if (!opts.publicUrl) blockers.push("Meta requires an https product link. This product has no public URL yet.");
  const ids = catalogItems(opts.product).map((row) => row.retailerId.toLowerCase());
  if (new Set(ids).size !== ids.length) blockers.push("Each SKU can map to only one catalog item.");
  return blockers;
}

export type SyncDecision = {
  execute: boolean;
  syncStatus: "NOT_CONNECTED" | "BLOCKED" | "PENDING";
  message: string;
  networkCalled: false;
  items: CatalogItem[];
  blockers: string[];
  payloadHash: string;
};

export function decideCatalogSync(opts: {
  catalogState: ConnectionState;
  liveSwitch: boolean;
  catalogId: string;
  product: SyncProduct | null;
  publicUrl: string | null;
}): SyncDecision {
  if (!opts.product) {
    return {
      execute: false,
      syncStatus: "NOT_CONNECTED",
      message: NOT_CONNECTED_MESSAGE,
      networkCalled: false,
      items: [],
      blockers: ["Product not found"],
      payloadHash: "",
    };
  }
  const items = catalogItems(opts.product);
  const hash = payloadHash(opts.catalogId, items, opts.publicUrl);
  const disconnected = opts.catalogState === "NOT_CONNECTED" || opts.catalogState === "DISCONNECTED";
  const blockers = syncBlockers({
    catalogState: opts.catalogState,
    liveSwitch: opts.liveSwitch,
    product: opts.product,
    publicUrl: opts.publicUrl,
  });
  if (disconnected) {
    return {
      execute: false,
      syncStatus: "NOT_CONNECTED",
      message: NOT_CONNECTED_MESSAGE,
      networkCalled: false,
      items,
      blockers,
      payloadHash: hash,
    };
  }
  const execute = blockers.length === 0;
  return {
    execute,
    syncStatus: execute ? "PENDING" : "BLOCKED",
    message: execute ? "Ready to send." : blockers[0] || "Sync is blocked. No request was sent.",
    networkCalled: false,
    items,
    blockers,
    payloadHash: hash,
  };
}

export function batchBody(items: CatalogItem[], existingRetailerIds: Set<string>, link: string) {
  return {
    allow_upsert: true,
    requests: items.map((row) => ({
      method: existingRetailerIds.has(row.retailerId) ? "UPDATE" : "CREATE",
      data: {
        id: row.retailerId,
        title: row.title,
        description: row.description,
        availability: row.availability,
        condition: row.condition,
        price: row.price,
        currency: row.currency,
        link,
        ...(row.imageUrl ? { image_link: row.imageUrl } : {}),
      },
    })),
  };
}
