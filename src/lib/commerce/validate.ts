const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_PRICE = 1_000_000_000;

export const PRODUCT_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export const AVAILABILITY = ["AVAILABLE", "UNAVAILABLE"] as const;
export const CATALOG_ELIGIBILITY = ["UNKNOWN", "INELIGIBLE"] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type Availability = (typeof AVAILABILITY)[number];
export type CatalogEligibility = (typeof CATALOG_ELIGIBILITY)[number];

export type VariantInput = {
  sku: string;
  name: string;
  unitPriceIdr: number | null;
  status: ProductStatus;
};

export type OutletInput = {
  locationId: string;
  availability: Availability;
};

export type ProductInput = {
  sku: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  unitPriceIdr: number;
  status: ProductStatus;
  availability: Availability;
  catalogEligibility: CatalogEligibility;
  catalogEligibilityNote: string;
  variants: VariantInput[];
  outlets: OutletInput[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function parsePrice(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 0 || value > MAX_PRICE) return null;
  return value;
}

function parseImage(value: unknown): { ok: true; imageUrl: string | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, imageUrl: null };
  if (typeof value !== "string") return { ok: false, error: "Image must be an https URL" };
  const url = value.trim();
  if (!url) return { ok: true, imageUrl: null };
  if (url.length > 2000) return { ok: false, error: "Image URL is too long" };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "Image must be an https URL" };
  }
  if (parsed.protocol !== "https:") return { ok: false, error: "Image must be an https URL" };
  return { ok: true, imageUrl: url };
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T | null {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function parseProductInput(raw: unknown): { ok: true; value: ProductInput } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: "Invalid product" };
  if ("paidRevenue" in raw || "gmv" in raw || "paymentStatus" in raw) {
    return { ok: false, error: "This product record cannot store revenue or payment" };
  }

  const sku = cleanText(raw.sku, 64);
  if (!SKU.test(sku)) return { ok: false, error: "SKU uses letters, numbers, dot, underscore, or hyphen" };

  const name = cleanText(raw.name, 160);
  if (name.length < 1) return { ok: false, error: "Name is required" };

  const unitPriceIdr = parsePrice(raw.unitPriceIdr);
  if (unitPriceIdr == null) return { ok: false, error: "Price must be a whole rupiah amount from 0 up" };

  const status = oneOf(raw.status, PRODUCT_STATUSES, "ACTIVE");
  if (!status) return { ok: false, error: "Status must be active or archived" };

  const availability = oneOf(raw.availability, AVAILABILITY, "AVAILABLE");
  if (!availability) return { ok: false, error: "Availability must be available or unavailable" };

  if (raw.catalogEligibility === "ELIGIBLE" || raw.reviewStatus === "APPROVED" || raw.metaApproved === true) {
    return { ok: false, error: "Catalog eligibility cannot be marked eligible before a Meta review" };
  }
  const catalogEligibility = oneOf(raw.catalogEligibility, CATALOG_ELIGIBILITY, "UNKNOWN");
  if (!catalogEligibility) return { ok: false, error: "Catalog eligibility must be not reviewed or not for catalog" };

  const image = parseImage(raw.imageUrl);
  if (!image.ok) return image;

  if (raw.variants != null && !Array.isArray(raw.variants)) {
    return { ok: false, error: "Variants must be a list" };
  }
  if (raw.outlets != null && !Array.isArray(raw.outlets)) {
    return { ok: false, error: "Outlets must be a list" };
  }
  const variantRows = Array.isArray(raw.variants) ? raw.variants : [];
  const outletRows = Array.isArray(raw.outlets) ? raw.outlets : [];
  if (variantRows.length > 40) return { ok: false, error: "A product can have at most 40 variants" };
  if (outletRows.length > 200) return { ok: false, error: "Too many outlets" };

  const variants: VariantInput[] = [];
  for (const row of variantRows) {
    if (!isRecord(row)) return { ok: false, error: "Each variant needs a SKU and a name" };
    const variantSku = cleanText(row.sku, 64);
    if (!SKU.test(variantSku)) return { ok: false, error: "Variant SKU uses letters, numbers, dot, underscore, or hyphen" };
    const variantName = cleanText(row.name, 160);
    if (!variantName) return { ok: false, error: "Each variant needs a name" };
    let variantPrice: number | null = null;
    if (row.unitPriceIdr != null && row.unitPriceIdr !== "") {
      variantPrice = parsePrice(row.unitPriceIdr);
      if (variantPrice == null) return { ok: false, error: "Variant price must be a whole rupiah amount from 0 up" };
    }
    const variantStatus = oneOf(row.status, PRODUCT_STATUSES, "ACTIVE");
    if (!variantStatus) return { ok: false, error: "Variant status must be active or archived" };
    variants.push({ sku: variantSku, name: variantName, unitPriceIdr: variantPrice, status: variantStatus });
  }

  const outlets: OutletInput[] = [];
  for (const row of outletRows) {
    if (!isRecord(row)) return { ok: false, error: "Each outlet assignment needs a location" };
    const locationId = cleanText(row.locationId, 80);
    if (!locationId) return { ok: false, error: "Each outlet assignment needs a location" };
    const outletAvailability = oneOf(row.availability, AVAILABILITY, "AVAILABLE");
    if (!outletAvailability) return { ok: false, error: "Outlet availability must be available or unavailable" };
    outlets.push({ locationId, availability: outletAvailability });
  }

  const dup = duplicateSku(sku, variants);
  if (dup) return { ok: false, error: dup };

  const outletIds = new Set<string>();
  for (const outlet of outlets) {
    if (outletIds.has(outlet.locationId)) return { ok: false, error: "Each outlet can be assigned once" };
    outletIds.add(outlet.locationId);
  }

  return {
    ok: true,
    value: {
      sku,
      name,
      description: cleanText(raw.description, 2000),
      category: cleanText(raw.category, 80),
      imageUrl: image.imageUrl,
      unitPriceIdr,
      status,
      availability,
      catalogEligibility,
      catalogEligibilityNote: cleanText(raw.catalogEligibilityNote, 400),
      variants,
      outlets,
    },
  };
}

