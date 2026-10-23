import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canReadCommerce, canWriteCommerce, productListWhere, sameTenant } from "./access";
import { planCatalogSync, presentCatalog } from "./catalog-adapter";
import { commerceReadiness, readinessWriteData } from "./readiness";
import { decideProductUpdate, foreignOutlets, parseProductInput } from "./validate";
import { presentStoredReadiness } from "./readiness";
import { readFileSync } from "node:fs";

const base = {
  sku: "PLAY-001",
  name: "Family package",
  unitPriceIdr: 150000,
  description: "Fixed price package",
  category: "Admission",
  imageUrl: "https://cdn.example/p.jpg",
  availability: "AVAILABLE",
  status: "ACTIVE",
  variants: [{ sku: "PLAY-001-S", name: "Weekend", unitPriceIdr: 175000, status: "ACTIVE" }],
  outlets: [{ locationId: "loc-a", availability: "AVAILABLE" }],
};

describe("commerce product validation", () => {
  it("accepts a merchant product with a variant and an outlet", () => {
    const parsed = parseProductInput(base);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.unitPriceIdr, 150000);
    assert.equal(parsed.value.catalogEligibility, "UNKNOWN");
    assert.equal(parsed.value.availability, "AVAILABLE");
    assert.equal(parsed.value.variants.length, 1);
  });

  it("keeps catalog eligibility separate from availability", () => {
    const parsed = parseProductInput({ ...base, availability: "UNAVAILABLE", catalogEligibility: "UNKNOWN" });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.availability, "UNAVAILABLE");
    assert.equal(parsed.value.catalogEligibility, "UNKNOWN");
  });

  it("refuses to mark a product eligible for Meta catalog", () => {
    const parsed = parseProductInput({ ...base, catalogEligibility: "ELIGIBLE" });
    assert.equal(parsed.ok, false);
  });

  it("rejects a bad price, a duplicate SKU, and a non-https image", () => {
    assert.equal(parseProductInput({ ...base, unitPriceIdr: 10.5 }).ok, false);
    assert.equal(parseProductInput({ ...base, unitPriceIdr: -1 }).ok, false);
    assert.equal(parseProductInput({ ...base, variants: [{ sku: "PLAY-001", name: "Same", unitPriceIdr: null }] }).ok, false);
    assert.equal(parseProductInput({ ...base, imageUrl: "http://cdn.example/p.jpg" }).ok, false);
    assert.equal(parseProductInput({ ...base, name: "  " }).ok, false);
  });

  it("rejects revenue fields on a product", () => {
    assert.equal(parseProductInput({ ...base, gmv: 4200000 }).ok, false);
    assert.equal(parseProductInput({ ...base, paidRevenue: 1 }).ok, false);
  });

  it("rejects an outlet that belongs to another merchant", () => {
    const parsed = parseProductInput(base);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(foreignOutlets(parsed.value.outlets, new Set(["loc-a"])), null);
    assert.match(foreignOutlets(parsed.value.outlets, new Set(["loc-other"])) || "", /not on this merchant/);
  });
});

describe("commerce archive guard", () => {
  const stored = new Date("2026-10-23T08:00:00.000Z");

  it("rejects a stale save and refuses to reactivate an archived product", () => {
    const stale = decideProductUpdate({
      storedStatus: "ARCHIVED",
      storedUpdatedAt: stored,
      expectedUpdatedAt: "2026-10-23T07:00:00.000Z",
      nextStatus: "ACTIVE",
    });
    assert.equal(stale.ok, false);
    const fresh = decideProductUpdate({
      storedStatus: "ARCHIVED",
      storedUpdatedAt: stored,
      expectedUpdatedAt: stored.toISOString(),
      nextStatus: "ACTIVE",
    });
    assert.equal(fresh.ok, false);
    if (!fresh.ok) assert.match(fresh.error, /stay archived/);
    const archive = decideProductUpdate({
      storedStatus: "ACTIVE",
      storedUpdatedAt: stored,
      expectedUpdatedAt: stored.toISOString(),
      nextStatus: "ARCHIVED",
    });
    assert.equal(archive.ok, true);
  });

  it("does not treat a stored connected flag as a live integration", () => {
    const view = presentStoredReadiness({
      whatsappStatus: "CONNECTED",
      catalogStatus: "CONNECTED",
      paymentStatus: "CONNECTED",
      paymentProviderLabel: "Xendit",
    });
    assert.equal(view.whatsappBusiness.status, "NOT_CONNECTED");
    assert.equal(view.metaCatalog.status, "NOT_CONNECTED");
    assert.equal(view.paymentGateway.status, "NOT_CONNECTED");
    assert.match(view.metaCatalog.detail, /not a live connection/);
    assert.match(view.paymentGateway.detail, /Checkout is off/);
  });
});

