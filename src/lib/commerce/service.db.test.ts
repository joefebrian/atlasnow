import "dotenv/config";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import type { ProductInput } from "@/lib/commerce/validate";
import { encryptSecret } from "@/lib/google/crypto";
import { consumeCommerceState, issueCommerceState } from "@/lib/commerce/meta-oauth";
import {
  discoverCommerceAssets,
  getCommerceConnection,
  linkCommerceAssets,
  requestCatalogSync,
  saveCommerceToken,
} from "@/lib/commerce/connection-service";
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

  const app = { appId: "app-test", appSecret: "app-secret" };
  const scopes = ["business_management", "whatsapp_business_management", "catalog_management"];

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status });
  }

  async function connectedProduct(label: string) {
    const tenant = await prisma.tenant.create({
      data: { name: label, slug: `${stamp}-${label}`, type: "CLIENT" },
    });
    ids.push(tenant.id);
    const location = await prisma.location.create({
      data: { tenantId: tenant.id, name: label, atlasLocationId: `${stamp}-${label}`, kind: "STORE" },
    });
    await prisma.commerceConnection.create({
      data: {
        tenantId: tenant.id,
        tokenEnc: encryptSecret("EAA-merchant-token"),
        grantedScopes: scopes.join(","),
        businessId: "biz-1",
        businessName: "First",
        catalogId: "cat-1",
        catalogName: "Shop",
        wabaId: "waba-1",
        phoneNumberId: "phone-1",
        phoneMasked: "•••• 2222",
      },
    });
    const created = await createCommerceProduct(
      tenant.id,
      {
        sku: "SYNC-OK",
        name: "Day pass",
        description: "Entry",
        category: "Package",
        imageUrl: "https://cdn.example/pass.jpg",
        unitPriceIdr: 99000,
        status: "ACTIVE",
        availability: "AVAILABLE",
        catalogEligibility: "UNKNOWN",
        catalogEligibilityNote: "",
        variants: [{ sku: "SYNC-OK-W", name: "Weekend", unitPriceIdr: 120000, status: "ACTIVE" }],
        outlets: [{ locationId: location.id, availability: "AVAILABLE" }],
      },
      "missing-user"
    );
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error("product was not created");
    return { tenantId: tenant.id, product: created.product };
  }

  function batchFetch(mode: "accepted" | "pending" | "partial" | "failed" | "success" | "rejected" | "leak") {
    const posts: string[] = [];
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("/items_batch")) {
        posts.push(String(init?.method || "POST"));
        if (mode === "leak") return json({ error: { message: "bad EAA-merchant-token", code: 100 } }, 400);
        if (mode === "rejected") return json({ handles: [], validation_status: [] });
        return json({ handles: ["handle-1"], validation_status: [] });
      }
      if (href.includes("check_batch_request_status")) {
        const status = mode === "pending" ? "started" : mode === "failed" ? "error" : mode === "success" || mode === "partial" ? "finished" : "submitted";
        return json({
          data: [{
            handle: "handle-1",
            status,
            errors_total_count: mode === "partial" ? 1 : 0,
            ids_of_invalid_requests: mode === "partial" ? ["SYNC-OK-W"] : [],
          }],
        });
      }
      if (href.includes("/products")) {
        return json({
          data: mode === "success"
            ? [
                { id: "meta-parent", retailer_id: "SYNC-OK" },
                { id: "meta-child", retailer_id: "SYNC-OK-W" },
              ]
            : [],
        });
      }
      return json({ error: { message: "unexpected", code: 100 } }, 404);
    }) as typeof fetch;
    return { fetchImpl, posts };
  }

  async function runSync(
    tenantId: string,
    productId: string,
    mode: Parameters<typeof batchFetch>[0]
  ) {
    const script = batchFetch(mode);
    const result = await requestCatalogSync({
      tenantId,
      productId,
      actorId: "missing-user",
      liveSwitch: true,
      publicUrl: "https://brand.example/pass",
      fetchImpl: script.fetchImpl,
    });
    return { result, posts: script.posts };
  }

  it("tracks accepted, pending, partial, failed, and confirmed catalog batches", async () => {
    const accepted = await connectedProduct("accepted");
    const acceptedRun = await runSync(accepted.tenantId, accepted.product.id, "accepted");
    assert.equal(acceptedRun.result.ok, true);
    if (!acceptedRun.result.ok) return;
    assert.equal(acceptedRun.result.plan.syncStatus, "SUBMITTED");
    assert.equal(acceptedRun.result.plan.networkCalled, true);
    assert.equal(acceptedRun.posts.length, 1);
    const acceptedAgain = await runSync(accepted.tenantId, accepted.product.id, "accepted");
    assert.equal(acceptedAgain.posts.length, 0);
    const acceptedRow = await prisma.commerceCatalogLink.findFirst({ where: { productId: accepted.product.id } });
    const acceptedJob = await prisma.commerceSyncJob.findFirst({ where: { productId: accepted.product.id } });
    assert.equal(acceptedRow?.syncStatus, "SUBMITTED");
    assert.equal(acceptedRow?.reviewStatus, "UNKNOWN");
    assert.equal(acceptedJob?.batchHandle, "handle-1");
    assert.equal(acceptedJob?.status, "SUBMITTED");

    const pending = await connectedProduct("pending");
    const pendingRun = await runSync(pending.tenantId, pending.product.id, "pending");
    assert.equal(pendingRun.result.ok, true);
    if (!pendingRun.result.ok) return;
    assert.equal(pendingRun.result.plan.syncStatus, "PROCESSING");
    assert.notEqual(pendingRun.result.plan.syncStatus, "SYNCED");

    const partial = await connectedProduct("partial");
    const partialRun = await runSync(partial.tenantId, partial.product.id, "partial");
    assert.equal(partialRun.result.ok, true);
    if (!partialRun.result.ok) return;
    assert.equal(partialRun.result.plan.syncStatus, "FAILED");
    assert.match(partialRun.result.plan.message, /some items/);
    const partialRow = await prisma.commerceCatalogLink.findFirst({ where: { productId: partial.product.id } });
    assert.equal(partialRow?.reviewStatus, "UNKNOWN");
    assert.equal(partialRow?.syncStatus, "FAILED");
    assert.equal(partialRow?.externalProductId, "");

    const failed = await connectedProduct("failed");
    const failedRun = await runSync(failed.tenantId, failed.product.id, "failed");
    assert.equal(failedRun.result.ok, true);
    if (!failedRun.result.ok) return;
    assert.equal(failedRun.result.plan.syncStatus, "FAILED");
    assert.match(failedRun.result.plan.message, /rejected/);
    const failedRow = await prisma.commerceCatalogLink.findFirst({ where: { productId: failed.product.id } });
    assert.equal(failedRow?.reviewStatus, "UNKNOWN");

    const rejected = await connectedProduct("rejected");
    const rejectedRun = await runSync(rejected.tenantId, rejected.product.id, "rejected");
    assert.equal(rejectedRun.result.ok, true);
    if (!rejectedRun.result.ok) return;
    assert.equal(rejectedRun.result.plan.syncStatus, "FAILED");
    assert.equal(rejectedRun.posts.length, 1);

    const leaked = await connectedProduct("leaked");
    const leakedRun = await runSync(leaked.tenantId, leaked.product.id, "leak");
    assert.equal(leakedRun.result.ok, true);
    if (!leakedRun.result.ok) return;
    assert.equal(leakedRun.result.plan.message.includes("EAA-merchant-token"), false);
    assert.match(leakedRun.result.plan.message, /redacted/);

    const confirmed = await connectedProduct("confirmed");
    const confirmedRun = await runSync(confirmed.tenantId, confirmed.product.id, "success");
    assert.equal(confirmedRun.result.ok, true);
    if (!confirmedRun.result.ok) return;
    assert.equal(confirmedRun.result.plan.syncStatus, "SYNCED");
    assert.equal(confirmedRun.result.plan.externalProductId, "meta-parent");
    assert.equal(confirmedRun.result.plan.message.includes("EAA-merchant-token"), false);
    const confirmedRow = await prisma.commerceCatalogLink.findFirst({ where: { productId: confirmed.product.id } });
    assert.equal(confirmedRow?.reviewStatus, "UNKNOWN");
    assert.equal(confirmedRow?.metaProductId, "meta-parent");
    assert.equal(Boolean(confirmedRow?.processedPayloadHash), true);
    const variantMap = await prisma.commerceVariantMap.findFirst({ where: { productId: confirmed.product.id } });
    assert.equal(variantMap?.metaProductId, "meta-child");
    assert.equal(variantMap?.reviewStatus, "UNKNOWN");
    const repeat = await runSync(confirmed.tenantId, confirmed.product.id, "success");
    assert.equal(repeat.posts.length, 0);
    if (!repeat.result.ok) return;
    assert.equal(repeat.result.plan.networkCalled, false);
    assert.equal(repeat.result.plan.syncStatus, "SYNCED");
    await requestCatalogSync({
      tenantId: confirmed.tenantId,
      productId: confirmed.product.id,
      actorId: "missing-user",
      liveSwitch: false,
      publicUrl: "https://brand.example/other",
    });
    const staleLink = await prisma.commerceCatalogLink.findFirst({ where: { productId: confirmed.product.id } });
    assert.equal(staleLink?.syncStatus, "OUTDATED");
    assert.equal(staleLink?.externalProductId, "meta-parent");
    assert.equal(staleLink?.reviewStatus, "UNKNOWN");

    const edited = await updateCommerceProduct(
      confirmed.tenantId,
      confirmed.product.id,
      {
        sku: "SYNC-OK",
        name: "Day pass renamed",
        description: "Entry changed",
        category: "Package",
        imageUrl: "https://cdn.example/other.jpg",
        unitPriceIdr: 100000,
        status: "ACTIVE",
        availability: "UNAVAILABLE",
        catalogEligibility: "UNKNOWN",
        catalogEligibilityNote: "",
        variants: [{ sku: "SYNC-OK-W", name: "Weekend", unitPriceIdr: 130000, status: "ACTIVE" }],
        outlets: confirmed.product.outlets.map((outlet) => ({
          locationId: outlet.locationId,
          availability: outlet.availability === "UNAVAILABLE" ? ("UNAVAILABLE" as const) : ("AVAILABLE" as const),
        })),
      },
      "missing-user",
      confirmed.product.updatedAt
    );
    assert.equal(edited.ok, true);
    if (!edited.ok) return;
    assert.equal(edited.product.catalog.syncStatus, "OUTDATED");
    assert.equal(edited.product.catalog.externalProductId, "meta-parent");
    assert.equal(edited.product.catalog.reviewStatus, "UNKNOWN");
  });

  it("does not push the same catalog batch from two overlapping calls", async () => {
    const seeded = await connectedProduct("race");
    let posts = 0;
    const fetchImpl = (async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes("/items_batch")) {
        posts += 1;
        await new Promise((resolve) => setTimeout(resolve, 40));
        return json({ handles: ["handle-race"], validation_status: [] });
      }
      if (href.includes("check_batch_request_status")) {
        return json({ data: [{ handle: "handle-race", status: "started", errors_total_count: 0, ids_of_invalid_requests: [] }] });
      }
      return json({ data: [] });
    }) as typeof fetch;
    const [first, second] = await Promise.all([
      requestCatalogSync({
        tenantId: seeded.tenantId,
        productId: seeded.product.id,
        actorId: "missing-user",
        liveSwitch: true,
        publicUrl: "https://brand.example/pass",
        fetchImpl,
      }),
      requestCatalogSync({
        tenantId: seeded.tenantId,
        productId: seeded.product.id,
        actorId: "missing-user",
        liveSwitch: true,
        publicUrl: "https://brand.example/pass",
        fetchImpl,
      }),
    ]);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(posts, 1);
  });

  it("stops a catalog batch after three failed attempts", async () => {
    const seeded = await connectedProduct("retry");
    let posts = 0;
    const fetchImpl = (async () => {
      posts += 1;
      return json({ error: { message: "temporary failure", code: 100 } }, 500);
    }) as typeof fetch;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await requestCatalogSync({
        tenantId: seeded.tenantId,
        productId: seeded.product.id,
        actorId: "missing-user",
        liveSwitch: true,
        publicUrl: "https://brand.example/pass",
        fetchImpl,
      });
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.plan.syncStatus, "FAILED");
      assert.equal(result.plan.networkCalled, true);
    }
    const stopped = await requestCatalogSync({
      tenantId: seeded.tenantId,
      productId: seeded.product.id,
      actorId: "missing-user",
      liveSwitch: true,
      publicUrl: "https://brand.example/pass",
      fetchImpl,
    });
    assert.equal(stopped.ok, true);
    if (!stopped.ok) return;
    assert.equal(stopped.plan.networkCalled, false);
    assert.equal(posts, 3);
  });

  it("invalidates the old catalog when merchant A reconnects a different Meta business", async () => {
    const seeded = await connectedProduct("reconnect");
    const before = await getCommerceConnection(seeded.tenantId);
    assert.equal(before.catalog.status, "CONNECTED");
    const saved = await saveCommerceToken({
      tenantId: seeded.tenantId,
      accessToken: "EAA-new-token",
      expiresAt: null,
      scopes: [],
      actorId: "missing-user",
      app,
      fetchImpl: (async (url: RequestInfo | URL) => {
        assert.match(String(url), /debug_token/);
        return json({ data: { app_id: "app-test", is_valid: true, expires_at: 0, scopes } });
      }) as typeof fetch,
    });
    assert.equal(saved.catalog.status === "CONNECTED", false);
    assert.equal(saved.catalogId, "");
    assert.equal(JSON.stringify(saved).includes("EAA-new-token"), false);

    const assets = (async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes("debug_token")) return json({ data: { app_id: "app-test", is_valid: true, expires_at: 0, scopes } });
      if (href.includes("/me/businesses")) return json({ data: [{ id: "biz-2", name: "Second" }] });
      if (href.includes("/biz-2/owned_product_catalogs")) return json({ data: [{ id: "cat-new", name: "New shop" }] });
      if (href.includes("/biz-2/owned_whatsapp_business_accounts")) return json({ data: [{ id: "waba-2", name: "New WA" }] });
      if (href.includes("/waba-2/phone_numbers")) return json({ data: [{ id: "phone-2", display_phone_number: "+62 812 0000 3333" }] });
      return json({ data: [] });
    }) as typeof fetch;
    const wrongBusiness = await discoverCommerceAssets(seeded.tenantId, assets, "biz-1", app);
    assert.equal(wrongBusiness.ok, false);
    const listed = await discoverCommerceAssets(seeded.tenantId, assets, "biz-2", app);
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    assert.deepEqual(listed.catalogs.map((row) => row.id), ["cat-new"]);
    const stale = await linkCommerceAssets(
      seeded.tenantId,
      { businessId: "biz-2", catalogId: "cat-old", wabaId: "waba-2", phoneNumberId: "phone-2" },
      "missing-user",
      assets,
      app
    );
    assert.equal(stale.ok, false);
    const after = await getCommerceConnection(seeded.tenantId);
    assert.equal(after.catalog.status === "CONNECTED", false);
    assert.equal(JSON.stringify(after).includes("EAA-new-token"), false);
  });

  it("drops catalog access when the new token loses catalog_management", async () => {
    const seeded = await connectedProduct("scopes");
    const view = await discoverCommerceAssets(
      seeded.tenantId,
      (async (url: RequestInfo | URL) => {
        const href = String(url);
        if (href.includes("debug_token")) {
          return json({
            data: {
              app_id: "app-test",
              is_valid: true,
              expires_at: 0,
              scopes: ["business_management", "whatsapp_business_management"],
            },
          });
        }
        if (href.includes("/me/businesses")) return json({ data: [{ id: "biz-1", name: "First" }] });
        return json({ data: [] });
      }) as typeof fetch,
      "",
      app
    );
    assert.equal(view.ok, true);
    const after = await getCommerceConnection(seeded.tenantId);
    assert.equal(after.catalog.status, "PERMISSION_ERROR");
    assert.equal(after.catalogId, "");
    assert.equal(after.whatsapp.status, "CONNECTED");
  });

  it("does not keep a revoked token connected", async () => {
    const seeded = await connectedProduct("revoked");
    const saved = await saveCommerceToken({
      tenantId: seeded.tenantId,
      accessToken: "EAA-revoked-token",
      expiresAt: null,
      scopes: [],
      actorId: "missing-user",
      app,
      fetchImpl: (async () => json({ data: { app_id: "app-test", is_valid: false, expires_at: 0, scopes: [] } })) as typeof fetch,
    });
    assert.equal(saved.catalog.status === "CONNECTED", false);
    assert.equal(JSON.stringify(saved).includes("EAA-revoked-token"), false);
    const row = await prisma.commerceConnection.findUnique({ where: { tenantId: seeded.tenantId } });
    assert.equal(row?.tokenEnc, null);
  });

  it("consumes a commerce oauth nonce once for the session that started it", async () => {
    const tenant = await prisma.tenant.create({
      data: { name: "Nonce", slug: `${stamp}-nonce`, type: "CLIENT" },
    });
    ids.push(tenant.id);
    const state = await issueCommerceState({ tenantId: tenant.id, userId: "user-1", sessionKey: "session-a" });
    assert.equal((await consumeCommerceState(state, { userId: "user-1", sessionKey: "session-b" })), null);
    const first = await consumeCommerceState(state, { userId: "user-1", sessionKey: "session-a" });
    assert.equal(first?.tenantId, tenant.id);
    assert.equal(await consumeCommerceState(state, { userId: "user-1", sessionKey: "session-a" }), null);
  });
});
