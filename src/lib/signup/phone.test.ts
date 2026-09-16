import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSignupPhone } from "./phone";

describe("parseSignupPhone", () => {
  it("accepts 08, +62, and 62", () => {
    assert.equal(parseSignupPhone("0812-3456-7890"), "6281234567890");
    assert.equal(parseSignupPhone("+62 812 3456 7890"), "6281234567890");
    assert.equal(parseSignupPhone("6281234567890"), "6281234567890");
  });

  it("rejects empty, short, or non-ID", () => {
    assert.equal(parseSignupPhone(""), null);
    assert.equal(parseSignupPhone("0812"), null);
    assert.equal(parseSignupPhone("+1 555 0100"), null);
    assert.equal(parseSignupPhone(null), null);
  });
});
