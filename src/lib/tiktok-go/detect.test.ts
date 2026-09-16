import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTikTokGoPayload } from "./detect";

describe("isTikTokGoPayload", () => {
  it("accepts official TT- QR strings", () => {
    assert.equal(isTikTokGoPayload("TT-abc123"), true);
    assert.equal(isTikTokGoPayload("TT-DEMO-OK"), true);
    assert.equal(isTikTokGoPayload("  tt-xyz  "), true);
  });

  it("rejects stamp cards and join URLs", () => {
    assert.equal(isTikTokGoPayload("https://atlasnow.co/c/brand/abc"), false);
    assert.equal(isTikTokGoPayload("628123456789"), false);
    assert.equal(isTikTokGoPayload(""), false);
  });
});
