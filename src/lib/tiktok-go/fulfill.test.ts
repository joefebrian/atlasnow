import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { merchantGoError } from "./fulfill";

describe("merchantGoError", () => {
  it("does not leak developer codes to the till", () => {
    assert.equal(merchantGoError("-3000111", "x"), "This voucher is not for this outlet.");
    assert.equal(merchantGoError("-3000108", "x"), "This voucher is outside its valid time.");
    assert.equal(merchantGoError("nope", "Ask the customer to open TikTok GO."), "Ask the customer to open TikTok GO.");
  });
});
