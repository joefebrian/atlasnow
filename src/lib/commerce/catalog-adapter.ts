import { knownReviewStatus, knownSyncStatus } from "@/lib/commerce/catalog-sync";

/** Product save still uses this plan and does not call Graph. Live push lives in the gated sync path. */

export const CATALOG_NOT_CONNECTED_MESSAGE =
  "Meta Catalog is not connected. No request was sent.";

export type CatalogSyncPlan = {
  syncStatus: "NOT_CONNECTED";
  externalProductId: "";
  networkCalled: false;
  message: string;
};

export function planCatalogSync(): CatalogSyncPlan {
  return {
    syncStatus: "NOT_CONNECTED",
    externalProductId: "",
    networkCalled: false,
    message: CATALOG_NOT_CONNECTED_MESSAGE,
  };
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

/** Shows the stored sync attempt. Review status is Meta's, and this function never invents an approval. */
export function presentCatalog(
  link: {
    retailerId: string;
    lastError: string;
    syncStatus?: string;
    externalProductId?: string;
    reviewStatus?: string;
    lastImportedAt?: Date | string | null;
    lastSyncedAt?: Date | string | null;
    mappingCurrent?: boolean;
  } | null,
  sku: string
) {
  const historical = link?.mappingCurrent === false;
  return {
    syncStatus: historical ? "OUTDATED" : knownSyncStatus(link?.syncStatus),
    externalProductId: historical ? "" : link?.externalProductId || "",
    retailerId: link?.retailerId || sku,
    lastError: link?.lastError || "",
    reviewStatus: knownReviewStatus(link?.reviewStatus),
    lastImportedAt: iso(link?.lastImportedAt),
    lastSyncedAt: iso(link?.lastSyncedAt),
    source: link?.lastImportedAt ? ("META" as const) : ("ATLASNOW" as const),
    networkCalled: false as const,
  };
}
