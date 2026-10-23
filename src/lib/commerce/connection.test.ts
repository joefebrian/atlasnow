import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { commerceAuthSecret, decodeCommerceState, encodeCommerceState } from "@/lib/commerce/meta-oauth";
import { connectionJson, presentConnection } from "@/lib/commerce/connection";
import { batchBody, batchSyncDecision, catalogItems, decideCatalogSync, payloadHash, type SyncProduct } from "@/lib/commerce/catalog-sync";
import { classifyBatchStatus, COMMERCE_GRAPH, listBusinesses, pushCatalogItems, scrubSecret } from "@/lib/commerce/meta-graph";

const ready: SyncProduct = {
  sku: "WEEKDAY-PASS",
  name: "Weekday pass",
  description: "Fixed weekday entry",
  category: "Package",
  imageUrl: "https://cdn.example/pass.jpg",
  hasImage: false,
  unitPriceIdr: 99000,
  status: "ACTIVE",
  availability: "AVAILABLE",
  catalogEligibility: "UNKNOWN",
  variants: [{ sku: "WEEKDAY-PASS-AM", name: "Morning", unitPriceIdr: 79000, status: "ACTIVE" }],
};

describe("commerce connection state", () => {
  it("keeps a stored token out of the browser view", () => {
    const view = presentConnection(
      {
        businessId: "biz",
        businessName: "Demo",
        wabaId: "waba",
        phoneNumberId: "phone",
        phoneMasked: "•••• 1234",
        catalogId: "cat",
        catalogName: "Shop",
        grantedScopes: "business_management,whatsapp_business_management,catalog_management",
        tokenEnc: "v1:secret-token-blob",
        lastError: "",
        permissionError: false,
        disconnectedAt: null,
      },
      false
    );
    const json = connectionJson(view);
    assert.equal(json.includes("secret-token"), false);
    assert.equal(json.includes("tokenEnc"), false);
    assert.equal(view.whatsapp.status, "CONNECTED");
    assert.equal(view.catalog.status, "CONNECTED");
    assert.equal(view.payment.status, "NOT_CONNECTED");
    assert.equal(view.liveSyncEnabled, false);
  });

  it("reports a permission error when catalog_management is missing", () => {
    const view = presentConnection(
      {
        businessId: "biz",
        businessName: "Demo",
        wabaId: "waba",
        phoneNumberId: "phone",
        phoneMasked: "•••• 1234",
        catalogId: "",
        catalogName: "",
        grantedScopes: "business_management,whatsapp_business_management",
        tokenEnc: "v1:secret",
        lastError: "",
        permissionError: true,
        disconnectedAt: null,
      },
      true
    );
    assert.equal(view.whatsapp.status, "CONNECTED");
    assert.equal(view.catalog.status, "PERMISSION_ERROR");
    assert.equal(view.missingScopes.includes("catalog_management"), true);
    assert.equal(JSON.stringify(view).includes("v1:secret"), false);
  });

  it("rejects a tampered oauth state", () => {
    const state = encodeCommerceState({ tenantId: "tenant-a", userId: "user-a", nonce: "nonce" });
    assert.equal(decodeCommerceState(state)?.tenantId, "tenant-a");
    const [body, sig] = state.split(".");
    assert.equal(decodeCommerceState(`${body}.${sig.slice(0, -1)}x`), null);
    assert.equal(decodeCommerceState("not-signed"), null);
  });
});

