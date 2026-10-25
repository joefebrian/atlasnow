import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  COMMERCE_FEED_COLUMNS,
  INCOMPLETE_LOCATION_MESSAGE,
  LOCAL_FEED_COLUMNS,
  buildCatalogFeed,
  type FeedProduct,
  type LocalFeedArea,
} from "@/lib/commerce/catalog-feed";

/** Cells copied from AtlasNow_Montessori_Commerce_Catalog_Clean_Feed.xlsx row 3. */
const QA_TITLE = "BabyToys Puzzle Kayu Montessori - Shape Sorter";
const QA_DESCRIPTION =
  "Mainan puzzle edukasi berbahan kayu dengan bentuk geometri dan warna pastel. Anak dapat menyusun dan mencocokkan balok bentuk pada papan dengan tiang. Produk sesuai foto referensi; periksa detail varian dan rekomendasi usia pada halaman penjual sebelum membeli.";
const QA_LINK =
  "https://shopee.co.id/BabyToys-Mainan-Puzzle-Anak-Kayu-Edukasi-Montessori-Mainan-Kayu-Edukasi-Bayi-Shape-Sorter-i.346014230.22547305811";
const QA_IMAGE = "https://down-id.img.susercontent.com/file/id-11134207-7rask-m5tvqvzdz4hu3f";

/** Circle copied from AtlasNow_Meta_Catalog_QA_Jakarta_Barat_Location.xlsx. Street address was empty. */
const JAKARTA_BARAT: LocalFeedArea = {
  city: "Jakarta Barat",
  country: "ID",
  region: "DKI Jakarta",
  originLatitude: "-6.183295",
  originLongitude: "106.751824",
  radius: "12",
  radiusUnit: "KM",
};

function shape(overrides: Partial<FeedProduct> = {}): FeedProduct {
  return {
    sku: "ATLASNOW-QA-SHAPE-001",
    name: QA_TITLE,
    description: QA_DESCRIPTION,
    category: "",
    imageUrl: QA_IMAGE,
    publicUrl: QA_LINK,
    unitPriceIdr: 28780,
    status: "ACTIVE",
    availability: "AVAILABLE",
    catalogEligibility: "UNKNOWN",
    variants: [],
    outlets: [],
    ...overrides,
  };
}

function messages(feed: { missing: { message: string }[]; blockers: { message: string }[] }) {
  return [...feed.missing, ...feed.blockers].map((row) => row.message).join(" ");
}

