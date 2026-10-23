import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cloudSignatureValid } from "@/lib/conversations/cloud-signature";
import { customerReference, parseWhatsAppOrders } from "@/lib/commerce/order-parse";
import { judgeOrder, whatsappPostPlan, type MasterSku } from "@/lib/commerce/order-capture";

const SECRET = "test-app-secret";

function orderBody(overrides?: {
  messageId?: string;
  sku?: string;
  price?: number | string;
  quantity?: number;
  currency?: string;
  catalogId?: string;
  wabaId?: string;
  phoneNumberId?: string;
  from?: string;
  type?: string;
}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: overrides?.wabaId ?? "waba-qa",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15554362839",
                phone_number_id: overrides?.phoneNumberId ?? "phone-qa",
              },
              contacts: [{ profile: { name: "Test Sender" }, wa_id: overrides?.from ?? "155500009999" }],
              messages: [
                {
                  from: overrides?.from ?? "155500009999",
                  id: overrides?.messageId ?? "wamid.order.1",
                  timestamp: "1761264000",
                  type: overrides?.type ?? "order",
                  order: {
                    catalog_id: overrides?.catalogId ?? "catalog-qa",
                    text: "please do not store this note",
                    product_items: [
                      {
                        product_retailer_id: overrides?.sku ?? "ATLASNOW-QA-SHAPE-001",
                        quantity: overrides?.quantity ?? 1,
                        item_price: overrides?.price ?? 28780,
                        currency: overrides?.currency ?? "IDR",
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

const master = (overrides?: Partial<MasterSku>): MasterSku => ({
  sku: "ATLASNOW-QA-SHAPE-001",
  productId: "product-1",
  variantId: null,
  unitPriceIdr: 28780,
  sellable: true,
  outletIds: ["outlet-1"],
  ...overrides,
});

describe("whatsapp order webhook plan", () => {
  it("rejects a bad signature and does not capture", () => {
    const raw = JSON.stringify(orderBody());
    const valid = `sha256=${createHmac("sha256", SECRET).update(raw).digest("hex")}`;
    assert.equal(cloudSignatureValid(raw, valid, SECRET), true);
    assert.equal(cloudSignatureValid(raw, "sha256=deadbeef", SECRET), false);
    assert.equal(cloudSignatureValid(raw, null, SECRET), false);
    assert.deepEqual(
      whatsappPostPlan({ appSecret: SECRET, signatureValid: false, captureEnabled: true }),
      { status: 401 }
    );
  });

  it("keeps inbox ingest when the app secret is empty and does not capture", () => {
    const plan = whatsappPostPlan({ appSecret: "  ", signatureValid: false, captureEnabled: true });
    assert.equal("status" in plan, false);
    if ("status" in plan) return;
    assert.equal(plan.ingest, true);
    assert.equal(plan.capture, false);
  });

  it("captures only when the signature is valid and the server switch is on", () => {
    const off = whatsappPostPlan({ appSecret: SECRET, signatureValid: true, captureEnabled: false });
    const on = whatsappPostPlan({ appSecret: SECRET, signatureValid: true, captureEnabled: true });
    assert.equal("capture" in off && off.capture, false);
    assert.equal("capture" in on && on.capture, true);
  });

  it("wires capture through the signature plan and does not call a gateway", () => {
    const route = readFileSync(new URL("../../app/api/webhooks/whatsapp/route.ts", import.meta.url), "utf8");
    const capture = readFileSync(new URL("./order-capture.ts", import.meta.url), "utf8");
    assert.match(route, /whatsappPostPlan/);
    assert.match(route, /ingestCloudWhatsAppPayload/);
    assert.equal(capture.includes("xendit"), false);
    assert.equal(capture.includes("midtrans"), false);
    assert.equal(capture.includes("graph.facebook.com"), false);
    assert.equal(capture.includes("customerWaId"), true);
    assert.equal(capture.includes("console.info"), true);
    assert.equal(capture.includes("customerWaId:"), true);
  });
});

describe("whatsapp order parser", () => {
  it("extracts the order identity and drops the sender name and note", () => {
    const [order] = parseWhatsAppOrders(orderBody());
    assert.equal(order.wabaId, "waba-qa");
    assert.equal(order.phoneNumberId, "phone-qa");
    assert.equal(order.messageId, "wamid.order.1");
    assert.equal(order.catalogId, "catalog-qa");
    assert.equal(order.customerWaId, "155500009999");
    assert.equal(order.items[0]?.sku, "ATLASNOW-QA-SHAPE-001");
    assert.equal(order.items[0]?.quantity, 1);
    assert.equal(order.items[0]?.itemPrice, 28780);
    assert.equal(order.items[0]?.currency, "IDR");
    assert.equal(order.receivedAt.toISOString(), "2025-10-24T00:00:00.000Z");
    const encoded = JSON.stringify(order);
    assert.equal(encoded.includes("Test Sender"), false);
    assert.equal(encoded.includes("please do not store"), false);
    assert.equal(encoded.includes("15554362839"), false);
    assert.equal(customerReference(order.customerWaId), "•••• 9999");
  });

  it("ignores product inquiries and non-order messages", () => {
    const inquiry = orderBody({ type: "interactive" });
    assert.deepEqual(parseWhatsAppOrders(inquiry), []);
    const text = orderBody();
    const message = text.entry[0].changes[0].value.messages[0] as { type: string; text?: { body: string } };
    message.type = "text";
    message.text = { body: "hello" };
    assert.deepEqual(parseWhatsAppOrders(text), []);
  });
});

describe("order validation against the product master", () => {
  it("matches the master price and does not treat that sum as a copied WhatsApp total", () => {
    const judged = judgeOrder(
      [
        { sku: "atlasnow-qa-shape-001", quantity: 2, itemPrice: 28780, currency: "IDR" },
      ],
      [master()]
    );
    assert.equal(judged.validation, "MATCHED");
    assert.equal(judged.estimatedTotal, 57560);
    assert.equal(judged.masterTotalIdr, 57560);
    assert.equal(judged.locationId, "outlet-1");
    assert.equal(judged.lines[0]?.productId, "product-1");
  });

  it("keeps an unknown SKU as review and leaves the master total empty", () => {
    const judged = judgeOrder(
      [{ sku: "ONLY-ON-META", quantity: 1, itemPrice: 28780, currency: "IDR" }],
      [master()]
    );
    assert.equal(judged.validation, "UNKNOWN_SKU");
    assert.equal(judged.masterTotalIdr, null);
    assert.equal(judged.estimatedTotal, 28780);
    assert.equal(judged.lines[0]?.productId, null);
    assert.equal(judged.locationId, null);
  });

  it("rejects a price mismatch and does not copy the WhatsApp total into the master total", () => {
    const judged = judgeOrder(
      [{ sku: "ATLASNOW-QA-SHAPE-001", quantity: 1, itemPrice: 1000, currency: "IDR" }],
      [master()]
    );
    assert.equal(judged.validation, "PRICE_MISMATCH");
    assert.equal(judged.estimatedTotal, 1000);
    assert.equal(judged.masterTotalIdr, null);
    assert.equal(judged.lines[0]?.masterUnitPriceIdr, 28780);
  });

  it("does not match an archived product or a non-IDR price", () => {
    const archived = judgeOrder(
      [{ sku: "ATLASNOW-QA-SHAPE-001", quantity: 1, itemPrice: 28780, currency: "IDR" }],
      [master({ sellable: false })]
    );
    assert.equal(archived.validation, "REVIEW");
    assert.equal(archived.masterTotalIdr, null);
    const usd = judgeOrder(
      [{ sku: "ATLASNOW-QA-SHAPE-001", quantity: 1, itemPrice: 28780, currency: "USD" }],
      [master()]
    );
    assert.equal(usd.validation, "PRICE_MISMATCH");
    assert.equal(usd.masterTotalIdr, null);
  });

  it("leaves the outlet blank when the product is offered at more than one outlet", () => {
    const judged = judgeOrder(
      [{ sku: "ATLASNOW-QA-SHAPE-001", quantity: 1, itemPrice: 28780, currency: "IDR" }],
      [master({ outletIds: ["outlet-1", "outlet-2"] })]
    );
    assert.equal(judged.validation, "MATCHED");
    assert.equal(judged.locationId, null);
  });
});