function duplicateSku(productSku: string, variants: VariantInput[]): string | null {
  const seen = new Set<string>([productSku.toLowerCase()]);
  for (const variant of variants) {
    const key = variant.sku.toLowerCase();
    if (seen.has(key)) return "SKU must be unique on the product and its variants";
    seen.add(key);
  }
  return null;
}

export function foreignOutlets(outlets: OutletInput[], allowedLocationIds: ReadonlySet<string>): string | null {
  for (const outlet of outlets) {
    if (!allowedLocationIds.has(outlet.locationId)) {
      return "Outlet is not on this merchant";
    }
  }
  return null;
}

export function collectSkus(input: ProductInput): string[] {
  return [input.sku, ...input.variants.map((variant) => variant.sku)];
}

export function sameRevision(stored: Date, expected: unknown): boolean {
  if (typeof expected !== "string" || !expected) return false;
  const parsed = Date.parse(expected);
  if (Number.isNaN(parsed)) return false;
  return stored.getTime() === parsed;
}

/** A stale save must not revive an archived product. Archive stays archive. */
export function decideProductUpdate(opts: {
  storedStatus: string;
  storedUpdatedAt: Date;
  expectedUpdatedAt: unknown;
  nextStatus: string;
}): { ok: true } | { ok: false; status: 409; error: string } {
  if (!sameRevision(opts.storedUpdatedAt, opts.expectedUpdatedAt)) {
    return { ok: false, status: 409, error: "This product changed. Reload it before saving." };
  }
  if (opts.storedStatus === "ARCHIVED" && opts.nextStatus === "ACTIVE") {
    return { ok: false, status: 409, error: "Archived products stay archived." };
  }
  return { ok: true };
}
