import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { listCatalogItems } from "@/lib/commerce/meta-graph";
import { catalogImportEnabled, parseIdrAmount, previewCatalogItem, type CatalogPreviewItem } from "@/lib/commerce/catalog-import";
import type { RemoteCatalogRow } from "@/lib/commerce/meta-graph";

const qa = (overrides?: Partial<RemoteCatalogRow>): RemoteCatalogRow => ({
  id: "meta-shape-1",
  retailerId: "ATLASNOW-QA-SHAPE-001",
  name: "QA shape",
  description: "A shape",
  price: "28780 IDR",
  currency: "IDR",
  availability: "in stock",
  imageUrl: "https://cdn.example/shape.jpg",
  reviewStatus: "approved",
  groupId: "",
  variantKeys: [],
  ...overrides,
});

describe("catalog import gate", () => {
  it("stays off for every merchant unless that tenant is listed", () => {
    const previousEnabled = process.env.COMMERCE_CATALOG_IMPORT_ENABLED;
    const previousTenants = process.env.COMMERCE_CATALOG_IMPORT_TENANTS;
    const qa = "commerceqa20261023tenant";
    const other = "cmsz2tcnk0001coqz71pqqjul";
    try {
      delete process.env.COMMERCE_CATALOG_IMPORT_ENABLED;
      delete process.env.COMMERCE_CATALOG_IMPORT_TENANTS;
      assert.equal(catalogImportEnabled(qa), false);
      process.env.COMMERCE_CATALOG_IMPORT_ENABLED = "true";
      assert.equal(catalogImportEnabled(qa), false);
      assert.equal(catalogImportEnabled(other), false);
      process.env.COMMERCE_CATALOG_IMPORT_TENANTS = qa;
      assert.equal(catalogImportEnabled(qa), true);
      assert.equal(catalogImportEnabled(other), false);
    } finally {
      if (previousEnabled == null) delete process.env.COMMERCE_CATALOG_IMPORT_ENABLED;
      else process.env.COMMERCE_CATALOG_IMPORT_ENABLED = previousEnabled;
      if (previousTenants == null) delete process.env.COMMERCE_CATALOG_IMPORT_TENANTS;
      else process.env.COMMERCE_CATALOG_IMPORT_TENANTS = previousTenants;
    }
  });
});

describe("meta catalog price", () => {
  it("reads the QA whole-rupiah price", () => {
    assert.equal(parseIdrAmount("28780 IDR", "IDR"), 28780);
    assert.equal(parseIdrAmount("28,780 IDR", ""), 28780);
    assert.equal(parseIdrAmount("28780.00 IDR", "IDR"), 28780);
    assert.equal(parseIdrAmount("Rp28.780", "IDR"), 28780);
    assert.equal(parseIdrAmount("28780", "IDR"), 28780);
  });

  it("rejects another currency and a fractional rupiah amount", () => {
    assert.equal(parseIdrAmount("9.99 USD", "USD"), null);
    assert.equal(parseIdrAmount("28780.50 IDR", "IDR"), null);
    assert.equal(parseIdrAmount("", "IDR"), null);
  });
});

describe("meta catalog preview", () => {
  it("shows the QA sku and price as meta only", () => {
    const item = previewCatalogItem(qa(), [], "catalog-qa");
    assert.equal(item.retailerId, "ATLASNOW-QA-SHAPE-001");
    assert.equal(item.unitPriceIdr, 28780);
    assert.equal(item.mapping, "META_ONLY");
    assert.equal(item.importable, true);
    assert.equal(item.mappedReview, "APPROVED");
    assert.equal(item.imageUrl, "https://cdn.example/shape.jpg");
    assert.equal(item.availability, "in stock");
  });

  it("marks an existing different product as a conflict and a matching meta id as imported", () => {
    const local = {
      sku: "ATLASNOW-QA-SHAPE-001",
      kind: "product" as const,
      productId: "product-1",
      unitPriceIdr: 1000,
      metaProductId: "",
      catalogId: "",
      mappingCurrent: true,
      lastImportedAt: null,
      lastSyncedAt: null,
    };
    const conflict = previewCatalogItem(qa(), [local], "catalog-qa");
    assert.equal(conflict.mapping, "CONFLICT");
    assert.equal(conflict.importable, false);
    assert.equal(conflict.atlasPriceIdr, 1000);

    const imported = previewCatalogItem(
      qa(),
      [{ ...local, unitPriceIdr: 28780, metaProductId: "meta-shape-1", catalogId: "catalog-qa", lastImportedAt: new Date("2026-10-24T00:00:00.000Z") }],
      "catalog-qa"
    );
    assert.equal(imported.mapping, "IMPORTED");
    assert.equal(imported.importable, false);
    assert.equal(imported.lastImportedAt, "2026-10-24T00:00:00.000Z");
    assert.equal(imported.lastSyncedAt, null);
  });

  it("blocks variants, missing fields, and does not treat review approval as internal eligibility", () => {
    const variant = previewCatalogItem(qa({ variantKeys: ["color"] }), [], "catalog-qa");
    assert.equal(variant.variantBlocked, true);
    assert.equal(variant.importable, false);
    const missing = previewCatalogItem(qa({ name: "", price: "" }), [], "catalog-qa");
    assert.equal(missing.importable, false);
    assert.ok(missing.missing.includes("name"));
    assert.ok(missing.missing.includes("IDR price"));
    const source = readFileSync(new URL("./catalog-import.ts", import.meta.url), "utf8");
    assert.equal(source.includes("items_batch"), false);
    assert.equal(source.includes("pushCatalogItems"), false);
    assert.equal(source.includes('catalogEligibility: "UNKNOWN"'), true);
    assert.equal(source.includes("ELIGIBLE"), false);
    const view: CatalogPreviewItem = variant;
    assert.equal(view.mappedReview, "APPROVED");
  });
});

describe("meta catalog pagination", () => {
  it("follows the cursor and does not post a batch", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(`${url.pathname}?after=${url.searchParams.get("after") || ""}`);
      assert.equal(url.pathname.includes("items_batch"), false);
      assert.equal(url.searchParams.get("access_token"), "token");
      if (!url.searchParams.get("after")) {
        return Response.json({
          data: [{ id: "other", retailer_id: "OTHER", name: "Other", price: "1000 IDR", currency: "IDR" }],
          paging: { cursors: { after: "page-2" } },
        });
      }
      return Response.json({
        data: [
          {
            id: "meta-shape-1",
            retailer_id: "ATLASNOW-QA-SHAPE-001",
            name: "QA shape",
            price: "28780 IDR",
            currency: "IDR",
            availability: "in stock",
            image_url: "https://cdn.example/shape.jpg",
            review_status: "approved",
          },
        ],
      });
    }) as typeof fetch;
    const listed = await listCatalogItems("catalog-qa", "token", fetchImpl);
    assert.equal(calls.length, 2);
    assert.match(calls[1], /after=page-2/);
    assert.equal(listed.truncated, false);
    assert.equal(listed.items[1]?.retailerId, "ATLASNOW-QA-SHAPE-001");
    assert.equal(listed.items[1]?.price, "28780 IDR");
  });
});
