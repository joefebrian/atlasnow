import { prisma } from "@/lib/db";
import { buildCatalogFeed, type FeedOutlet, type FeedProduct } from "@/lib/commerce/catalog-feed";

const MAX_PRODUCTS = 100;

const outletSelect = {
  location: {
    select: {
      addressLine1: true,
      addressLine2: true,
      city: true,
      region: true,
      postalCode: true,
      country: true,
      latitude: true,
      longitude: true,
    },
  },
} as const;

export function toFeedOutlet(location: {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}): FeedOutlet {
  return {
    addressLine1: location.addressLine1 || "",
    addressLine2: location.addressLine2 || "",
    city: location.city || "",
    region: location.region || "",
    postalCode: location.postalCode || "",
    country: location.country || "",
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

export async function loadFeedOutlets(tenantId: string, productId: string): Promise<FeedOutlet[]> {
  const rows = await prisma.commerceProductOutlet.findMany({
    where: { tenantId, productId },
    select: outletSelect,
  });
  return rows.map((row) => toFeedOutlet(row.location));
}

/** Builds a catalog file from the product master. It does not call Meta. */
export async function exportTenantCatalogFeed(tenantId: string, productIds?: string[]) {
  const requested = [...new Set((productIds || []).map((id) => id.trim()).filter(Boolean))];
  const [tenant, connection] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    prisma.commerceConnection.findUnique({
      where: { tenantId },
      select: { catalogId: true, catalogVertical: true },
    }),
  ]);
  const vertical = connection?.catalogVertical || "";
  const brand = tenant?.name || "";
  if (requested.length > MAX_PRODUCTS) {
    const empty = buildCatalogFeed({ vertical, brand, products: [] });
    return {
      ...empty,
      ok: false as const,
      csv: "",
      rowCount: 0,
      blockers: [{ sku: "", field: "products", message: "Choose at most 100 products." }],
      networkCalled: false as const,
      catalogId: connection?.catalogId || "",
    };
  }
  const rows = await prisma.commerceProduct.findMany({
    where: {
      tenantId,
      ...(requested.length ? { id: { in: requested } } : { status: "ACTIVE" }),
    },
    orderBy: { sku: "asc" },
    take: MAX_PRODUCTS + 1,
    select: {
      sku: true,
      name: true,
      description: true,
      category: true,
      imageUrl: true,
      publicUrl: true,
      unitPriceIdr: true,
      status: true,
      availability: true,
      catalogEligibility: true,
      variants: { select: { sku: true, name: true, unitPriceIdr: true, status: true } },
      outlets: { select: outletSelect },
    },
  });
  if (!requested.length && rows.length > MAX_PRODUCTS) {
    const empty = buildCatalogFeed({ vertical, brand, products: [] });
    return {
      ...empty,
      ok: false as const,
      csv: "",
      rowCount: 0,
      blockers: [{ sku: "", field: "products", message: "Choose at most 100 products." }],
      networkCalled: false as const,
      catalogId: connection?.catalogId || "",
    };
  }
  const products: FeedProduct[] = rows.slice(0, MAX_PRODUCTS).map((row) => ({
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
    imageUrl: row.imageUrl,
    publicUrl: row.publicUrl,
    unitPriceIdr: row.unitPriceIdr,
    status: row.status,
    availability: row.availability,
    catalogEligibility: row.catalogEligibility,
    variants: row.variants,
    outlets: row.outlets.map((outlet) => toFeedOutlet(outlet.location)),
  }));
  const feed = buildCatalogFeed({ vertical, brand, products });
  return { ...feed, networkCalled: false as const, catalogId: connection?.catalogId || "" };
}
