/** Meta catalog file for a manual upload. This module does not call Graph. */

const TICKET_CATEGORY = /ticket|event|admission|voucher/i;

export type FeedSchemaName = "commerce" | "local" | "unsupported" | "unverified";

/** Required commerce columns from the uploaded AtlasNow Commerce QA clean feed. Price is included because that file carried it. */
export const COMMERCE_FEED_COLUMNS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "link",
  "image_link",
  "brand",
  "price",
] as const;

/** Location columns populated on the uploaded local catalog file. A street address was not in that file. */
export const LOCAL_FEED_COLUMNS = [
  "address.city",
  "address.country",
  "address.region",
  "availability_circle_origin.latitude",
  "availability_circle_origin.longitude",
  "availability_circle_radius_unit",
  "availability_circle_radius",
] as const;

export const INCOMPLETE_LOCATION_MESSAGE =
  "Location information is missing or incomplete. Give the item one complete location format: a center point with a radius, a closed polygon, postal codes, Comscore markets, or an address with a radius. Then try again.";

export const UNSUPPORTED_RADIUS_UNIT_MESSAGE =
  "The value provided for availability_circle_radius_unit isn't supported. To see the supported values for this field, go to https://www.facebook.com/business/help/120325381656392. Use KM or MI.";

export type LocalFeedArea = {
  city: string;
  country: string;
  region: string;
  originLatitude: string;
  originLongitude: string;
  radius: string;
  radiusUnit: string;
};

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
  /** Stored circle and address. Outlet coordinates are not used as a substitute radius. */
  localArea?: LocalFeedArea | null;
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
      schema: "unverified",
      verticalStored: false,
      note: "Catalog type is not stored. Confirm the Meta catalog type before creating a file.",
    };
  }
  if (value === "activities") {
    return {
      schema: "unsupported",
      verticalStored: true,
      note: "Catalog type activities does not use this product feed.",
    };
  }
  if (value === "commerce" || value === "ecommerce" || value === "products" || value === "product") {
    return {
      schema: "commerce",
      verticalStored: true,
      note: "This file uses the commerce product schema confirmed by the AtlasNow Commerce QA feed.",
    };
  }
  if (value === "offline_commerce" || value === "local_service_businesses" || value.includes("local")) {
    return {
      schema: "local",
      verticalStored: true,
      note: "This file uses the local catalog schema. It needs address.city, address.country, address.region, a circle origin, a radius, and unit KM or MI.",
    };
  }
  return {
    schema: "unverified",
    verticalStored: true,
    note: `Catalog type ${vertical.trim()} is not a confirmed feed schema. Verify it before creating a file.`,
  };
}

export function localFeedArea(
  area: LocalFeedArea | null
): { ok: true; values: Record<(typeof LOCAL_FEED_COLUMNS)[number], string> } | { ok: false; missing: FeedIssue[] } {
  if (!area) return { ok: false, missing: [{ sku: "", field: "location", message: INCOMPLETE_LOCATION_MESSAGE }] };
  const missing: FeedIssue[] = [];
  const city = area.city.trim();
  const country = area.country.trim();
  const region = area.region.trim();
  const latitude = area.originLatitude.trim();
  const longitude = area.originLongitude.trim();
  const radius = area.radius.trim();
  const unit = area.radiusUnit.trim();
  if (!city) missing.push({ sku: "", field: "address.city", message: "address.city is required for this local catalog file." });
  if (!country) missing.push({ sku: "", field: "address.country", message: "address.country is required for this local catalog file." });
  if (!region) missing.push({ sku: "", field: "address.region", message: "address.region is required for this local catalog file." });
  if (!latitude || !longitude || !/^-?\d+(\.\d+)?$/.test(latitude) || !/^-?\d+(\.\d+)?$/.test(longitude)) {
    missing.push({ sku: "", field: "availability_circle_origin", message: INCOMPLETE_LOCATION_MESSAGE });
  }
  if (!radius || !/^\d+(\.\d+)?$/.test(radius) || Number(radius) <= 0) {
    missing.push({ sku: "", field: "availability_circle_radius", message: INCOMPLETE_LOCATION_MESSAGE });
  }
  if (unit !== "KM" && unit !== "MI") {
    missing.push({
      sku: "",
      field: "availability_circle_radius_unit",
      message: unit ? UNSUPPORTED_RADIUS_UNIT_MESSAGE : "availability_circle_radius_unit is required. Use KM or MI.",
    });
  }
  if (missing.length) return { ok: false, missing };
  return {
    ok: true,
    values: {
      "address.city": city,
      "address.country": country,
      "address.region": region,
      "availability_circle_origin.latitude": latitude,
      "availability_circle_origin.longitude": longitude,
      "availability_circle_radius_unit": unit,
      "availability_circle_radius": radius,
    },
  };
}

