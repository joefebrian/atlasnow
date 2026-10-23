import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/auth";
import { productListWhere } from "@/lib/commerce/access";
import { planCatalogSync, presentCatalog } from "@/lib/commerce/catalog-adapter";
import { catalogItems, payloadHash } from "@/lib/commerce/catalog-sync";
import { requestCatalogSync } from "@/lib/commerce/connection-service";
import { presentStoredReadiness, readinessWriteData } from "@/lib/commerce/readiness";
import { collectSkus, decideProductUpdate, foreignOutlets, type ProductInput } from "@/lib/commerce/validate";

class ProductConflict extends Error {
  status = 409 as const;
  constructor(message: string) {
    super(message);
  }
}

const productSelect = {
  id: true,
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
  catalogEligibilityNote: true,
  archivedAt: true,
  updatedAt: true,
  variants: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      sku: true,
      name: true,
      unitPriceIdr: true,
      status: true,
      sortOrder: true,
    },
  },
  outlets: {
    orderBy: { location: { name: "asc" as const } },
    select: {
      locationId: true,
      availability: true,
      location: { select: { id: true, name: true } },
    },
  },
  catalogLink: {
    select: {
      retailerId: true,
      lastError: true,
      syncStatus: true,
      externalProductId: true,
      reviewStatus: true,
      lastSyncedAt: true,
    },
  },
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  imageMime: string;
  unitPriceIdr: number;
  status: string;
  availability: string;
  catalogEligibility: string;
  catalogEligibilityNote: string;
  archivedAt: Date | null;
  updatedAt: Date;
  variants: {
    id: string;
    sku: string;
    name: string;
    unitPriceIdr: number | null;
    status: string;
    sortOrder: number;
  }[];
  outlets: { locationId: string; availability: string; location: { id: string; name: string } }[];
  catalogLink: {
    retailerId: string;
    lastError: string;
    syncStatus: string;
    externalProductId: string;
    reviewStatus: string;
    lastSyncedAt: Date | null;
  } | null;
};

export function presentProduct(row: ProductRow) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
    imageUrl: row.imageUrl,
    hasImage: Boolean(row.imageMime),
    unitPriceIdr: row.unitPriceIdr,
    status: row.status,
    availability: row.availability,
    catalogEligibility: row.catalogEligibility === "INELIGIBLE" ? "INELIGIBLE" : "UNKNOWN",
    catalogEligibilityNote: row.catalogEligibilityNote,
    archivedAt: row.archivedAt,
    updatedAt: row.updatedAt.toISOString(),
    variants: row.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      unitPriceIdr: variant.unitPriceIdr,
      status: variant.status,
      sortOrder: variant.sortOrder,
    })),
    outlets: row.outlets.map((outlet) => ({
      locationId: outlet.locationId,
      name: outlet.location.name,
      availability: outlet.availability === "UNAVAILABLE" ? "UNAVAILABLE" : "AVAILABLE",
    })),
    catalog: presentCatalog(row.catalogLink, row.sku),
  };
}

async function skuTaken(tenantId: string, skus: string[], exceptProductId?: string) {
  const [products, variants] = await Promise.all([
    prisma.commerceProduct.findMany({
      where: {
        tenantId,
        ...(exceptProductId ? { id: { not: exceptProductId } } : {}),
      },
      select: { sku: true },
    }),
    prisma.commerceVariant.findMany({
      where: {
        tenantId,
        ...(exceptProductId ? { productId: { not: exceptProductId } } : {}),
      },
      select: { sku: true },
    }),
  ]);
  const owned = new Set([...products, ...variants].map((row) => row.sku.toLowerCase()));
  return skus.filter((sku) => owned.has(sku.toLowerCase()));
}

