import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACTIVITY_RETENTION_DAYS_DEFAULT, activityCutoff, activityRetentionDays } from "./activity-purge";

describe("activity purge", () => {
  it("defaults to 14 days", () => {
    const prev = process.env.ACTIVITY_RETENTION_DAYS;
    delete process.env.ACTIVITY_RETENTION_DAYS;
    assert.equal(activityRetentionDays(), 14);
    assert.equal(ACTIVITY_RETENTION_DAYS_DEFAULT, 14);
    if (prev !== undefined) process.env.ACTIVITY_RETENTION_DAYS = prev;
  });

  it("cuts off 14 days before now", () => {
    const now = new Date("2026-09-19T00:00:00.000Z");
    const cut = activityCutoff(now, 14);
    assert.equal(cut.toISOString(), "2026-09-05T00:00:00.000Z");
  });
});
