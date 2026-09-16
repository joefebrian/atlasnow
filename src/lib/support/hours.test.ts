import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SUPPORT_HOURS,
  isSupportDeskOpen,
  parseHm,
  type SupportHours,
} from "./hours";

const hours: SupportHours = { ...DEFAULT_SUPPORT_HOURS };

describe("parseHm", () => {
  it("reads 09:00 as 540", () => {
    assert.equal(parseHm("09:00"), 540);
  });
  it("reads 17:00 as 1020", () => {
    assert.equal(parseHm("17:00"), 1020);
  });
});

describe("isSupportDeskOpen", () => {
  it("is closed at 08:59 Jakarta", () => {
    assert.equal(isSupportDeskOpen(hours, new Date("2026-09-01T08:59:00+07:00")), false);
  });
  it("is open at 09:00 Jakarta", () => {
    assert.equal(isSupportDeskOpen(hours, new Date("2026-09-01T09:00:00+07:00")), true);
  });
  it("is open at 16:59 Jakarta", () => {
    assert.equal(isSupportDeskOpen(hours, new Date("2026-09-01T16:59:00+07:00")), true);
  });
  it("is closed at 17:00 Jakarta (exclusive)", () => {
    assert.equal(isSupportDeskOpen(hours, new Date("2026-09-01T17:00:00+07:00")), false);
  });
  it("is closed when the kill switch is off", () => {
    assert.equal(
      isSupportDeskOpen({ ...hours, enabled: false }, new Date("2026-09-01T12:00:00+07:00")),
      false
    );
  });
  it("is closed on a day that is unchecked", () => {
    // 2026-09-01 is Tuesday = ISO 2
    assert.equal(
      isSupportDeskOpen({ ...hours, daysOfWeek: [1, 3, 4, 5] }, new Date("2026-09-01T12:00:00+07:00")),
      false
    );
  });
  it("opens the same afternoon if Close is moved to 21:00", () => {
    assert.equal(
      isSupportDeskOpen({ ...hours, closeHm: "21:00" }, new Date("2026-09-01T17:01:00+07:00")),
      true
    );
  });
});