export async function listStoreLocations(tenantId: string) {
  return prisma.location.findMany({
    where: { tenantId, status: { not: "ARCHIVED" }, kind: { not: "HQ" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function listCommerceProducts(tenantId: string, status: "ACTIVE" | "ARCHIVED" | "ALL") {
  const rows = await prisma.commerceProduct.findMany({
    where: productListWhere(tenantId, status),
    select: productSelect,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  return rows.map((row) => presentProduct(row));
}

async function writeProduct(
  tenantId: string,
  input: ProductInput,
  productId?: string,
  expectedUpdatedAt?: unknown
) {
  const locations = await listStoreLocations(tenantId);
  const foreign = foreignOutlets(input.outlets, new Set(locations.map((location) => location.id)));
  if (foreign) return { ok: false as const, status: 400, error: foreign };

  const taken = await skuTaken(tenantId, collectSkus(input), productId);
  if (taken.length > 0) {
    return { ok: false as const, status: 409, error: `SKU already used: ${taken[0]}` };
  }

  const plan = planCatalogSync();
  if (plan.networkCalled) {
    return { ok: false as const, status: 409, error: plan.message };
  }

  const data = {
    sku: input.sku,
    name: input.name,
    description: input.description,
    category: input.category,
    imageUrl: input.imageUrl,
    unitPriceIdr: input.unitPriceIdr,
    status: input.status,
    availability: input.availability,
    catalogEligibility: input.catalogEligibility,
    catalogEligibilityNote: input.catalogEligibilityNote,
    archivedAt: input.status === "ARCHIVED" ? new Date() : null,
  };

  const variantCreate = input.variants.map((variant, index) => ({
    tenantId,
    sku: variant.sku,
    name: variant.name,
    unitPriceIdr: variant.unitPriceIdr,
    status: variant.status,
    sortOrder: index,
  }));
  const outletCreate = input.outlets.map((outlet) => ({
    tenantId,
    locationId: outlet.locationId,
    availability: outlet.availability,
  }));

  const row = await prisma.$transaction(async (tx) => {
    if (!productId) {
      return tx.commerceProduct.create({
        data: {
          tenantId,
          ...data,
          variants: { create: variantCreate },
          outlets: { create: outletCreate },
          catalogLink: {
            create: {
              tenantId,
              externalProductId: "",
              retailerId: input.sku,
              syncStatus: "NOT_CONNECTED",
              lastError: "",
            },
          },
        },
        select: productSelect,
      });
    }

    const existing = await tx.commerceProduct.findFirst({
      where: { id: productId, tenantId },
      select: {
        id: true,
        status: true,
        archivedAt: true,
        updatedAt: true,
        catalogLink: {
          select: {
            retailerId: true,
            externalProductId: true,
            externalCatalogId: true,
            processedPayloadHash: true,
            processedPublicUrl: true,
            syncStatus: true,
          },
        },
        variantMaps: { select: { retailerId: true, externalProductId: true, metaProductId: true, syncStatus: true, reviewStatus: true, lastError: true, lastSyncedAt: true } },
      },
    });
    if (!existing) return null;
    const decision = decideProductUpdate({
      storedStatus: existing.status,
      storedUpdatedAt: existing.updatedAt,
      expectedUpdatedAt,
      nextStatus: input.status,
    });
    if (!decision.ok) throw new ProductConflict(decision.error);

    const keptMaps = existing.variantMaps;
    await tx.commerceVariant.deleteMany({ where: { productId, tenantId } });
    await tx.commerceProductOutlet.deleteMany({ where: { productId, tenantId } });
    const link = existing.catalogLink;
    const nextHash = payloadHash(
      link?.externalCatalogId || "",
      catalogItems({
        sku: input.sku,
        name: input.name,
        description: input.description,
        category: input.category,
        imageUrl: input.imageUrl,
        hasImage: false,
        unitPriceIdr: input.unitPriceIdr,
        status: input.status,
        availability: input.availability,
        catalogEligibility: input.catalogEligibility,
        variants: input.variants,
      }),
      link?.processedPublicUrl || null
    );
    const detailsChanged = Boolean(link?.processedPayloadHash) && link?.processedPayloadHash !== nextHash;
    const skuChanged = Boolean(link?.externalProductId) && link?.retailerId !== input.sku;
    const outdated = detailsChanged || skuChanged;
    const updated = await tx.commerceProduct.update({
      where: { id: productId },
      data: {
        ...data,
        archivedAt: input.status === "ARCHIVED" ? existing.archivedAt ?? new Date() : null,
        variants: { create: variantCreate },
        outlets: { create: outletCreate },
        catalogLink: {
          upsert: {
            create: {
              tenantId,
              externalProductId: "",
              retailerId: input.sku,
              syncStatus: "NOT_CONNECTED",
              lastError: "",
            },
            update: {
              retailerId: input.sku,
              ...(outdated
                ? {
                    syncStatus: "OUTDATED",
                    lastError: skuChanged
                      ? "SKU changed. Preview sync again before a live push."
                      : "Product details changed. Preview sync again before a live push.",
                  }
                : {}),
            },
          },
        },
      },
      select: productSelect,
    });
    for (const variant of updated.variants) {
      const prev = keptMaps.find((map) => map.retailerId.toLowerCase() === variant.sku.toLowerCase());
      if (!prev) continue;
      await tx.commerceVariantMap.create({
        data: {
          tenantId,
          productId,
          variantId: variant.id,
          retailerId: variant.sku,
          externalProductId: prev.externalProductId,
          metaProductId: prev.metaProductId,
          syncStatus: outdated && (prev.syncStatus === "SYNCED" || prev.externalProductId) ? "OUTDATED" : prev.syncStatus,
          reviewStatus: prev.reviewStatus,
          lastError: prev.lastError,
          lastSyncedAt: prev.lastSyncedAt,
        },
      });
    }
    return updated;
  });

  if (!row) return { ok: false as const, status: 404, error: "Product not found" };
  return { ok: true as const, product: presentProduct(row) };
}

function failWrite(error: unknown): { ok: false; status: number; error: string } | null {
  if (error instanceof ProductConflict) return { ok: false, status: 409, error: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { ok: false, status: 409, error: "SKU already used on this merchant" };
  }
  return null;
}

export async function createCommerceProduct(
  tenantId: string,
  input: ProductInput,
  actorId: string
) {
  let result: Awaited<ReturnType<typeof writeProduct>>;
  try {
    result = await writeProduct(tenantId, input);
  } catch (error) {
    const failed = failWrite(error);
    if (failed) return failed;
    throw error;
  }
  if (!result.ok) return result;
  await writeAudit({
    tenantId,
    actorId,
    action: "commerce.product.create",
    objectType: "CommerceProduct",
    objectId: result.product.id,
    meta: { sku: result.product.sku },
  });
  return result;
}

export async function updateCommerceProduct(
  tenantId: string,
  productId: string,
  input: ProductInput,
  actorId: string,
  expectedUpdatedAt: unknown
) {
  let result: Awaited<ReturnType<typeof writeProduct>>;
  try {
    result = await writeProduct(tenantId, input, productId, expectedUpdatedAt);
  } catch (error) {
    const failed = failWrite(error);
    if (failed) return failed;
    throw error;
  }
  if (!result.ok) return result;
  await writeAudit({
    tenantId,
    actorId,
    action: input.status === "ARCHIVED" ? "commerce.product.archive" : "commerce.product.update",
    objectType: "CommerceProduct",
    objectId: result.product.id,
    meta: { sku: result.product.sku, status: input.status },
  });
  return result;
}

export async function archiveCommerceProduct(
  tenantId: string,
  productId: string,
  expectedUpdatedAt: unknown,
  actorId: string
) {
  const existing = await prisma.commerceProduct.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, sku: true, status: true, updatedAt: true, archivedAt: true },
  });
  if (!existing) return { ok: false as const, status: 404, error: "Product not found" };
  const decision = decideProductUpdate({
    storedStatus: existing.status,
    storedUpdatedAt: existing.updatedAt,
    expectedUpdatedAt,
    nextStatus: "ARCHIVED",
  });
  if (!decision.ok) return decision;
  if (existing.status === "ARCHIVED") {
    const row = await prisma.commerceProduct.findFirst({ where: { id: productId, tenantId }, select: productSelect });
    if (!row) return { ok: false as const, status: 404, error: "Product not found" };
    return { ok: true as const, product: presentProduct(row) };
  }
  const changed = await prisma.commerceProduct.updateMany({
    where: { id: productId, tenantId, updatedAt: existing.updatedAt, status: "ACTIVE" },
    data: { status: "ARCHIVED", archivedAt: existing.archivedAt ?? new Date() },
  });
  if (changed.count !== 1) {
    return { ok: false as const, status: 409, error: "This product changed. Reload it before saving." };
  }
  const row = await prisma.commerceProduct.findFirst({ where: { id: productId, tenantId }, select: productSelect });
  if (!row) return { ok: false as const, status: 404, error: "Product not found" };
  await writeAudit({
    tenantId,
    actorId,
    action: "commerce.product.archive",
    objectType: "CommerceProduct",
    objectId: productId,
    meta: { sku: existing.sku },
  });
  return { ok: true as const, product: presentProduct(row) };
}

export async function saveProductImage(tenantId: string, productId: string, image: { buf: Buffer; mime: string }) {
  const changed = await prisma.commerceProduct.updateMany({
    where: { id: productId, tenantId, status: { not: "ARCHIVED" } },
    data: { imageData: image.buf, imageMime: image.mime },
  });
  if (changed.count !== 1) {
    const exists = await prisma.commerceProduct.findFirst({ where: { id: productId, tenantId }, select: { status: true } });
    if (!exists) return { ok: false as const, status: 404, error: "Product not found" };
    return { ok: false as const, status: 409, error: "Archived products stay archived." };
  }
  return { ok: true as const };
}

export async function clearProductImage(tenantId: string, productId: string) {
  const changed = await prisma.commerceProduct.updateMany({
    where: { id: productId, tenantId, status: { not: "ARCHIVED" } },
    data: { imageData: null, imageMime: "" },
  });
  if (changed.count !== 1) {
    const exists = await prisma.commerceProduct.findFirst({ where: { id: productId, tenantId }, select: { status: true } });
    if (!exists) return { ok: false as const, status: 404, error: "Product not found" };
    return { ok: false as const, status: 409, error: "Archived products stay archived." };
  }
  return { ok: true as const };
}

export async function readProductImage(tenantId: string, productId: string) {
  const row = await prisma.commerceProduct.findFirst({
    where: { id: productId, tenantId },
    select: { imageData: true, imageMime: true },
  });
  if (!row?.imageData || !row.imageMime) return null;
  return { bytes: row.imageData, mime: row.imageMime };
}

export async function ensureCommerceReadiness(tenantId: string) {
  const data = readinessWriteData();
  const row = await prisma.commerceReadiness.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: {},
  });
  return presentStoredReadiness(row);
}

export async function recordCatalogSyncRefusal(tenantId: string, productId: string | null, actorId: string) {
  const result = await requestCatalogSync({ tenantId, productId, actorId });
  if (!result.ok) return result;
  return { ok: true as const, plan: result.plan };
}
