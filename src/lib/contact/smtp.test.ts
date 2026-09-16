import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractEmailAddress,
  formatFromHeader,
  isSelfSend,
  isValidEmail,
  resolveContactTo,
} from "./smtp";

describe("smtp helpers", () => {
  it("extracts the address from a display-name header", () => {
    assert.equal(extractEmailAddress("AtlasNow <hello@atlasnow.co>"), "hello@atlasnow.co");
    assert.equal(extractEmailAddress(" hello@atlasnow.co "), "hello@atlasnow.co");
  });

  it("treats hello@ → hello@ as Gmail self-send", () => {
    assert.equal(isSelfSend("hello@atlasnow.co", "hello@atlasnow.co"), true);
    assert.equal(isSelfSend("AtlasNow <hello@atlasnow.co>", "hello@atlasnow.co"), true);
    assert.equal(isSelfSend("hello@atlasnow.co", "joe@p2plabs.asia"), false);
  });

  it("formats a bare address as AtlasNow <email>", () => {
    assert.equal(formatFromHeader("hello@atlasnow.co"), "AtlasNow <hello@atlasnow.co>");
    assert.equal(
      formatFromHeader("AtlasNow <hello@atlasnow.co>"),
      "AtlasNow <hello@atlasnow.co>"
    );
  });

  it("falls back contact To to hello@atlasnow.co", () => {
    assert.equal(resolveContactTo(""), "hello@atlasnow.co");
    assert.equal(resolveContactTo("  dennies@p2plabs.asia  "), "dennies@p2plabs.asia");
    assert.equal(resolveContactTo("not-an-email"), "hello@atlasnow.co");
  });

  it("rejects junk emails", () => {
    assert.equal(isValidEmail(""), false);
    assert.equal(isValidEmail("hello"), false);
    assert.equal(isValidEmail("hello@atlasnow.co"), true);
  });
});
