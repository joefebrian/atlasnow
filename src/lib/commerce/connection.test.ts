import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeCommerceState, encodeCommerceState } from "@/lib/commerce/meta-oauth";
import { connectionJson, presentConnection } from "@/lib/commerce/connection";
import { batchBody, catalogItems, decideCatalogSync, type SyncProduct } from "@/lib/commerce/catalog-sync";
import { pushCatalogItems } from "@/lib/commerce/meta-graph";

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
    assert.match(calls[0].url, /\/cat\/batch$/);
    const body = JSON.parse(calls[0].body) as { requests: { method: string; data: { price: string } }[] };
    assert.equal(body.requests[0]?.method, "UPDATE");
    assert.equal(body.requests[1]?.method, "CREATE");
    assert.equal(body.requests[0]?.data.price, "99000 IDR");
    assert.equal(calls[0].body.includes("WEEKDAY-PASS"), true);
    const built = batchBody(decision.items, new Set(), "https://brand.example/pass");
    assert.equal(JSON.stringify(built).includes("EAA-secret-token"), false);
  });
});