describe("meta catalog feed file", () => {
  it("does not build a file when the https link is missing", () => {
    const feed = buildCatalogFeed({
      vertical: "commerce",
      brand: "BabyToys",
      products: [shape({ publicUrl: "" })],
    });
    assert.equal(feed.ok, false);
    assert.equal(feed.csv, "");
    assert.equal(feed.missing.some((row) => row.field === "link"), true);
  });

  it("does not treat an empty catalog type as commerce", () => {
    const feed = buildCatalogFeed({ vertical: "", brand: "BabyToys", products: [shape()] });
    assert.equal(feed.ok, false);
    assert.equal(feed.schema, "unverified");
    assert.equal(feed.verticalStored, false);
    assert.equal(feed.csv, "");
    assert.equal(feed.filename, "meta-catalog-unverified.csv");
    assert.match(messages(feed), /Confirm the Meta catalog type/);
  });

  it("does not treat an unknown catalog type as commerce", () => {
    const feed = buildCatalogFeed({ vertical: "hotels", brand: "BabyToys", products: [shape()] });
    assert.equal(feed.schema, "unverified");
    assert.equal(feed.verticalStored, true);
    assert.equal(feed.ok, false);
    assert.equal(feed.csv, "");
    assert.match(messages(feed), /Verify it before creating a file/);
  });

  it("matches the commerce columns and cells from the successful QA feed", () => {
    const feed = buildCatalogFeed({ vertical: "commerce", brand: "BabyToys", products: [shape()] });
    assert.equal(feed.ok, true);
    assert.equal(feed.schema, "commerce");
    const [header, row] = feed.csv.trim().split("\n");
    assert.equal(header, COMMERCE_FEED_COLUMNS.join(","));
    assert.equal(
      row,
      [
        "ATLASNOW-QA-SHAPE-001",
        QA_TITLE,
        QA_DESCRIPTION,
        "in stock",
        "new",
        QA_LINK,
        QA_IMAGE,
        "BabyToys",
        "28780 IDR",
      ].join(",")
    );
    assert.equal(feed.csv.includes("item_group_id"), false);
    assert.equal(feed.csv.includes("color"), false);
    assert.equal(feed.csv.includes("material"), false);
    assert.equal(feed.csv.includes("product_height"), false);
    assert.equal(feed.csv.includes("address"), false);
  });

  it("adds item_group_id only when a product has an active variant", () => {
    const feed = buildCatalogFeed({
      vertical: "ecommerce",
      brand: "BabyToys",
      products: [
        shape({
          variants: [{ sku: "ATLASNOW-QA-SHAPE-001-A", name: "Small", unitPriceIdr: 25000, status: "ACTIVE" }],
        }),
      ],
    });
    assert.equal(feed.ok, true);
    assert.match(feed.csv, /^id,title,description,availability,condition,link,image_link,brand,price,item_group_id\n/);
    assert.match(feed.csv, /ATLASNOW-QA-SHAPE-001-A,Small,/);
    assert.match(feed.csv, /,ATLASNOW-QA-SHAPE-001\n/);
  });

  it("withholds a local file when only an address and coordinates are present", () => {
    const feed = buildCatalogFeed({
      vertical: "offline_commerce",
      brand: "BabyToys",
      products: [
        shape({
          localArea: { ...JAKARTA_BARAT, radius: "", radiusUnit: "" },
        }),
      ],
    });
    assert.equal(feed.schema, "local");
    assert.equal(feed.ok, false);
    assert.equal(feed.csv, "");
    assert.match(messages(feed), /Location information is missing or incomplete/);
    assert.equal(messages(feed).includes(INCOMPLETE_LOCATION_MESSAGE), true);
    assert.equal(feed.csv.includes("-6.183295"), false);
  });

  it("withholds a local file when the radius unit is not KM or MI", () => {
    const feed = buildCatalogFeed({
      vertical: "local_service_businesses",
      brand: "BabyToys",
      products: [shape({ localArea: { ...JAKARTA_BARAT, radiusUnit: "km" } })],
    });
    assert.equal(feed.ok, false);
    assert.equal(feed.csv, "");
    assert.match(messages(feed), /availability_circle_radius_unit isn't supported/);
    assert.match(messages(feed), /Use KM or MI/);
  });

  it("does not choose one outlet or invent a radius from outlet coordinates", () => {
    const outlet = {
      addressLine1: "Jl. QA",
      addressLine2: "",
      city: "Jakarta Barat",
      region: "DKI Jakarta",
      postalCode: "",
      country: "ID",
      latitude: -6.183295,
      longitude: 106.751824,
    };
    const one = buildCatalogFeed({
      vertical: "offline_commerce",
      brand: "BabyToys",
      products: [shape({ outlets: [outlet] })],
    });
    assert.equal(one.ok, false);
    assert.equal(one.csv, "");
    assert.match(messages(one), /Location information is missing or incomplete/);
    const two = buildCatalogFeed({
      vertical: "offline_commerce",
      brand: "BabyToys",
      products: [shape({ outlets: [outlet, { ...outlet, city: "BSD" }] })],
    });
    assert.equal(two.ok, false);
    assert.equal(two.csv, "");
    assert.match(messages(two), /more than one/);
  });

  it("matches the Jakarta Barat circle columns when that area is supplied", () => {
    const feed = buildCatalogFeed({
      vertical: "offline_commerce",
      brand: "BabyToys",
      products: [shape({ localArea: JAKARTA_BARAT })],
    });
    assert.equal(feed.ok, true);
    const [header, row] = feed.csv.trim().split("\n");
    assert.equal(header, [...COMMERCE_FEED_COLUMNS, ...LOCAL_FEED_COLUMNS].join(","));
    assert.equal(
      row?.endsWith(",Jakarta Barat,ID,DKI Jakarta,-6.183295,106.751824,KM,12"),
      true
    );
    assert.equal(feed.csv.includes("street_address"), false);
    assert.equal(feed.csv.includes("postal_code"), false);
    assert.equal(feed.csv.includes("Jl."), false);
    assert.equal(feed.csv.includes("product_height"), false);
    assert.equal(feed.csv.includes("maximum_weight"), false);
  });

  it("does not build a product file for an activities catalog", () => {
    const feed = buildCatalogFeed({ vertical: "activities", brand: "BabyToys", products: [shape()] });
    assert.equal(feed.schema, "unsupported");
    assert.equal(feed.csv, "");
    assert.equal(feed.filename, "meta-catalog-unsupported.csv");
    assert.match(messages(feed), /activities/);
  });

  it("keeps the feed builder off the catalog batch endpoint and off invented locations", () => {
    const source = readFileSync(new URL("./catalog-feed.ts", import.meta.url), "utf8");
    const route = readFileSync(new URL("../../app/api/commerce/catalog/export/route.ts", import.meta.url), "utf8");
    assert.equal(source.includes("items_batch"), false);
    assert.equal(source.includes("pushCatalogItems"), false);
    assert.equal(route.includes("items_batch"), false);
    assert.equal(route.includes("pushCatalogItems"), false);
    assert.equal(source.includes("Jakarta Barat"), false);
    assert.equal(source.includes("-6.183295"), false);
    assert.equal(source.includes("BabyToys"), false);
  });
});