describe("commerce tenant isolation", () => {
  it("always scopes a product list to one merchant", () => {
    assert.deepEqual(productListWhere("tenant-a", "ACTIVE"), { tenantId: "tenant-a", status: "ACTIVE" });
    assert.equal(productListWhere("tenant-b", "ALL").tenantId, "tenant-b");
    assert.equal(sameTenant("tenant-a", "tenant-a"), true);
    assert.equal(sameTenant("tenant-a", "tenant-b"), false);
    assert.throws(() => productListWhere("", "ACTIVE"));
  });

  it("lets brand admin write and keeps branch and HQ view-only or out", () => {
    const admin = { role: "CLIENT_ADMIN" as const, isAgencyStaff: false, mode: "brand" as const };
    const ops = { role: "HQ_OPS" as const, isAgencyStaff: false, mode: "brand" as const };
    const branch = { role: "BRANCH" as const, isAgencyStaff: false, mode: "brand" as const };
    const platform = { role: "SUPER_ADMIN" as const, isAgencyStaff: true, mode: "platform" as const };
    assert.equal(canWriteCommerce(admin), true);
    assert.equal(canReadCommerce(ops), true);
    assert.equal(canWriteCommerce(ops), false);
    assert.equal(canReadCommerce(branch), false);
    assert.equal(canWriteCommerce(platform), false);
  });
});

describe("commerce integrations stay off", () => {
  it("plans a catalog sync that does not call the network", () => {
    const plan = planCatalogSync();
    assert.equal(plan.syncStatus, "NOT_CONNECTED");
    assert.equal(plan.externalProductId, "");
    assert.equal(plan.networkCalled, false);
    const shown = presentCatalog(
      {
        retailerId: "PLAY-001",
        lastError: "old",
        syncStatus: "SYNCED",
        externalProductId: "meta-1",
        reviewStatus: "APPROVED",
      },
      "PLAY-001"
    );
    assert.equal(shown.syncStatus, "SYNCED");
    assert.equal(shown.externalProductId, "meta-1");
    assert.equal(shown.reviewStatus, "APPROVED");
    assert.equal(shown.networkCalled, false);
    const invented = presentCatalog(
      { retailerId: "PLAY-001", lastError: "", syncStatus: "META_APPROVED", reviewStatus: "YES" },
      "PLAY-001"
    );
    assert.equal(invented.syncStatus, "NOT_CONNECTED");
    assert.equal(invented.reviewStatus, "UNKNOWN");
    const src = readFileSync(new URL("./catalog-adapter.ts", import.meta.url), "utf8");
    assert.equal(src.includes("fetch("), false);
    assert.equal(src.includes("graph.facebook"), false);
  });

  it("reports WhatsApp, catalog, and payment as not connected", () => {
    const view = commerceReadiness();
    assert.equal(view.whatsappBusiness.status, "NOT_CONNECTED");
    assert.equal(view.metaCatalog.status, "NOT_CONNECTED");
    assert.equal(view.paymentGateway.status, "NOT_CONNECTED");
    const write = readinessWriteData();
    assert.equal(write.whatsappStatus, "NOT_CONNECTED");
    assert.equal(write.catalogStatus, "NOT_CONNECTED");
    assert.equal(write.paymentStatus, "NOT_CONNECTED");
    assert.equal(write.paymentProviderLabel, "");
    assert.equal(Object.values(write).includes("CONNECTED"), false);
  });
});
