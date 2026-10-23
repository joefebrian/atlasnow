import "dotenv/config";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import type { ProductInput } from "@/lib/commerce/validate";
import { encryptSecret } from "@/lib/google/crypto";
import { getCommerceConnection, requestCatalogSync } from "@/lib/commerce/connection-service";
import {
  archiveCommerceProduct,
  createCommerceProduct,
  ensureCommerceReadiness,
  listCommerceProducts,
  recordCatalogSyncRefusal,
  updateCommerceProduct,
} from "@/lib/commerce/service";

function localDb() {
  try {
    const host = new URL(process.env.DATABASE_URL || "").hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

const input = (locationId: string): ProductInput => ({
  sku: "SKU-1",
  name: "Package",
  description: "Fixed package",
  category: "Admission",
  imageUrl: null,
  unitPriceIdr: 100000,
  status: "ACTIVE",
  availability: "AVAILABLE",
  catalogEligibility: "UNKNOWN",
  catalogEligibilityNote: "",
  variants: [{ sku: "SKU-1-W", name: "Weekend", unitPriceIdr: 120000, status: "ACTIVE" }],
  outlets: [{ locationId, availability: "AVAILABLE" }],
});

describe("commerce persistence", { skip: localDb() ? false : "local database only" }, () => {
  const stamp = `commerce-test-${Date.now()}`;
  const ids: string[] = [];

  after(async () => {
    if (ids.length) {
      await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
  });

  it("saves a product for one merchant and refuses another merchant, payment, and catalog sync", async () => {
    const tenantA = await prisma.tenant.create({
      data: { name: "Commerce A", slug: `${stamp}-a`, type: "CLIENT" },
    });
    const tenantB = await prisma.tenant.create({
      data: { name: "Commerce B", slug: `${stamp}-b`, type: "CLIENT" },
    });
    ids.push(tenantA.id, tenantB.id);
    const locationA = await prisma.location.create({
      data: { tenantId: tenantA.id, name: "Outlet A", atlasLocationId: `${stamp}-a`, kind: "STORE" },
    });
    const locationB = await prisma.location.create({
      data: { tenantId: tenantB.id, name: "Outlet B", atlasLocationId: `${stamp}-b`, kind: "STORE" },
    });

    const created = await createCommerceProduct(tenantA.id, input(locationA.id), "missing-user");
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.product.catalog.syncStatus, "NOT_CONNECTED");
    assert.equal(created.product.catalog.externalProductId, "");
    assert.equal(created.product.variants[0]?.sku, "SKU-1-W");
    assert.equal(created.product.outlets[0]?.locationId, locationA.id);
    assert.equal(created.product.catalogEligibility, "UNKNOWN");

    assert.equal((await listCommerceProducts(tenantB.id, "ALL")).length, 0);
    const cross = await updateCommerceProduct(
      tenantB.id,
      created.product.id,
      input(locationB.id),
      "missing-user",
      created.product.updatedAt
    );
    assert.equal(cross.ok, false);
    assert.equal((await listCommerceProducts(tenantA.id, "ALL"))[0]?.name, "Package");

    const sharedSku = await createCommerceProduct(tenantB.id, input(locationB.id), "missing-user");
    assert.equal(sharedSku.ok, true);

    const caseDup = await createCommerceProduct(
      tenantA.id,
      { ...input(locationA.id), sku: "sku-1", variants: [] },
      "missing-user"
    );
    assert.equal(caseDup.ok, false);

    const foreign = await createCommerceProduct(tenantA.id, { ...input(locationB.id), sku: "SKU-2" }, "missing-user");
    assert.equal(foreign.ok, false);

    const edited = await updateCommerceProduct(
      tenantA.id,
      created.product.id,
      {
        ...input(locationA.id),
        unitPriceIdr: 110000,
        variants: [{ sku: "SKU-1-W", name: "Weekend", unitPriceIdr: 130000, status: "ACTIVE" }],
      },
      "missing-user",
      created.product.updatedAt
    );
    assert.equal(edited.ok, true);
    if (!edited.ok) return;
    assert.equal(edited.product.unitPriceIdr, 110000);
    assert.equal(Number.isInteger(edited.product.unitPriceIdr), true);
    assert.equal(edited.product.variants[0]?.unitPriceIdr, 130000);
    assert.equal(Number.isInteger(edited.product.variants[0]?.unitPriceIdr), true);

    const stale = await updateCommerceProduct(
      tenantA.id,
      created.product.id,
      { ...input(locationA.id), status: "ACTIVE", name: "Stale" },
      "missing-user",
      created.product.updatedAt
    );
    assert.equal(stale.ok, false);

    const archived = await archiveCommerceProduct(
      tenantA.id,
      created.product.id,
      edited.product.updatedAt,
      "missing-user"
    );
    assert.equal(archived.ok, true);
    if (!archived.ok) return;
    assert.equal(archived.product.status, "ARCHIVED");
    assert.equal(archived.product.variants[0]?.sku, "SKU-1-W");
    assert.equal(archived.product.outlets[0]?.locationId, locationA.id);
    const revive = await updateCommerceProduct(
      tenantA.id,
      created.product.id,
      { ...input(locationA.id), status: "ACTIVE" },
      "missing-user",
      archived.product.updatedAt
    );
    assert.equal(revive.ok, false);
    const stored = await prisma.commerceProduct.findFirst({ where: { id: created.product.id, tenantId: tenantA.id } });
    assert.equal(stored?.status, "ARCHIVED");
    assert.equal((await listCommerceProducts(tenantA.id, "ACTIVE")).length, 0);

    const sync = await recordCatalogSyncRefusal(tenantA.id, created.product.id, "missing-user");
    assert.equal(sync.ok, true);
    if (!sync.ok) return;
    assert.equal(sync.plan.networkCalled, false);
    const link = await prisma.commerceCatalogLink.findFirst({ where: { tenantId: tenantA.id, productId: created.product.id } });
    assert.equal(link?.syncStatus, "NOT_CONNECTED");
    assert.equal(link?.externalProductId, "");
    assert.match(link?.lastError || "", /No request was sent/);

    const readiness = await ensureCommerceReadiness(tenantA.id);
    assert.equal(readiness.whatsappBusiness.status, "NOT_CONNECTED");
    assert.equal(readiness.metaCatalog.status, "NOT_CONNECTED");
    assert.equal(readiness.paymentGateway.status, "NOT_CONNECTED");
    const row = await prisma.commerceReadiness.findUnique({ where: { tenantId: tenantA.id } });
    assert.equal(row?.paymentStatus, "NOT_CONNECTED");
    assert.equal(row?.paymentProviderLabel, "");
  });

  it("isolates a catalog connection and does not send a blocked sync twice", async () => {
    const tenantA = await prisma.tenant.create({
      data: { name: "Commerce C", slug: `${stamp}-c`, type: "CLIENT" },
    });
    const tenantB = await prisma.tenant.create({
      data: { name: "Commerce D", slug: `${stamp}-d`, type: "CLIENT" },
    });
    ids.push(tenantA.id, tenantB.id);
    const locationA = await prisma.location.create({
      data: { tenantId: tenantA.id, name: "Outlet C", atlasLocationId: `${stamp}-c`, kind: "STORE" },
    });
    await prisma.commerceConnection.create({
      data: {
        tenantId: tenantA.id,
        tokenEnc: encryptSecret("merchant-a-token"),
        grantedScopes: "business_management,whatsapp_business_management",
        permissionError: true,
        wabaId: "waba-a",
        phoneNumberId: "phone-a",
        phoneMasked: "•••• 1111",
      },
    });
    const viewA = await getCommerceConnection(tenantA.id);
    const viewB = await getCommerceConnection(tenantB.id);
    assert.equal(viewA.catalog.status, "PERMISSION_ERROR");
    assert.equal(viewA.whatsapp.status, "CONNECTED");
    assert.equal(viewB.catalog.status, "NOT_CONNECTED");
    assert.equal(JSON.stringify(viewA).includes("merchant-a-token"), false);
    assert.equal(viewA.payment.status, "NOT_CONNECTED");

    const created = await createCommerceProduct(
      tenantA.id,
      { ...input(locationA.id), sku: "SYNC-1", category: "Package", variants: [] },
      "missing-user"
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const calls: string[] = [];
    const first = await requestCatalogSync({
      tenantId: tenantA.id,
      productId: created.product.id,
      actorId: "missing-user",
      liveSwitch: true,
      publicUrl: "https://brand.example/sync",
      fetchImpl: (async () => {
        calls.push("sent");
        return new Response("{}", { status: 200 });
      }) as typeof fetch,
    });
    const second = await requestCatalogSync({
      tenantId: tenantA.id,
      productId: created.product.id,
      actorId: "missing-user",
      liveSwitch: true,
      publicUrl: "https://brand.example/sync",
      fetchImpl: (async () => {
        calls.push("sent");
        return new Response("{}", { status: 200 });
      }) as typeof fetch,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.plan.networkCalled, false);
    assert.equal(second.plan.networkCalled, false);
    assert.equal(calls.length, 0);
    assert.equal(first.jobId, second.jobId);
    const leaked = await requestCatalogSync({
      tenantId: tenantB.id,
      productId: created.product.id,
      actorId: "missing-user",
    });
    assert.equal(leaked.ok, false);
  });
});
