import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { listCatalogItems } from "@/lib/commerce/meta-graph";
import {
  catalogDiscoveryEnabled,
  catalogImportEnabled,
  importMetaCatalogProducts,
  listMetaCatalogProducts,
  parseIdrAmount,
  previewCatalogItem,
  type CatalogPreviewItem,
} from "@/lib/commerce/catalog-import";
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
  const keys = [
    "COMMERCE_CATALOG_IMPORT_ENABLED",
    "COMMERCE_CATALOG_IMPORT_TENANTS",
    "COMMERCE_CATALOG_DISCOVERY_ENABLED",
    "COMMERCE_CATALOG_DISCOVERY_TENANTS",
  ] as const;

  function restore(previous: Record<string, string | undefined>) {
    for (const key of keys) {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }

  it("keeps discovery and import on separate tenant lists", () => {
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    const qa = "commerceqa20261023tenant";
    const other = "cmsz2tcnk0001coqz71pqqjul";
    try {
      for (const key of keys) delete process.env[key];
      assert.equal(catalogDiscoveryEnabled(qa), false);
      assert.equal(catalogImportEnabled(qa), false);
      process.env.COMMERCE_CATALOG_DISCOVERY_ENABLED = "true";
      assert.equal(catalogDiscoveryEnabled(qa), false);
      process.env.COMMERCE_CATALOG_DISCOVERY_TENANTS = qa;
      assert.equal(catalogDiscoveryEnabled(qa), true);
      assert.equal(catalogDiscoveryEnabled(other), false);
      assert.equal(catalogImportEnabled(qa), false);
      process.env.COMMERCE_CATALOG_IMPORT_ENABLED = "true";
      assert.equal(catalogImportEnabled(qa), false);
      process.env.COMMERCE_CATALOG_IMPORT_TENANTS = qa;
      assert.equal(catalogImportEnabled(qa), true);
      assert.equal(catalogImportEnabled(other), false);
    } finally {
      restore(previous);
    }
  });

  it("does not call Graph for a read or a write while both gates are off", async () => {
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    const qa = "commerceqa20261023tenant";
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return Response.json({ data: [] });
    }) as typeof fetch;
    try {
      for (const key of keys) delete process.env[key];
      const listed = await listMetaCatalogProducts(qa, fetchImpl);
      assert.equal(listed.ok, true);
      if (!listed.ok || !("enabled" in listed)) return;
      assert.equal(listed.enabled, false);
      assert.equal(listed.discoveryEnabled, false);
      assert.equal(listed.importEnabled, false);
      const imported = await importMetaCatalogProducts({
        tenantId: qa,
        retailerIds: ["ATLASNOW-QA-SHAPE-001"],
        fetchImpl,
      });
      assert.equal(imported.ok, false);
      if (imported.ok) return;
      assert.equal(imported.status, 503);
      assert.equal(called, false);
    } finally {
      restore(previous);
    }
  });
});

describe("meta catalog price", () => {
  it("reads the QA whole-rupiah price", () => {
    assert.equal(parseIdrAmount("IDR28,780", "IDR"), 28780);
    assert.equal(parseIdrAmount("IDR 28,780", "IDR"), 28780);
    assert.equal(parseIdrAmount("28,780 IDR", ""), 28780);
    assert.equal(parseIdrAmount("28780 IDR", "IDR"), 28780);
    assert.equal(parseIdrAmount("28780.00 IDR", "IDR"), 28780);
    assert.equal(parseIdrAmount("Rp28.780", "IDR"), 28780);
    assert.equal(parseIdrAmount("28780", "IDR"), 28780);
  });

  it("rejects another currency and a fractional rupiah amount", () => {
    assert.equal(parseIdrAmount("9.99 USD", "USD"), null);
    assert.equal(parseIdrAmount("IDR28,780", "USD"), null);
    assert.equal(parseIdrAmount("28780 IDR", "USD"), null);
    assert.equal(parseIdrAmount("USD28,780", "IDR"), null);
    assert.equal(parseIdrAmount("28780.50 IDR", "IDR"), null);
    assert.equal(parseIdrAmount("IDR28,780.50", "IDR"), null);
    assert.equal(parseIdrAmount("-28780 IDR", "IDR"), null);
    assert.equal(parseIdrAmount("1000000001", "IDR"), null);
    assert.equal(parseIdrAmount("", "IDR"), null);
  });
});

const LIVE_QA_GRAPH_PRODUCT = {
  id: "28730199909979244",
  retailer_id: "ATLASNOW-QA-SHAPE-001",
  name: "BabyToys Puzzle Kayu Montessori - Shape Sorter",
  price: "IDR28,780",
  currency: "IDR",
  availability: "in stock",
  review_status: "",
};

describe("live QA catalog price", () => {
  it("parses the prefixed Meta price and keeps an unknown review", async () => {
    assert.equal(JSON.parse(JSON.stringify(LIVE_QA_GRAPH_PRODUCT)).id, "28730199909979244");
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      assert.equal(init?.method, undefined);
      assert.equal(url.pathname, "/v25.0/1649727826536046/products");
      assert.equal(url.pathname.includes("items_batch"), false);
      return Response.json({ data: [LIVE_QA_GRAPH_PRODUCT] });
    }) as typeof fetch;
    const listed = await listCatalogItems("1649727826536046", "token", fetchImpl);
    const row = listed.items[0];
    assert.equal(row?.id, "28730199909979244");
    assert.equal(typeof row?.id, "string");
    const item = previewCatalogItem(row, [], "1649727826536046");
    assert.equal(item.priceLabel, "IDR28,780");
    assert.equal(item.unitPriceIdr, 28780);
    assert.equal(item.currency, "IDR");
    assert.equal(item.mapping, "META_ONLY");
    assert.deepEqual(item.missing, []);
    assert.equal(item.importable, true);
    assert.equal(item.metaProductId, "28730199909979244");
    assert.equal(typeof item.metaProductId, "string");
    assert.equal(item.retailerId, "ATLASNOW-QA-SHAPE-001");
    assert.equal(item.availability, "in stock");
    assert.equal(item.mappedReview, "UNKNOWN");
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
