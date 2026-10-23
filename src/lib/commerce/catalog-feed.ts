/** Meta catalog file for a manual upload. This module does not call Graph. */

const TICKET_CATEGORY = /ticket|event|admission|voucher/i;

export type FeedSchemaName = "commerce" | "local" | "unsupported";

export type FeedOutlet = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
};

export type FeedVariant = {
  sku: string;
  name: string;
  unitPriceIdr: number | null;
  status: string;
};

export type FeedProduct = {
  sku: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  publicUrl: string | null;
  unitPriceIdr: number;
  status: string;
  availability: string;
  catalogEligibility: string;
  variants: FeedVariant[];
  outlets: FeedOutlet[];
};

export type FeedIssue = {
  sku: string;
  field: string;
  message: string;
};

export function feedSchemaForVertical(vertical: string): {
  schema: FeedSchemaName;
  verticalStored: boolean;
  note: string;
} {
  const value = vertical.trim().toLowerCase();
  if (!value) {
    return {
      schema: "commerce",
      verticalStored: false,
      note: "Catalog type is not stored. This file uses the commerce product schema.",
    };
  }
  if (value === "commerce" || value === "ecommerce" || value === "products" || value === "product") {
    return {
      schema: "commerce",
      verticalStored: true,
      note: "This file uses the commerce product schema.",
    };
  }
  if (value === "offline_commerce" || value === "local_service_businesses" || value.includes("local")) {
    return {
      schema: "local",
      verticalStored: true,
      note: "This file uses the local catalog schema. Each product needs one outlet address, latitude, and longitude.",
    };
  }
  return {
    schema: "unsupported",
    verticalStored: true,
    note: `Catalog type ${vertical.trim()} does not use this product feed.`,
  };
}

