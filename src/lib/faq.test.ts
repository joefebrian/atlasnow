import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_FAQ, parseFaqJson, sanitizeFaqList } from "./faq";

describe("parseFaqJson", () => {
  it("returns defaults when missing", () => {
    const items = parseFaqJson(null);
    assert.equal(items[0].id, DEFAULT_FAQ[0].id);
    assert.ok(items.length >= 8);
  });

  it("keeps an explicit empty list", () => {
    assert.deepEqual(parseFaqJson("[]"), []);
  });

  it("drops items without English Q/A", () => {
    const items = sanitizeFaqList([
      { id: "a", qEn: "Q", aEn: "A", qId: "", aId: "" },
      { id: "b", qEn: "", aEn: "nope", qId: "x", aId: "y" },
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "a");
  });
});
