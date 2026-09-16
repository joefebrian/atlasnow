import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { periodKeyInTimezone, shouldCountTowardFreeService } from "./service-quota";

describe("WABA 1,000 service quota", () => {
  it("uses a calendar month in the WABA timezone, not a day", () => {
    const first = new Date("2026-10-01T00:30:00+07:00");
    const last = new Date("2026-10-31T23:00:00+07:00");
    const next = new Date("2026-11-01T00:00:00+07:00");
    assert.equal(periodKeyInTimezone(first, "Asia/Jakarta"), "2026-10");
    assert.equal(periodKeyInTimezone(last, "Asia/Jakarta"), "2026-10");
    assert.equal(periodKeyInTimezone(next, "Asia/Jakarta"), "2026-11");
  });

  it("counts delivered service and session replies, including the old free 24h tag", () => {
    assert.equal(
      shouldCountTowardFreeService({
        status: "delivered",
        pricingCategory: "service",
        pricingType: "regular",
      }),
      true
    );
    assert.equal(
      shouldCountTowardFreeService({
        status: "read",
        pricingCategory: "service",
        pricingType: "free_customer_service",
        outboundKind: "session",
      }),
      true
    );
    assert.equal(
      shouldCountTowardFreeService({
        status: "delivered",
        pricingCategory: null,
        pricingType: null,
        outboundKind: "session",
      }),
      true
    );
  });

  it("does not count templates, entry-point free, or undelivered", () => {
    assert.equal(
      shouldCountTowardFreeService({
        status: "delivered",
        pricingCategory: "marketing",
        pricingType: "regular",
        outboundKind: "template",
      }),
      false
    );
    assert.equal(
      shouldCountTowardFreeService({
        status: "delivered",
        pricingCategory: "utility",
        pricingType: "regular",
      }),
      false
    );
    assert.equal(
      shouldCountTowardFreeService({
        status: "delivered",
        pricingCategory: "service",
        pricingType: "free_entry_point",
        outboundKind: "session",
      }),
      false
    );
    assert.equal(
      shouldCountTowardFreeService({
        status: "sent",
        pricingCategory: "service",
        outboundKind: "session",
      }),
      false
    );
    assert.equal(
      shouldCountTowardFreeService({
        status: "failed",
        pricingCategory: "service",
        outboundKind: "session",
      }),
      false
    );
  });
});
