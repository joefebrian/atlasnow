import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { receiptWaReplyAllowed } from "./receipt-wa-window";
import { zonedLocalMidnight } from "./rules";

describe("receiptWaReplyAllowed", () => {
  it("allows WA through 30 Sep 2026 Jakarta", () => {
    const lastMoment = new Date(zonedLocalMidnight(2026, 10, 1).getTime() - 1000);
    assert.equal(receiptWaReplyAllowed(lastMoment), true);
  });

  it("stops on 1 Oct 2026 Jakarta", () => {
    assert.equal(receiptWaReplyAllowed(zonedLocalMidnight(2026, 10, 1)), false);
  });
});
