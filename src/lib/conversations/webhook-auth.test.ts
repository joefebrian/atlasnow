import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apiKeyMatches } from "./webhook-auth";

describe("apiKeyMatches", () => {
  it("rejects empty expected or provided", () => {
    assert.equal(apiKeyMatches("abc", ""), false);
    assert.equal(apiKeyMatches(null, "abc"), false);
  });
  it("accepts exact match", () => {
    assert.equal(apiKeyMatches("secret", "secret"), true);
  });
  it("rejects mismatch", () => {
    assert.equal(apiKeyMatches("nope", "secret"), false);
  });
});
