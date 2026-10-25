import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { ingestCloudWhatsAppPayload } from "@/lib/conversations/cloud-ingest";
import { captureWhatsAppOrders, listCommerceOrders } from "@/lib/commerce/order-capture";

function localDb() {
  try {
    const host = new URL(process.env.DATABASE_URL || "").hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function payload(messageId: string, overrides?: { sku?: string; price?: number; catalogId?: string; phoneNumberId?: string; wabaId?: string }) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: overrides?.wabaId ?? "waba-qa",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { display_phone_number: "15554362839", phone_number_id: overrides?.phoneNumberId ?? "phone-qa" },
              contacts: [{ profile: { name: "Hidden Sender" }, wa_id: "155500009999" }],
              messages: [
                {
                  from: "155500009999",
                  id: messageId,
                  timestamp: "1761264000",
                  type: "order",
                  order: {
                    catalog_id: overrides?.catalogId ?? "catalog-qa",
                    text: "hidden note",
                    product_items: [
                      {
                        product_retailer_id: overrides?.sku ?? "ATLASNOW-QA-SHAPE-001",
                        quantity: 1,
                        item_price: overrides?.price ?? 28780,
                        currency: "IDR",
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

describe("commerce order capture", { skip: localDb() ? false : "local database only", concurrency: 1 }, () => {
  const stamp = `order-test-${Date.now()}`;
  const ids: string[] = [];
  const previous = process.env.COMMERCE_ORDER_CAPTURE_ENABLED;
  let tenantA = "";
  let tenantB = "";
  let locationA = "";

  before(async () => {
    process.env.COMMERCE_ORDER_CAPTURE_ENABLED = "true";
    const a = await prisma.tenant.create({ data: { name: "Order A", slug: `${stamp}-a`, type: "CLIENT" } });
    const b = await prisma.tenant.create({ data: { name: "Order B", slug: `${stamp}-b`, type: "CLIENT" } });
    ids.push(a.id, b.id);
    tenantA = a.id;
    tenantB = b.id;
    const location = await prisma.location.create({
      data: { tenantId: tenantA, name: "QA Outlet", atlasLocationId: `${stamp}-outlet`, kind: "STORE" },
    });
    locationA = location.id;
    await prisma.commerceProduct.create({
      data: {
        tenantId: tenantA,
        sku: "ATLASNOW-QA-SHAPE-001",
        name: "QA shape",
        unitPriceIdr: 28780,
        outlets: { create: { tenantId: tenantA, locationId: locationA, availability: "AVAILABLE" } },
      },
    });
    await prisma.commerceConnection.create({
      data: {
        tenantId: tenantA,
        wabaId: `waba-${stamp}`,
        phoneNumberId: `phone-${stamp}`,
        catalogId: `catalog-${stamp}`,
        phoneMasked: "•••• 2839",
      },
    });
    await prisma.commerceConnection.create({
      data: {
        tenantId: tenantB,
        wabaId: `waba-b-${stamp}`,
        phoneNumberId: `phone-b-${stamp}`,
        catalogId: `catalog-b-${stamp}`,
        phoneMasked: "•••• 1111",
      },
    });
  });

  after(async () => {
    if (previous == null) delete process.env.COMMERCE_ORDER_CAPTURE_ENABLED;
    else process.env.COMMERCE_ORDER_CAPTURE_ENABLED = previous;
    if (ids.length) await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  function qaPayload(messageId: string, overrides?: { sku?: string; price?: number; catalogId?: string; phoneNumberId?: string; wabaId?: string }) {
    return payload(messageId, {
      wabaId: overrides?.wabaId ?? `waba-${stamp}`,
      phoneNumberId: overrides?.phoneNumberId ?? `phone-${stamp}`,
      catalogId: overrides?.catalogId ?? `catalog-${stamp}`,
      sku: overrides?.sku,
      price: overrides?.price,
    });
  }

  it("stores a matched order and keeps a second message as a separate order", async () => {
    const body = qaPayload(`wamid.${stamp}.1`);
    const ingested = await ingestCloudWhatsAppPayload(body);
    const firstResult = ingested.results[0];
    assert.equal(firstResult && "ignored" in firstResult ? firstResult.ignored : "", "unmapped_session");

    const first = await captureWhatsAppOrders(body);
    assert.equal(first.created, 1);
    const again = await captureWhatsAppOrders(body);
    assert.equal(again.duplicate, 1);
    assert.equal(again.created, 0);

    const second = await captureWhatsAppOrders(qaPayload(`wamid.${stamp}.2`));
    assert.equal(second.created, 1);

    const listed = await listCommerceOrders(tenantA);
    const matched = listed.filter((order) => order.validation === "MATCHED" && order.catalogId === `catalog-${stamp}`);
    assert.ok(matched.length >= 2);
    const encoded = JSON.stringify(matched);
    assert.equal(encoded.includes("155500009999"), false);
    assert.equal(encoded.includes("Hidden Sender"), false);
    for (const order of matched) {
      assert.match(order.reference, /^CO-/);
      assert.equal(order.status, "PENDING_PAYMENT");
      assert.equal(order.paymentStatus, "NOT_INITIATED");
      assert.equal(order.validation, "MATCHED");
      assert.equal(order.customerRef, "•••• 9999");
      assert.equal(order.outletName, "QA Outlet");
      assert.equal(order.estimatedTotal, 28780);
      assert.equal(order.lines[0]?.sku, "ATLASNOW-QA-SHAPE-001");
      assert.equal(order.lines[0]?.quantity, 1);
    }
    const stored = await prisma.commerceOrder.findMany({
      where: { tenantId: tenantA },
      select: { waMessageId: true, customerWaId: true, masterTotalIdr: true, estimatedTotal: true, catalogId: true },
    });
    assert.equal(stored.length, 2);
    assert.deepEqual(
      stored.map((row) => row.waMessageId).sort(),
      [`wamid.${stamp}.1`, `wamid.${stamp}.2`]
    );
    assert.equal(stored.every((row) => row.customerWaId === "155500009999"), true);
    assert.equal(stored.every((row) => row.masterTotalIdr === 28780 && row.estimatedTotal === 28780), true);
    assert.equal(stored.every((row) => row.catalogId === `catalog-${stamp}`), true);
    assert.equal((await listCommerceOrders(tenantB)).length, 0);
  });

  it("captures an unknown SKU as an unresolved order and does not use the estimate as the master total", async () => {
    const result = await captureWhatsAppOrders(qaPayload(`wamid.${stamp}.unknown`, { sku: "ONLY-ON-META" }));
    assert.equal(result.created, 1);
    const order = await prisma.commerceOrder.findUniqueOrThrow({
      where: { waMessageId: `wamid.${stamp}.unknown` },
      include: { lines: true },
    });
    assert.equal(order.tenantId, tenantA);
    assert.equal(order.validation, "UNKNOWN_SKU");
    assert.equal(order.status, "PENDING_PAYMENT");
    assert.equal(order.paymentStatus, "NOT_INITIATED");
    assert.equal(order.estimatedTotal, 28780);
    assert.equal(order.masterTotalIdr, null);
    assert.equal(order.locationId, null);
    assert.equal(order.lines[0]?.productId, null);
    assert.equal(order.lines[0]?.sku, "ONLY-ON-META");
  });

  it("records a price mismatch without a master total", async () => {
    const result = await captureWhatsAppOrders(qaPayload(`wamid.${stamp}.price`, { price: 1000 }));
    assert.equal(result.created, 1);
    const order = await prisma.commerceOrder.findUniqueOrThrow({ where: { waMessageId: `wamid.${stamp}.price` } });
    assert.equal(order.validation, "PRICE_MISMATCH");
    assert.equal(order.estimatedTotal, 1000);
    assert.equal(order.masterTotalIdr, null);
    assert.equal(order.paymentStatus, "NOT_INITIATED");
  });

  it("does not write an order for another catalog, a disconnected merchant, or a capture switch that is off", async () => {
    const otherCatalog = await captureWhatsAppOrders(qaPayload(`wamid.${stamp}.catalog`, { catalogId: "catalog-other" }));
    assert.equal(otherCatalog.unmatched, 1);
    assert.equal(await prisma.commerceOrder.count({ where: { waMessageId: `wamid.${stamp}.catalog` } }), 0);

    await prisma.commerceConnection.update({
      where: { tenantId: tenantB },
      data: { disconnectedAt: new Date() },
    });
    const disconnected = await captureWhatsAppOrders(
      payload(`wamid.${stamp}.off`, {
        wabaId: `waba-b-${stamp}`,
        phoneNumberId: `phone-b-${stamp}`,
        catalogId: `catalog-b-${stamp}`,
      })
    );
    assert.equal(disconnected.unmatched, 1);
    assert.equal(await prisma.commerceOrder.count({ where: { tenantId: tenantB } }), 0);

    process.env.COMMERCE_ORDER_CAPTURE_ENABLED = "false";
    const disabled = await captureWhatsAppOrders(qaPayload(`wamid.${stamp}.disabled`));
    assert.deepEqual(disabled, { received: 0, created: 0, duplicate: 0, unmatched: 0 });
    assert.equal(await prisma.commerceOrder.count({ where: { waMessageId: `wamid.${stamp}.disabled` } }), 0);
    process.env.COMMERCE_ORDER_CAPTURE_ENABLED = "true";
  });
});