export function outletAddress(outlet: FeedOutlet): string {
  return [outlet.addressLine1, outlet.addressLine2, outlet.city, outlet.region, outlet.postalCode, outlet.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function localLocation(
  outlets: FeedOutlet[]
): { ok: true; address: string; latitude: string; longitude: string } | { ok: false; message: string } {
  if (outlets.length !== 1) {
    return {
      ok: false,
      message:
        outlets.length === 0
          ? "A local catalog needs one outlet with an address, latitude, and longitude."
          : "A local catalog needs exactly one outlet. This product is assigned to more than one.",
    };
  }
  const outlet = outlets[0];
  const address = outletAddress(outlet);
  if (!address) return { ok: false, message: "The outlet is missing an address." };
  if (outlet.latitude == null || outlet.longitude == null || !Number.isFinite(outlet.latitude) || !Number.isFinite(outlet.longitude)) {
    return { ok: false, message: "The outlet is missing latitude or longitude." };
  }
  return { ok: true, address, latitude: String(outlet.latitude), longitude: String(outlet.longitude) };
}

function httpsUrl(value: string | null | undefined): string | null {
  const url = (value || "").trim();
  if (!url || url.length > 2000) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function cell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function columns(schema: "commerce" | "local"): string[] {
  const base = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "item_group_id"];
  return schema === "local" ? [...base, "address", "latitude", "longitude"] : base;
}

export function buildCatalogFeed(opts: { vertical: string; brand: string; products: FeedProduct[] }): {
  ok: boolean;
  schema: FeedSchemaName;
  verticalStored: boolean;
  note: string;
  missing: FeedIssue[];
  blockers: FeedIssue[];
  csv: string;
  filename: string;
  rowCount: number;
} {
  const schema = feedSchemaForVertical(opts.vertical);
  const filename = schema.schema === "local" ? "meta-catalog-local.csv" : "meta-catalog-commerce.csv";
  const missing: FeedIssue[] = [];
  const blockers: FeedIssue[] = [];
  if (schema.schema === "unsupported") {
    blockers.push({ sku: "", field: "catalog", message: schema.note });
    return { ok: false, ...schema, missing, blockers, csv: "", filename, rowCount: 0 };
  }
  const brand = opts.brand.trim();
  if (!brand) blockers.push({ sku: "", field: "brand", message: "The merchant name is required for the brand column." });
  const seen = new Set<string>();
  const rows: string[][] = [];
  for (const product of opts.products) {
    const sku = product.sku.trim();
    if (product.status === "ARCHIVED") {
      blockers.push({ sku, field: "status", message: "Archived products are not included in the feed." });
      continue;
    }
    if (product.catalogEligibility === "INELIGIBLE") {
      blockers.push({ sku, field: "catalogEligibility", message: "This product is marked not for catalog." });
    } else if (product.catalogEligibility !== "UNKNOWN") {
      blockers.push({ sku, field: "catalogEligibility", message: "Catalog eligibility cannot be marked approved from AtlasNow." });
    }
    if (TICKET_CATEGORY.test(product.category)) {
      blockers.push({ sku, field: "category", message: "This category needs a Meta eligibility check before a catalog file." });
    }
    if (!product.name.trim()) missing.push({ sku, field: "title", message: "Title is required." });
    if (!product.description.trim()) missing.push({ sku, field: "description", message: "Description is required." });
    if (!Number.isInteger(product.unitPriceIdr) || product.unitPriceIdr < 0) {
      missing.push({ sku, field: "price", message: "Price must be a whole rupiah amount." });
    }
    const link = httpsUrl(product.publicUrl);
    if (!link) missing.push({ sku, field: "link", message: "Meta requires an https product link. This product has no public URL yet." });
    const image = httpsUrl(product.imageUrl);
    if (!image) missing.push({ sku, field: "image_link", message: "Meta needs an https image URL." });
    const activeVariants = product.variants.filter((variant) => variant.status !== "ARCHIVED" && variant.sku.trim());
    const ids = [sku, ...activeVariants.map((variant) => variant.sku.trim())].map((id) => id.toLowerCase());
    if (new Set(ids).size !== ids.length || ids.some((id) => seen.has(id))) {
      blockers.push({ sku, field: "id", message: "Each SKU can map to only one catalog row." });
    }
    ids.forEach((id) => seen.add(id));
    let location: { address: string; latitude: string; longitude: string } | null = null;
    if (schema.schema === "local") {
      const located = localLocation(product.outlets);
      if (!located.ok) blockers.push({ sku, field: "location", message: located.message });
      else location = located;
    }
    if (!brand || !link || !image || !product.name.trim() || !product.description.trim()) continue;
    if (!Number.isInteger(product.unitPriceIdr) || product.unitPriceIdr < 0) continue;
    const group = activeVariants.length > 0 ? sku : "";
    const parent = feedRow({
      id: sku,
      title: product.name.trim(),
      description: product.description.trim(),
      availability: product.availability === "UNAVAILABLE" ? "out of stock" : "in stock",
      price: product.unitPriceIdr,
      link,
      image,
      brand,
      group,
      location,
    });
    rows.push(parent);
    for (const variant of activeVariants) {
      if (!variant.name.trim()) {
        missing.push({ sku: variant.sku, field: "title", message: "Each variant needs a title." });
        continue;
      }
      const price = variant.unitPriceIdr ?? product.unitPriceIdr;
      if (!Number.isInteger(price) || price < 0) {
        missing.push({ sku: variant.sku, field: "price", message: "Variant price must be a whole rupiah amount." });
        continue;
      }
      rows.push(
        feedRow({
          id: variant.sku.trim(),
          title: variant.name.trim(),
          description: product.description.trim(),
          availability: product.availability === "UNAVAILABLE" ? "out of stock" : "in stock",
          price,
          link,
          image,
          brand,
          group,
          location,
        })
      );
    }
  }
  const blocked = missing.length > 0 || blockers.length > 0 || schema.schema !== "commerce" && schema.schema !== "local";
  if (blocked || rows.length === 0) {
    if (rows.length === 0 && missing.length === 0 && blockers.length === 0) {
      blockers.push({ sku: "", field: "products", message: "No active products to export." });
    }
    return { ok: false, ...schema, missing, blockers, csv: "", filename, rowCount: 0 };
  }
  const header = columns(schema.schema);
  const csv = [header, ...rows].map((row) => row.map(cell).join(",")).join("\n") + "\n";
  return { ok: true, ...schema, missing, blockers, csv, filename, rowCount: rows.length };
}

function feedRow(opts: {
  id: string;
  title: string;
  description: string;
  availability: string;
  price: number;
  link: string;
  image: string;
  brand: string;
  group: string;
  location: { address: string; latitude: string; longitude: string } | null;
}): string[] {
  const row = [
    opts.id,
    opts.title,
    opts.description,
    opts.availability,
    "new",
    `${opts.price} IDR`,
    opts.link,
    opts.image,
    opts.brand,
    opts.group,
  ];
  if (opts.location) row.push(opts.location.address, opts.location.latitude, opts.location.longitude);
  return row;
}