/** Outlet latitude and longitude are not a complete Meta location. Radius and unit are never invented. */
export function localAreaFromOutlets(outlets: FeedOutlet[]): { ok: false; messages: string[] } {
  if (outlets.length !== 1) {
    return {
      ok: false,
      messages: [
        outlets.length === 0
          ? "A local catalog needs one stored outlet before a circle origin can be read."
          : "This product is assigned to more than one outlet. The file does not choose one.",
      ],
    };
  }
  const outlet = outlets[0];
  const checked = localFeedArea({
    city: outlet.city,
    country: outlet.country,
    region: outlet.region,
    originLatitude: outlet.latitude == null ? "" : String(outlet.latitude),
    originLongitude: outlet.longitude == null ? "" : String(outlet.longitude),
    radius: "",
    radiusUnit: "",
  });
  return { ok: false, messages: checked.ok ? [INCOMPLETE_LOCATION_MESSAGE] : checked.missing.map((row) => row.message) };
}

/** A stored circle wins. Outlet coordinates never invent a radius or a unit. */
export function productLocalValues(product: {
  sku: string;
  localArea?: LocalFeedArea | null;
  outlets: FeedOutlet[];
}): { ok: true; values: Record<(typeof LOCAL_FEED_COLUMNS)[number], string> } | { ok: false; issues: FeedIssue[] } {
  const sku = product.sku.trim();
  if (product.localArea) {
    const checked = localFeedArea(product.localArea);
    if (!checked.ok) return { ok: false, issues: checked.missing.map((row) => ({ ...row, sku: row.sku || sku })) };
    return { ok: true, values: checked.values };
  }
  const fromOutlets = localAreaFromOutlets(product.outlets);
  return { ok: false, issues: fromOutlets.messages.map((message) => ({ sku, field: "location", message })) };
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

function feedFilename(schema: FeedSchemaName): string {
  if (schema === "local") return "meta-catalog-local.csv";
  if (schema === "commerce") return "meta-catalog-commerce.csv";
  if (schema === "unsupported") return "meta-catalog-unsupported.csv";
  return "meta-catalog-unverified.csv";
}

type FeedSpec = {
  id: string;
  title: string;
  description: string;
  availability: string;
  price: number;
  link: string;
  image: string;
  brand: string;
  group: string;
  location: Record<(typeof LOCAL_FEED_COLUMNS)[number], string> | null;
};

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
  const filename = feedFilename(schema.schema);
  const missing: FeedIssue[] = [];
  const blockers: FeedIssue[] = [];
  if (schema.schema === "unsupported" || schema.schema === "unverified") {
    blockers.push({ sku: "", field: "catalog", message: schema.note });
    return { ok: false, ...schema, missing, blockers, csv: "", filename, rowCount: 0 };
  }
  const brand = opts.brand.trim();
  if (!brand) blockers.push({ sku: "", field: "brand", message: "The merchant name is required for the brand column." });
  const seen = new Set<string>();
  const specs: FeedSpec[] = [];
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
    let location: FeedSpec["location"] = null;
    if (schema.schema === "local") {
      const located = productLocalValues(product);
      if (!located.ok) {
        for (const issue of located.issues) blockers.push(issue);
      } else {
        location = located.values;
      }
    }
    if (!brand || !link || !image || !product.name.trim() || !product.description.trim()) continue;
    if (!Number.isInteger(product.unitPriceIdr) || product.unitPriceIdr < 0) continue;
    if (schema.schema === "local" && !location) continue;
    const group = activeVariants.length > 0 ? sku : "";
    const availability = product.availability === "UNAVAILABLE" ? "out of stock" : "in stock";
    specs.push({
      id: sku,
      title: product.name.trim(),
      description: product.description.trim(),
      availability,
      price: product.unitPriceIdr,
      link,
      image,
      brand,
      group,
      location,
    });
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
      specs.push({
        id: variant.sku.trim(),
        title: variant.name.trim(),
        description: product.description.trim(),
        availability,
        price,
        link,
        image,
        brand,
        group,
        location,
      });
    }
  }
  const blocked = missing.length > 0 || blockers.length > 0;
  if (blocked || specs.length === 0) {
    if (specs.length === 0 && missing.length === 0 && blockers.length === 0) {
      blockers.push({ sku: "", field: "products", message: "No active products to export." });
    }
    return { ok: false, ...schema, missing, blockers, csv: "", filename, rowCount: 0 };
  }
  const includeGroup = specs.some((row) => row.group);
  const header = [
    ...COMMERCE_FEED_COLUMNS,
    ...(includeGroup ? ["item_group_id"] : []),
    ...(schema.schema === "local" ? LOCAL_FEED_COLUMNS : []),
  ];
  const csv = [header, ...specs.map((row) => feedRow(row, includeGroup))].map((row) => row.map(cell).join(",")).join("\n") + "\n";
  return { ok: true, ...schema, missing, blockers, csv, filename, rowCount: specs.length };
}

function feedRow(opts: FeedSpec, includeGroup: boolean): string[] {
  const row = [
    opts.id,
    opts.title,
    opts.description,
    opts.availability,
    "new",
    opts.link,
    opts.image,
    opts.brand,
    `${opts.price} IDR`,
  ];
  if (includeGroup) row.push(opts.group);
  if (opts.location) {
    for (const column of LOCAL_FEED_COLUMNS) row.push(opts.location[column]);
  }
  return row;
}
