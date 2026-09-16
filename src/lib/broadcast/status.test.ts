import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTION_WINDOW_MS,
  applyMetaStatus,
  isActionInboundType,
  nextStatus,
} from "./status";

describe("nextStatus", () => {
  it("moves PENDING → SENT → DELIVERED → READ", () => {
    assert.equal(nextStatus("PENDING", "sent"), "SENT");
    assert.equal(nextStatus("SENT", "delivered"), "DELIVERED");
    assert.equal(nextStatus("DELIVERED", "read"), "READ");
  });
  it("does not move backwards", () => {
    assert.equal(nextStatus("READ", "delivered"), "READ");
    assert.equal(nextStatus("DELIVERED", "sent"), "DELIVERED");
  });
  it("FAILED is terminal", () => {
    assert.equal(nextStatus("FAILED", "delivered"), "FAILED");
    assert.equal(nextStatus("SENT", "failed"), "FAILED");
  });
  it("ignores played", () => {
    assert.equal(nextStatus("SENT", "played"), "SENT");
  });
});

describe("applyMetaStatus", () => {
  const t1 = new Date("2026-09-02T03:00:00Z");
  const t2 = new Date("2026-09-02T03:01:00Z");

  it("sets delivered on delivered webhook", () => {
    const p = applyMetaStatus(
      { status: "SENT", deliveredAt: null, readAt: null, failedAt: null },
      { status: "delivered", at: t1, errorCode: null, errorTitle: "", pricingCategory: "marketing", pricingType: "regular" }
    );
    assert.equal(p.status, "DELIVERED");
    assert.equal(p.deliveredAt?.toISOString(), t1.toISOString());
    assert.equal(p.pricingCategory, "marketing");
  });

  it("treats read without delivered as delivered+read", () => {
    const p = applyMetaStatus(
      { status: "SENT", deliveredAt: null, readAt: null, failedAt: null },
      { status: "read", at: t2, errorCode: null, errorTitle: "", pricingCategory: null, pricingType: null }
    );
    assert.equal(p.status, "READ");
    assert.equal(p.readAt?.toISOString(), t2.toISOString());
    assert.equal(p.deliveredAt?.toISOString(), t2.toISOString());
  });

  it("stores Meta failed code and title", () => {
    const p = applyMetaStatus(
      { status: "SENT", deliveredAt: null, readAt: null, failedAt: null },
      { status: "failed", at: t1, errorCode: 131049, errorTitle: "ecosystem", pricingCategory: null, pricingType: null }
    );
    assert.equal(p.status, "FAILED");
    assert.equal(p.errorCode, 131049);
    assert.equal(p.errorTitle, "ecosystem");
    assert.equal(p.failedAt?.toISOString(), t1.toISOString());
  });
});

describe("isActionInboundType", () => {
  it("counts text, button, and list reply", () => {
    assert.equal(isActionInboundType("text"), true);
    assert.equal(isActionInboundType("button"), true);
    assert.equal(isActionInboundType("interactive"), true);
    assert.equal(isActionInboundType("image"), true);
  });
  it("does not invent URL clicks (no type for that)", () => {
    assert.equal(isActionInboundType("status"), false);
    assert.equal(isActionInboundType(""), false);
  });
  it("uses a 7-day action window", () => {
    assert.equal(ACTION_WINDOW_MS, 7 * 24 * 60 * 60 * 1000);
  });
});
