import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickReceiptNo } from "./receipt-nos";

describe("pickReceiptNo", () => {
  it("rejects a blank ticket", () => {
    const r = pickReceiptNo("  ");
    assert.equal(r.ok, false);
  });

  it("keeps the printed number as trxId", () => {
    const r = pickReceiptNo(" TRX-1 ");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.trxId, "TRX-1");
  });
});
