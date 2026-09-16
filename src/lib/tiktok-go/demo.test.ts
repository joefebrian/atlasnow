import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGoDemoKind, queryGoDemo } from "./demo";

describe("TikTok GO demo till", () => {
  it("parses sample payloads", () => {
    assert.equal(parseGoDemoKind("TT-DEMO-OK"), "ok");
    assert.equal(parseGoDemoKind("tt-demo-wrong"), "wrong");
    assert.equal(parseGoDemoKind("TT-abc"), null);
  });

  it("valid demo returns a voucher, others throw merchant language", () => {
    const ok = queryGoDemo("TT-DEMO-OK");
    assert.equal(ok.title, "Ngopi berdua");
    assert.equal(ok.shopOrderId, "demo-order-ok");
    assert.throws(() => queryGoDemo("TT-DEMO-WRONG"), /not for this outlet/i);
    assert.throws(() => queryGoDemo("TT-DEMO-USED"), /already used/i);
    assert.throws(() => queryGoDemo("TT-DEMO-TIME"), /valid time/i);
  });
});