describe("commerce catalog sync gate", () => {
  it("blocks live push and keeps offer status off the review field", () => {
    const decision = decideCatalogSync({
      catalogState: "CONNECTED",
      liveSwitch: false,
      catalogId: "cat",
      product: ready,
      publicUrl: "https://brand.example/pass",
    });
    assert.equal(decision.execute, false);
    assert.equal(decision.networkCalled, false);
    assert.match(decision.message, /server switch/);
    const items = catalogItems(ready);
    assert.equal(items[0]?.price, "99000 IDR");
    assert.equal(items[1]?.price, "79000 IDR");
    assert.equal(items[0]?.availability, "in stock");
    assert.equal(JSON.stringify(items).includes("APPROVED"), false);
  });

  it("blocks ticket-like categories and archived products", () => {
    const ticket = decideCatalogSync({
      catalogState: "CONNECTED",
      liveSwitch: true,
      catalogId: "cat",
      product: { ...ready, category: "Admission" },
      publicUrl: "https://brand.example/pass",
    });
    assert.equal(ticket.execute, false);
    assert.match(ticket.message, /eligibility/);
    const archived = decideCatalogSync({
      catalogState: "NOT_CONNECTED",
      liveSwitch: true,
      catalogId: "",
      product: { ...ready, status: "ARCHIVED" },
      publicUrl: null,
    });
    assert.equal(archived.syncStatus, "NOT_CONNECTED");
    assert.match(archived.message, /No request was sent/);
  });

  it("sends one batch and does not include the token in the item body", async () => {
    const calls: { url: string; body: string }[] = [];
    const decision = decideCatalogSync({
      catalogState: "CONNECTED",
      liveSwitch: true,
      catalogId: "cat",
      product: ready,
      publicUrl: "https://brand.example/pass",
    });
    assert.equal(decision.execute, true);
    await pushCatalogItems({
      catalogId: "cat",
      token: "EAA-secret-token",
      items: decision.items,
      existingRetailerIds: new Set(["WEEKDAY-PASS"]),
      link: "https://brand.example/pass",
      fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(url), body: String(init?.body || "") });
        return new Response(JSON.stringify({ handles: ["h1"] }), { status: 200 });
      }) as typeof fetch,
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/v25\.0\/cat\/items_batch$/);
    const body = JSON.parse(calls[0].body) as {
      item_type: string;
      requests: { method: string; data: { price: string } }[];
    };
    assert.equal(body.item_type, "PRODUCT_ITEM");
    assert.equal(body.requests[0]?.method, "UPDATE");
    assert.equal(body.requests[1]?.method, "CREATE");
    assert.equal(body.requests[0]?.data.price, "99000 IDR");
    assert.equal(calls[0].body.includes("WEEKDAY-PASS"), true);
    const built = batchBody(decision.items, new Set(), "https://brand.example/pass");
    assert.equal(JSON.stringify(built).includes("EAA-secret-token"), false);
  });

  it("changes the payload hash when a public attribute changes", () => {
    const url = "https://brand.example/pass";
    const items = catalogItems(ready);
    const base = payloadHash("cat", items, url);
    assert.notEqual(payloadHash("cat", items, "https://brand.example/other"), base);
    assert.notEqual(payloadHash("cat", catalogItems({ ...ready, unitPriceIdr: 1000 }), url), base);
    assert.notEqual(payloadHash("cat", catalogItems({ ...ready, name: "Other" }), url), base);
    assert.notEqual(payloadHash("cat", catalogItems({ ...ready, description: "Other" }), url), base);
    assert.notEqual(payloadHash("cat", catalogItems({ ...ready, availability: "UNAVAILABLE" }), url), base);
    assert.notEqual(payloadHash("cat", catalogItems({ ...ready, imageUrl: "https://cdn.example/other.jpg" }), url), base);
    assert.notEqual(
      payloadHash(
        "cat",
        catalogItems({ ...ready, variants: [{ sku: "WEEKDAY-PASS-AM", name: "Morning", unitPriceIdr: 1, status: "ACTIVE" }] }),
        url
      ),
      base
    );
  });

  it("keeps batch acceptance distinct from finished processing", () => {
    assert.equal(classifyBatchStatus({ status: "", errorsTotal: 0, invalidIds: [] }), "SUBMITTED");
    assert.equal(classifyBatchStatus({ status: "started", errorsTotal: 0, invalidIds: [] }), "PROCESSING");
    assert.equal(classifyBatchStatus({ status: "finished", errorsTotal: 0, invalidIds: [] }), "SUCCEEDED");
    assert.equal(classifyBatchStatus({ status: "finished", errorsTotal: 1, invalidIds: ["SKU"] }), "FAILED");
    assert.equal(classifyBatchStatus({ status: "error", errorsTotal: 0, invalidIds: [] }), "FAILED");
  });

  it("follows Graph pagination and stays on the commerce Graph version", async () => {
    const urls: string[] = [];
    const businesses = await listBusinesses("EAA-secret-token", (async (url: RequestInfo | URL) => {
      urls.push(String(url));
      if (String(url).includes("after=")) {
        return new Response(JSON.stringify({ data: [{ id: "biz-2", name: "Two" }] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ data: [{ id: "biz-1", name: "One" }], paging: { cursors: { after: "c1" } } }),
        { status: 200 }
      );
    }) as typeof fetch);
    assert.deepEqual(businesses.map((row) => row.id), ["biz-1", "biz-2"]);
    assert.equal(urls.every((url) => url.startsWith(`${COMMERCE_GRAPH}/`)), true);
    assert.equal(scrubSecret("token EAA-secret-token failed").includes("EAA-secret-token"), false);
    const inbox = readFileSync(new URL("../meta/oauth.ts", import.meta.url), "utf8");
    assert.match(inbox, /graph\.facebook\.com\/v21\.0/);
    assert.equal(inbox.includes("catalog_management"), false);
  });

  it("applies a finished batch only when the payload, catalog, and item ids still match", () => {
    const readyDecision = {
      classified: "SUCCEEDED" as const,
      validationErrorCount: 0,
      invalidIds: [] as string[],
      expectedRetailerIds: ["WEEKDAY-PASS"],
      mappedRetailerIds: ["WEEKDAY-PASS"],
      jobHash: "hash-1",
      currentHash: "hash-1",
      jobCatalogId: "cat-1",
      activeCatalogId: "cat-1",
    };
    assert.equal(batchSyncDecision(readyDecision), "SYNC");
    assert.equal(batchSyncDecision({ ...readyDecision, classified: "PROCESSING" }), "WAIT");
    assert.equal(batchSyncDecision({ ...readyDecision, classified: "SUBMITTED" }), "WAIT");
    assert.equal(batchSyncDecision({ ...readyDecision, classified: "FAILED" }), "REJECT");
    assert.equal(batchSyncDecision({ ...readyDecision, validationErrorCount: 1 }), "REJECT");
    assert.equal(batchSyncDecision({ ...readyDecision, invalidIds: ["WEEKDAY-PASS"] }), "REJECT");
    assert.equal(batchSyncDecision({ ...readyDecision, mappedRetailerIds: [] }), "WAIT");
    assert.equal(batchSyncDecision({ ...readyDecision, expectedRetailerIds: [] }), "WAIT");
    assert.equal(batchSyncDecision({ ...readyDecision, currentHash: "hash-2" }), "STALE");
    assert.equal(batchSyncDecision({ ...readyDecision, activeCatalogId: "cat-2" }), "STALE");
    assert.equal(batchSyncDecision({ ...readyDecision, jobCatalogId: "" }), "STALE");
    assert.equal(
      batchSyncDecision({ ...readyDecision, currentHash: "hash-2", mappedRetailerIds: [] }),
      "STALE"
    );
  });

  it("keeps the production sync route from sending a public product URL", () => {
    const syncRoute = readFileSync(new URL("../../app/api/commerce/catalog/sync/route.ts", import.meta.url), "utf8");
    const pollRoute = readFileSync(new URL("../../app/api/commerce/catalog/poll/route.ts", import.meta.url), "utf8");
    const service = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
    const refusal = service.slice(service.indexOf("export async function recordCatalogSyncRefusal"));
    assert.match(syncRoute, /recordCatalogSyncRefusal/);
    assert.equal(syncRoute.includes("publicUrl"), false);
    assert.equal(syncRoute.includes("liveSwitch"), false);
    assert.match(pollRoute, /resumeCatalogBatches/);
    assert.match(pollRoute, /"publicUrl" in body/);
    assert.equal(pollRoute.includes("requestCatalogSync"), false);
    assert.equal(refusal.includes("publicUrl"), false);
    assert.equal(refusal.includes("liveSwitch"), false);
  });

  it("refuses the development auth secret in production", () => {
    assert.throws(() => commerceAuthSecret({ NODE_ENV: "production", AUTH_SECRET: "" }), /AUTH_SECRET/);
    assert.throws(
      () => commerceAuthSecret({ NODE_ENV: "production", AUTH_SECRET: "atlasnow-dev-secret-change-me" }),
      /AUTH_SECRET/
    );
    assert.equal(commerceAuthSecret({ NODE_ENV: "test", AUTH_SECRET: "" }).length > 0, true);
  });
});
