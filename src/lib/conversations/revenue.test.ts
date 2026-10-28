import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyOrderRevenue, type RevenueOrder } from "./revenue";

function order(patch: Partial<RevenueOrder> = {}): RevenueOrder {
  return {
    id: "order-1",
    tenantId: "tenant-a",
    origin: "pilot",
    amountIdr: 499000,
    currency: "IDR",
    sessions: [],
    events: [],
    ...patch,
  };
}

const liveSession = {
  tenantId: "tenant-a",
  orderId: "order-1",
  provider: "xendit",
  mode: "live",
  status: "PAID",
  amountIdr: 499000,
  currency: "IDR",
};

const liveEvent = {
  tenantId: "tenant-a",
  orderId: "order-1",
  eventId: "evt-1",
  provider: "xendit",
  outcome: "PAID",
  amountIdr: 499000,
  currency: "IDR",
  live: true,
};

describe("verified revenue eligibility", () => {
  it("excludes a synthetic order with a non-sandbox PAID session", () => {
    const row = classifyOrderRevenue(
      order({
        origin: "synthetic",
        sessions: [{ ...liveSession }],
        events: [{ ...liveEvent }],
      })
    );
    assert.equal(row.verifiedRevenueIdr, 0);
    assert.equal(row.reason, "origin");
    assert.equal(row.providerConfirmed, true);
  });

  it("excludes a synthetic order with a simulated payment", () => {
    const row = classifyOrderRevenue(
      order({
        origin: "synthetic",
        sessions: [{ ...liveSession, provider: "sandbox", mode: "sandbox", status: "SIMULATED_PAID" }],
      })
    );
    assert.equal(row.simulated, 1);
    assert.equal(row.verifiedRevenueIdr, 0);
  });

  it("excludes a genuine order whose PAID status has no live provider event", () => {
    const row = classifyOrderRevenue(
      order({
        sessions: [liveSession],
        events: [{ ...liveEvent, live: false }],
      })
    );
    assert.equal(row.unverifiedPaid, 1);
    assert.equal(row.providerConfirmed, false);
    assert.equal(row.verifiedRevenueIdr, 0);
    assert.equal(row.reason, "unverified");
  });

  it("rejects a forged callback that is not a live provider settlement", () => {
    const row = classifyOrderRevenue(
      order({
        sessions: [liveSession],
        events: [{ ...liveEvent, provider: "sandbox", live: false, eventId: "forged" }],
      })
    );
    assert.equal(row.verifiedRevenueIdr, 0);
    assert.equal(row.providerConfirmed, false);
  });

  it("ignores a payment or event from another workspace", () => {
    const row = classifyOrderRevenue(
      order({
        sessions: [{ ...liveSession, tenantId: "tenant-b" }],
        events: [{ ...liveEvent, tenantId: "tenant-b" }],
      })
    );
    assert.equal(row.initiated, 0);
    assert.equal(row.verifiedRevenueIdr, 0);
  });

  it("rejects an amount mismatch", () => {
    const row = classifyOrderRevenue(
      order({
        sessions: [liveSession],
        events: [{ ...liveEvent, amountIdr: 1 }],
      })
    );
    assert.equal(row.verifiedRevenueIdr, 0);
    assert.equal(row.providerConfirmed, false);
  });

  it("counts one verified amount when the provider repeats the callback", () => {
    const row = classifyOrderRevenue(
      order({
        sessions: [liveSession],
        events: [liveEvent, { ...liveEvent, eventId: "evt-2" }],
      })
    );
    assert.equal(row.verifiedRevenueIdr, 499000);
    assert.equal(row.reason, "verified");
  });

  it("drops verified revenue after a reversal", () => {
    const row = classifyOrderRevenue(
      order({
        sessions: [liveSession],
        events: [liveEvent, { ...liveEvent, eventId: "evt-refund", outcome: "REFUNDED" }],
      })
    );
    assert.equal(row.verifiedRevenueIdr, 0);
    assert.equal(row.reason, "reversed");
    assert.equal(row.providerConfirmed, false);
  });

  it("accepts one genuine order with a live provider settlement", () => {
    const row = classifyOrderRevenue(order({ sessions: [liveSession], events: [liveEvent] }));
    assert.equal(row.verifiedRevenueIdr, 499000);
    assert.equal(row.unverifiedPaid, 0);
    assert.equal(row.providerConfirmed, true);
  });
});
