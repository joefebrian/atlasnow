import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildCatalogFeed, type FeedProduct } from "@/lib/commerce/catalog-feed";

function shape(overrides: Partial<FeedProduct> = {}): FeedProduct {
  return {
    sku: "ATLASNOW-QA-SHAPE-001",
    name: "QA shape",
    description: "Shape",
    category: "",
    imageUrl: "https://cdn.example/shape.jpg",
    publicUrl: "https://atlasnow.example/qa-shape",
    unitPriceIdr: 28780,
    status: "ACTIVE",
    availability: "AVAILABLE",
    catalogEligibility: "UNKNOWN",
    variants: [],
    outlets: [],
    ...overrides,
  };
}

describe("meta catalog feed file", () => {
  it("does not build a file when the https link is missing", () => {
    const feed = buildCatalogFeed({
      vertical: "commerce",
      brand: "AtlasNow Commerce QA",
      products: [shape({ publicUrl: "" })],
    });
    assert.equal(feed.ok, false);
    assert.equal(feed.csv, "");
    assert.equal(feed.missing.some((row) => row.field === "link"), true);
  });

  it("builds a commerce file for a complete product", () => {
    const feed = buildCatalogFeed({
      vertical: "",
      brand: "AtlasNow Commerce QA",
      products: [shape()],
    });
    assert.equal(feed.ok, true);
    assert.equal(feed.schema, "commerce");
    assert.equal(feed.verticalStored, false);
    assert.match(feed.note, /not stored/);
    assert.match(feed.csv, /^id,title,description,availability,condition,price,link,image_link,brand,item_group_id\n/);
    assert.match(feed.csv, /ATLASNOW-QA-SHAPE-001,QA shape,Shape,in stock,new,28780 IDR,https:\/\/atlasnow\.example\/qa-shape/);
  });

  it("reports a local catalog without coordinates and does not return a file", () => {
    const feed = buildCatalogFeed({
      vertical: "offline_commerce",
      brand: "AtlasNow Commerce QA",
      products: [
        shape({
          outlets: [
            {
              addressLine1: "Jl. QA",
              addressLine2: "",
              city: "Tangerang",
              region: "",
              postalCode: "",
              country: "ID",
              latitude: null,
              longitude: null,
            },
          ],
        }),
      ],
    });
    assert.equal(feed.schema, "local");
    assert.equal(feed.ok, false);
    assert.equal(feed.csv, "");
    assert.match(feed.blockers.map((row) => row.message).join(" "), /latitude/);
  });

  it("refuses more than one outlet on a local catalog", () => {
    const outlet = {
      addressLine1: "Jl. QA",
      addressLine2: "",
      city: "Tangerang",
      region: "",
      postalCode: "",
      country: "ID",
      latitude: -6.2,
      longitude: 106.8,
    };
    const feed = buildCatalogFeed({
      vertical: "local_service_businesses",
      brand: "AtlasNow Commerce QA",
      products: [shape({ outlets: [outlet, { ...outlet, city: "BSD" }] })],
    });
    assert.equal(feed.ok, false);
    assert.equal(feed.csv, "");
    assert.match(feed.blockers.map((row) => row.message).join(" "), /more than one/);
  });

  it("writes the outlet location on a complete local file", () => {
    const feed = buildCatalogFeed({
      vertical: "offline_commerce",
      brand: "AtlasNow Commerce QA",
      products: [
        shape({
          outlets: [
            {
              addressLine1: "Jl. QA",
              addressLine2: "",
              city: "Tangerang",
              region: "",
              postalCode: "",
              country: "ID",
              latitude: -6.2,
              longitude: 106.8,
            },
          ],
        }),
      ],
    });
    assert.equal(feed.ok, true);
    assert.match(feed.csv, /address,latitude,longitude/);
    assert.match(feed.csv, /"Jl\. QA, Tangerang, ID",-6\.2,106\.8/);
  });

  it("does not build a product file for an activities catalog", () => {
    const feed = buildCatalogFeed({ vertical: "activities", brand: "AtlasNow Commerce QA", products: [shape()] });
    assert.equal(feed.schema, "unsupported");
    assert.equal(feed.csv, "");
  });

  it("keeps the feed builder off the catalog batch endpoint", () => {
    const source = readFileSync(new URL("./catalog-feed.ts", import.meta.url), "utf8");
    const route = readFileSync(new URL("../../app/api/commerce/catalog/export/route.ts", import.meta.url), "utf8");
    assert.equal(source.includes("items_batch"), false);
    assert.equal(source.includes("pushCatalogItems"), false);
    assert.equal(route.includes("items_batch"), false);
    assert.equal(route.includes("pushCatalogItems"), false);
  });
});
