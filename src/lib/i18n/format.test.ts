import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDateTime } from "./format";

/** Fixed instant in Asia/Jakarta (UTC+7). */
const JAKARTA_MORNING = "2026-08-15T01:23:36.000+07:00";

describe("formatDateTime", () => {
  it("formats a known instant in English without using the host locale", () => {
    assert.equal(formatDateTime(JAKARTA_MORNING, "en"), "15 Aug 2026, 01:23");
  });

  it("formats a known instant in Indonesian without using the host locale", () => {
    assert.equal(formatDateTime(JAKARTA_MORNING, "id"), "15 Agu 2026, 01.23");
  });

  it("is deterministic for the same instant and locale", () => {
    const a = formatDateTime(JAKARTA_MORNING, "en");
    const b = formatDateTime(new Date(JAKARTA_MORNING), "en");
    assert.equal(a, b);
    assert.equal(a, "15 Aug 2026, 01:23");
  });

  it("returns an em dash for empty values", () => {
    assert.equal(formatDateTime(null), "—");
    assert.equal(formatDateTime(undefined), "—");
    assert.equal(formatDateTime(""), "—");
  });

  it("returns the original string when the value is not a valid date", () => {
    assert.equal(formatDateTime("not-a-date"), "not-a-date");
  });

  it("defaults to English when locale is omitted", () => {
    assert.equal(formatDateTime(JAKARTA_MORNING), "15 Aug 2026, 01:23");
  });
});
