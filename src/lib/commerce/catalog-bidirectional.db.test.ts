import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/google/crypto";
import { exportTenantCatalogFeed } from "@/lib/commerce/catalog-export";
import { importMetaCatalogProducts } from "@/lib/commerce/catalog-import";
import { previewCatalogSync } from "@/lib/commerce/connection-service";
import { updateCommerceProduct } from "@/lib/commerce/service";

function localDb() {
  try {
    const host = new URL(process.env.DATABASE_URL || "").hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function graphFetch(calls: string[]) {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    assert.equal(url.includes("items_batch"), false);
    return Response.json({
      data: [
        {
          id: "meta-shape-1",
          retailer_id: "ATLASNOW-QA-SHAPE-001",
          name: "QA shape",
          description: "Shape",
          price: "28780 IDR",
          currency: "IDR",
          availability: "in stock",
          image_url: "https://cdn.example/shape.jpg",
          review_status: "approved",
        },
      ],
    });
  }) as typeof fetch;
}

describe("catalog import edit preview and file", { skip: localDb() ? false : "local database only", concurrency: 1 }, () => {
  const stamp = `feed-test-${Date.now()}`;
  const ids: string[] = [];
  const previousImport = process.env.COMMERCE_CATALOG_IMPORT_ENABLED;
  const previousTenants = process.env.COMMERCE_CATALOG_IMPORT_TENANTS;
  const previousSync = process.env.COMMERCE_CATALOG_SYNC_ENABLED;
  let tenantA = "";
  let tenantB = "";

  before(async () => {
    process.env.COMMERCE_CATALOG_IMPORT_ENABLED = "true";
    delete process.env.COMMERCE_CATALOG_SYNC_ENABLED;
    const a = await prisma.tenant.create({ data: { name: "AtlasNow Commerce QA", slug: `${stamp}-a`, type: "CLIENT" } });
    const b = await prisma.tenant.create({ data: { name: "Other brand", slug: `${stamp}-b`, type: "CLIENT" } });
    ids.push(a.id, b.id);
    tenantA = a.id;
    tenantB = b.id;
    process.env.COMMERCE_CATALOG_IMPORT_TENANTS = `${a.id},${b.id}`;
    await prisma.commerceConnection.create({
      data: {
        tenantId: tenantA,
        catalogId: `catalog-${stamp}`,
        catalogName: "QA",
        catalogVertical: "commerce",
        wabaId: `waba-${stamp}`,
        phoneNumberId: `phone-${stamp}`,
        tokenEnc: encryptSecret("feed-test-token"),
      },
    });
    await prisma.commerceConnection.create({
      data: {
        tenantId: tenantB,
        catalogId: `catalog-b-${stamp}`,
        catalogName: "Other",
        catalogVertical: "commerce",
        tokenEnc: encryptSecret("feed-test-token-b"),
      },
    });
  });

  after(async () => {
    if (previousImport == null) delete process.env.COMMERCE_CATALOG_IMPORT_ENABLED;
    else process.env.COMMERCE_CATALOG_IMPORT_ENABLED = previousImport;
    if (previousTenants == null) delete process.env.COMMERCE_CATALOG_IMPORT_TENANTS;
    else process.env.COMMERCE_CATALOG_IMPORT_TENANTS = previousTenants;
    if (previousSync == null) delete process.env.COMMERCE_CATALOG_SYNC_ENABLED;
    else process.env.COMMERCE_CATALOG_SYNC_ENABLED = previousSync;
    if (ids.length) await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("imports, edits, previews an UPDATE, and withholds a file until the link exists", async () => {
    const calls: string[] = [];
    const imported = await importMetaCatalogProducts({
      tenantId: tenantA,
      retailerIds: ["ATLASNOW-QA-SHAPE-001"],
      catalogId: `catalog-${stamp}`,
      fetchImpl: graphFetch(calls),
    });
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    assert.equal(imported.results[0]?.outcome, "created");
    const productId = imported.results[0]?.productId || "";
    const link = await prisma.commerceCatalogLink.findFirst({ where: { productId, tenantId: tenantA } });
    assert.equal(link?.externalProductId, "meta-shape-1");
    assert.equal(link?.metaProductId, "meta-shape-1");
    assert.equal(link?.retailerId, "ATLASNOW-QA-SHAPE-001");
    assert.equal(link?.syncStatus, "IMPORTED");
    assert.equal(link?.lastSyncedAt, null);
    const snapshot = JSON.parse(link?.sourceSnapshot || "{}") as { unitPriceIdr?: number; name?: string };
    assert.equal(snapshot.unitPriceIdr, 28780);
    assert.equal(snapshot.name, "QA shape");

    const blocked = await exportTenantCatalogFeed(tenantA, [productId]);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.csv, "");
    assert.equal(blocked.networkCalled, false);
    assert.equal(blocked.missing.some((row) => row.field === "link"), true);

    const current = await prisma.commerceProduct.findFirst({ where: { id: productId, tenantId: tenantA } });
    const edited = await updateCommerceProduct(
      tenantA,
      productId,
      {
        sku: "ATLASNOW-QA-SHAPE-001",
        name: "QA shape edited",
        description: "Shape",
        category: "",
        imageUrl: "https://cdn.example/shape.jpg",
        publicUrl: "https://atlasnow.example/qa-shape",
        unitPriceIdr: 30000,
        status: "ACTIVE",
        availability: "AVAILABLE",
        catalogEligibility: "UNKNOWN",
        catalogEligibilityNote: "",
        variants: [],
        outlets: [],
      },
      "missing-user",
      current?.updatedAt.toISOString()
    );
    assert.equal(edited.ok, true);
    const afterEdit = await prisma.commerceCatalogLink.findFirst({ where: { productId, tenantId: tenantA } });
    assert.equal(afterEdit?.externalProductId, "meta-shape-1");
    assert.equal(afterEdit?.metaProductId, "meta-shape-1");
    assert.equal(afterEdit?.externalCatalogId, `catalog-${stamp}`);
    assert.equal(afterEdit?.retailerId, "ATLASNOW-QA-SHAPE-001");
    assert.equal(JSON.parse(afterEdit?.sourceSnapshot || "{}").unitPriceIdr, 28780);

    const preview = await previewCatalogSync(tenantA, productId);
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    assert.equal(preview.networkCalled, false);
    assert.equal(preview.wouldSend, false);
    assert.equal(preview.reviewStatus, "APPROVED");
    assert.equal(preview.methods[0]?.method, "UPDATE");
    assert.equal(preview.batch?.requests[0]?.method, "UPDATE");
    assert.equal(preview.batch?.requests[0]?.data.id, "ATLASNOW-QA-SHAPE-001");
    assert.equal(preview.mappings.metaProductId, "meta-shape-1");
    assert.equal(preview.mappings.externalProductId, "meta-shape-1");
    assert.equal(preview.diffs.find((row) => row.field === "unitPriceIdr")?.imported, "28780");
    assert.equal(preview.diffs.find((row) => row.field === "unitPriceIdr")?.current, "30000");
    assert.equal(preview.wouldSend, false);
    assert.equal(preview.productBlockers.some((row) => /https product link|no public URL/.test(row)), false);
    assert.match(preview.executionBlockers.join(" "), /Live catalog push is off/);
    assert.equal(preview.readiness, "Product data is ready. Live send stays off.");
    assert.equal(preview.methods[0]?.method, "UPDATE");

    const file = await exportTenantCatalogFeed(tenantA, [productId]);
    assert.equal(file.ok, true);
    assert.equal(file.networkCalled, false);
    assert.match(file.csv, /ATLASNOW-QA-SHAPE-001/);
    assert.match(file.csv, /30000 IDR/);
    assert.match(file.csv, /https:\/\/atlasnow\.example\/qa-shape/);
    assert.equal(file.csv.includes("meta-shape-1"), false);

    await prisma.commerceProduct.create({
      data: {
        tenantId: tenantB,
        sku: "OTHER-SKU",
        name: "Other",
        description: "Other item",
        imageUrl: "https://cdn.example/other.jpg",
        publicUrl: "https://atlasnow.example/other",
        unitPriceIdr: 1000,
        status: "ACTIVE",
        availability: "AVAILABLE",
        catalogEligibility: "UNKNOWN",
      },
    });
    const other = await exportTenantCatalogFeed(tenantB);
    assert.equal(other.ok, true);
    assert.equal(other.csv.includes("ATLASNOW-QA-SHAPE-001"), false);
    assert.match(other.csv, /OTHER-SKU/);
    const again = await exportTenantCatalogFeed(tenantA);
    assert.equal(again.csv.includes("OTHER-SKU"), false);

    await prisma.commerceConnection.update({
      where: { tenantId: tenantA },
      data: { catalogVertical: "offline_commerce" },
    });
    const local = await exportTenantCatalogFeed(tenantA, [productId]);
    assert.equal(local.ok, false);
    assert.equal(local.csv, "");
    assert.match(local.blockers.map((row) => row.message).join(" "), /stored outlet|Location information is missing or incomplete/);
    assert.equal(calls.some((url) => url.includes("items_batch")), false);
    assert.notEqual(process.env.COMMERCE_CATALOG_SYNC_ENABLED, "true");
  });
});
