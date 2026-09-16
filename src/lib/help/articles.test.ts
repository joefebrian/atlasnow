import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HELP_ARTICLES } from "./articles";

describe("help articles", () => {
  it("has unique slugs", () => {
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    assert.equal(slugs.length, new Set(slugs).size);
  });

  it("does not invent visits as a product promise", () => {
    const blob = HELP_ARTICLES.map((a) => a.body.map((p) => p.en).join(" ")).join(" ");
    assert.match(blob, /do not invent visits/i);
    assert.match(blob, /TikTok GO/);
    assert.match(blob, /not a stamp/i);
  });
});
