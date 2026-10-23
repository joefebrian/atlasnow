import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/google/crypto";
import { importMetaCatalogProducts, listMetaCatalogProducts } from "@/lib/commerce/catalog-import";
import { listCommerceProducts } from "@/lib/commerce/service";

function localDb() {
  try {
    const host = new URL(process.env.DATABASE_URL || "").hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function qaItem(overrides?: Record<string, unknown>) {
  return {
    id: "meta-shape-1",
    retailer_id: "ATLASNOW-QA-SHAPE-001",
    name: "QA shape",
    description: "Shape",
    price: "28780 IDR",
    currency: "IDR",
    availability: "in stock",
    image_url: "https://cdn.example/shape.jpg",
    review_status: "approved",
    ...overrides,
  };
}

function graphFetch(items: Record<string, unknown>[], calls: string[] = []) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    assert.equal(url.includes("items_batch"), false);
    assert.equal(init?.method, undefined);
    if (url.includes("permission-catalog")) {
      return Response.json({ error: { message: "Requires catalog_management permission", code: 200 } }, { status: 400 });
    }
    return Response.json({ data: items });
  }) as typeof fetch;
}

describe("meta catalog import", { skip: localDb() ? false : "local database only", concurrency: 1 }, () => {
  const stamp = `import-test-${Date.now()}`;
  const ids: string[] = [];
  const previous = process.env.COMMERCE_CATALOG_IMPORT_ENABLED;
  let tenantA = "";
  let tenantB = "";

  before(async () => {
    process.env.COMMERCE_CATALOG_IMPORT_ENABLED = "true";
    const a = await prisma.tenant.create({ data: { name: "Import A", slug: `${stamp}-a`, type: "CLIENT" } });
    const b = await prisma.tenant.create({ data: { name: "Import B", slug: `${stamp}-b`, type: "CLIENT" } });
    ids.push(a.id, b.id);
    tenantA = a.id;
    tenantB = b.id;
    await prisma.commerceConnection.create({
      data: {
        tenantId: tenantA,
        catalogId: `catalog-${stamp}`,
        catalogName: "QA",
        wabaId: `waba-${stamp}`,
        phoneNumberId: `phone-${stamp}`,
        tokenEnc: encryptSecret("import-test-token"),
      },
    });
    await prisma.commerceConnection.create({
      data: {
        tenantId: tenantB,
        catalogId: `catalog-b-${stamp}`,
        catalogName: "Other",
        tokenEnc: encryptSecret("import-test-token-b"),
      },
    });
  });

  after(async () => {
    if (previous == null) delete process.env.COMMERCE_CATALOG_IMPORT_ENABLED;
    else process.env.COMMERCE_CATALOG_IMPORT_ENABLED = previous;
    if (ids.length) await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("imports the QA sku once and keeps the external ids", async () => {
    const calls: string[] = [];
    const fetchImpl = graphFetch([qaItem()], calls);
    const listed = await listMetaCatalogProducts(tenantA, fetchImpl);
    assert.equal(listed.ok, true);
    if (!listed.ok || !("products" in listed)) return;
    const preview = listed.products.find((item) => item.retailerId === "ATLASNOW-QA-SHAPE-001");
    assert.equal(preview?.unitPriceIdr, 28780);
    assert.equal(preview?.mapping, "META_ONLY");

    const first = await importMetaCatalogProducts({
      tenantId: tenantA,
      retailerIds: ["ATLASNOW-QA-SHAPE-001"],
      catalogId: `catalog-${stamp}`,
      fetchImpl,
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.results[0]?.outcome, "created");

    const second = await importMetaCatalogProducts({
      tenantId: tenantA,
      retailerIds: ["ATLASNOW-QA-SHAPE-001"],
      catalogId: `catalog-${stamp}`,
      fetchImpl,
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.results[0]?.outcome, "already_imported");

    const products = await listCommerceProducts(tenantA, "ALL");
    assert.equal(products.filter((item) => item.sku === "ATLASNOW-QA-SHAPE-001").length, 1);
    const product = products.find((item) => item.sku === "ATLASNOW-QA-SHAPE-001");
    assert.equal(product?.unitPriceIdr, 28780);
    assert.equal(product?.catalogEligibility, "UNKNOWN");
    assert.equal(product?.availability, "AVAILABLE");
    assert.equal(product?.catalog.syncStatus, "IMPORTED");
    assert.equal(product?.catalog.externalProductId, "meta-shape-1");
    assert.equal(product?.catalog.reviewStatus, "APPROVED");
    assert.ok(product?.catalog.lastImportedAt);
    assert.equal(product?.catalog.lastSyncedAt, null);
    const link = await prisma.commerceCatalogLink.findFirstOrThrow({ where: { tenantId: tenantA, retailerId: "ATLASNOW-QA-SHAPE-001" } });
    assert.equal(link.metaProductId, "meta-shape-1");
    assert.equal(link.externalCatalogId, `catalog-${stamp}`);
    assert.equal(link.lastSyncedAt, null);
    assert.equal((await listCommerceProducts(tenantB, "ALL")).length, 0);
    assert.equal(calls.some((url) => url.includes("items_batch")), false);
  });

  it("does not overwrite an existing sku, another tenant, or a changed catalog", async () => {
    await prisma.commerceProduct.create({
      data: { tenantId: tenantA, sku: "SKU-TAKEN", name: "Kept", unitPriceIdr: 1000, catalogEligibility: "UNKNOWN" },
    });
    const fetchImpl = graphFetch([qaItem({ id: "meta-taken", retailer_id: "SKU-TAKEN", price: "5000 IDR" })]);
    const conflict = await importMetaCatalogProducts({
      tenantId: tenantA,
      retailerIds: ["SKU-TAKEN"],
      catalogId: `catalog-${stamp}`,
      fetchImpl,
    });
    assert.equal(conflict.ok, true);
    if (!conflict.ok) return;
    assert.equal(conflict.results[0]?.outcome, "conflict");
    const kept = await prisma.commerceProduct.findFirstOrThrow({ where: { tenantId: tenantA, sku: "SKU-TAKEN" } });
    assert.equal(kept.unitPriceIdr, 1000);

    const other = await importMetaCatalogProducts({
      tenantId: tenantB,
      retailerIds: ["ATLASNOW-QA-SHAPE-001"],
      catalogId: `catalog-b-${stamp}`,
      fetchImpl: graphFetch([qaItem({ id: "meta-b" })]),
    });
    assert.equal(other.ok, true);
    if (!other.ok) return;
    assert.equal(other.results[0]?.outcome, "created");
    const rows = await prisma.commerceProduct.findMany({ where: { sku: "ATLASNOW-QA-SHAPE-001" }, select: { tenantId: true } });
    assert.deepEqual(rows.map((row) => row.tenantId).sort(), [tenantA, tenantB].sort());
    const linkA = await prisma.commerceCatalogLink.findFirstOrThrow({ where: { tenantId: tenantA, retailerId: "ATLASNOW-QA-SHAPE-001" } });
    assert.equal(linkA.metaProductId, "meta-shape-1");

    const stale = await importMetaCatalogProducts({
      tenantId: tenantA,
      retailerIds: ["ATLASNOW-QA-SHAPE-001"],
      catalogId: "catalog-old",
      fetchImpl,
    });
    assert.equal(stale.ok, false);
    if (stale.ok) return;
    assert.equal(stale.status, 409);
  });

  it("stops on a permission error and when the switch is off", async () => {
    await prisma.commerceConnection.update({ where: { tenantId: tenantB }, data: { catalogId: "permission-catalog" } });
    const denied = await listMetaCatalogProducts(tenantB, graphFetch([], []));
    assert.equal(denied.ok, false);
    if (denied.ok) return;
    assert.equal(denied.status, 403);
    const before = await prisma.commerceProduct.count({ where: { tenantId: tenantB } });

    process.env.COMMERCE_CATALOG_IMPORT_ENABLED = "false";
    let called = false;
    const disabled = await listMetaCatalogProducts(tenantA, (async () => {
      called = true;
      return Response.json({ data: [] });
    }) as typeof fetch);
    assert.equal(disabled.ok, true);
    if (!disabled.ok || !("enabled" in disabled)) return;
    assert.equal(disabled.enabled, false);
    assert.equal(called, false);
    const blocked = await importMetaCatalogProducts({ tenantId: tenantA, retailerIds: ["NEW-SKU"], fetchImpl: graphFetch([]) });
    assert.equal(blocked.ok, false);
    assert.equal(await prisma.commerceProduct.count({ where: { tenantId: tenantB } }), before);
    process.env.COMMERCE_CATALOG_IMPORT_ENABLED = "true";
  });
});
