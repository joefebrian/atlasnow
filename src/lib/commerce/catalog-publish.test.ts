import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { importSnapshot, publishMethods, simulatedCatalogPublish } from "@/lib/commerce/catalog-publish";
import type { SyncProduct } from "@/lib/commerce/catalog-sync";

const product: SyncProduct = {
  sku: "ATLASNOW-QA-SHAPE-001",
  name: "QA shape edited",
  description: "Shape",
  category: "",
  imageUrl: "https://cdn.example/shape.jpg",
  hasImage: false,
  unitPriceIdr: 30000,
  publicUrl: "https://atlasnow.example/qa-shape",
  status: "ACTIVE",
  availability: "AVAILABLE",
  catalogEligibility: "UNKNOWN",
  variants: [],
};

const mapping = {
  retailerId: "ATLASNOW-QA-SHAPE-001",
  externalProductId: "meta-shape-1",
  metaProductId: "meta-shape-1",
  externalCatalogId: "cat-qa",
  mappingCurrent: true,
};

function preview(overrides: Partial<Parameters<typeof simulatedCatalogPublish>[0]> = {}) {
  return simulatedCatalogPublish({
    catalogState: "CONNECTED",
    liveSwitch: false,
    catalogId: "cat-qa",
    product,
    storedPublicUrl: "https://atlasnow.example/qa-shape",
    vertical: "commerce",
    outlets: [],
    parent: mapping,
    variants: [],
    snapshot: importSnapshot({
      name: "QA shape",
      description: "Shape",
      unitPriceIdr: 28780,
      availability: "AVAILABLE",
      imageUrl: "https://cdn.example/shape.jpg",
    }),
    reviewStatus: "APPROVED",
    lastImportedAt: "2026-10-24T00:00:00.000Z",
    lastSyncedAt: null,
    ...overrides,
  });
}

describe("simulated catalog publish", () => {
  it("previews an UPDATE and keeps the stored Meta ids", () => {
    const plan = preview();
    assert.equal(plan.networkCalled, false);
    assert.equal(plan.wouldSend, false);
    assert.equal(plan.reviewStatus, "APPROVED");
    assert.equal(plan.mappings.externalProductId, "meta-shape-1");
    assert.equal(plan.mappings.metaProductId, "meta-shape-1");
    assert.equal(plan.mappings.retailerId, "ATLASNOW-QA-SHAPE-001");
    assert.equal(plan.methods[0]?.method, "UPDATE");
    assert.equal(plan.batch?.requests[0]?.method, "UPDATE");
    assert.equal(plan.batch?.requests[0]?.data.id, "ATLASNOW-QA-SHAPE-001");
    assert.equal(plan.batch?.requests[0]?.data.link, "https://atlasnow.example/qa-shape");
    assert.equal(plan.batch?.requests[0]?.data.price, "30000 IDR");
    const price = plan.diffs.find((row) => row.field === "unitPriceIdr");
    const name = plan.diffs.find((row) => row.field === "name");
    assert.equal(price?.imported, "28780");
    assert.equal(price?.current, "30000");
    assert.equal(price?.changed, true);
    assert.equal(name?.changed, true);
    assert.match(plan.blockers.join(" "), /Live catalog push is off/);
    assert.match(plan.blockers.join(" "), /https product link/);
    assert.match(plan.acceptanceNote, /not a Meta product approval/);
  });

  it("uses CREATE when the product has no Meta id", () => {
    const plan = preview({
      parent: null,
      snapshot: "",
      lastImportedAt: null,
      reviewStatus: "UNKNOWN",
    });
    assert.equal(plan.methods[0]?.method, "CREATE");
    assert.equal(plan.batch?.requests[0]?.method, "CREATE");
    assert.equal(plan.hasSnapshot, false);
    assert.equal(plan.networkCalled, false);
  });

  it("does not UPDATE a historical mapping", () => {
    const methods = publishMethods({
      catalogId: "cat-new",
      parentSku: product.sku,
      variantSkus: [],
      parent: { ...mapping, mappingCurrent: false },
      variants: [],
    });
    assert.equal(methods[0]?.method, "CREATE");
  });

  it("blocks a SKU that does not match the stored retailer id", () => {
    const plan = preview({ parent: { ...mapping, retailerId: "OLD-SKU" } });
    assert.equal(plan.methods[0]?.method, "BLOCKED");
    assert.equal(plan.batch, null);
    assert.match(plan.blockers.join(" "), /does not match the stored Meta retailer id/);
  });

  it("does not simulate a local publish without coordinates", () => {
    const plan = preview({
      vertical: "offline_commerce",
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
    });
    assert.equal(plan.batch, null);
    assert.match(plan.blockers.join(" "), /latitude/);
    assert.equal(plan.networkCalled, false);
  });

  it("keeps the preview module off the live batch call", () => {
    const source = readFileSync(new URL("./catalog-publish.ts", import.meta.url), "utf8");
    assert.equal(source.includes("items_batch"), false);
    assert.equal(source.includes("pushCatalogItems"), false);
    assert.equal(source.includes("graph.facebook.com"), false);
  });
});
