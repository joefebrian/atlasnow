import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  diffDaysInclusive,
  formatDelta,
  lastNDays,
  monthToDate,
  previousEqualRange,
  resolveDeskRange,
} from "./range";

describe("desk range", () => {
  it("counts inclusive days and previous equal window", () => {
    assert.equal(diffDaysInclusive("2026-08-01", "2026-08-28"), 28);
    assert.deepEqual(previousEqualRange("2026-08-01", "2026-08-28"), {
      from: "2026-07-04",
      to: "2026-07-31",
    });
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });

  it("defaults to this month through today", () => {
    const r = resolveDeskRange({}, new Date("2026-08-28T10:00:00+07:00"));
    assert.equal(r.from, "2026-08-01");
    assert.equal(r.to, "2026-08-28");
    assert.equal(r.compare, true);
    assert.equal(r.priorFrom, "2026-07-04");
    assert.equal(r.priorTo, "2026-07-31");
  });

  it("clamps inverted and future dates", () => {
    const r = resolveDeskRange(
      { from: "2026-09-10", to: "2026-08-01", compare: "0" },
      new Date("2026-08-28T10:00:00+07:00")
    );
    assert.equal(r.from, "2026-08-01");
    assert.equal(r.to, "2026-08-28");
    assert.equal(r.compare, false);
  });

  it("presets 7/28 days", () => {
    assert.deepEqual(lastNDays("2026-08-28", 7), { from: "2026-08-22", to: "2026-08-28" });
    assert.deepEqual(monthToDate("2026-08-28"), { from: "2026-08-01", to: "2026-08-28" });
  });

  it("formats compare delta without inventing a base", () => {
    assert.deepEqual(formatDelta(20, 10), { delta: "+100%", deltaUp: true });
    assert.deepEqual(formatDelta(8, 10), { delta: "-20%", deltaUp: false });
    assert.deepEqual(formatDelta(4, 0), { delta: "+4", deltaUp: true });
    assert.deepEqual(formatDelta(0, 0), { delta: "0", deltaUp: true });
  });
});
