import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COOKIE_CONSENT_KEY, gaAllowedHost, isGaPublicPath } from "./ga";

describe("GA public surface", () => {
  it("only allows atlasnow.co hosts", () => {
    assert.equal(gaAllowedHost("atlasnow.co"), true);
    assert.equal(gaAllowedHost("www.atlasnow.co"), true);
    assert.equal(gaAllowedHost("atlasnow.co:443"), true);
    assert.equal(gaAllowedHost("localhost"), false);
    assert.equal(gaAllowedHost("127.0.0.1"), false);
  });

  it("covers marketing and signup, not workspace or member cards", () => {
    assert.equal(isGaPublicPath("/"), true);
    assert.equal(isGaPublicPath("/pricing"), true);
    assert.equal(isGaPublicPath("/signup"), true);
    assert.equal(isGaPublicPath("/signup/pending"), true);
    assert.equal(isGaPublicPath("/login"), true);
    assert.equal(isGaPublicPath("/contact"), true);
    assert.equal(isGaPublicPath("/conversations"), false);
    assert.equal(isGaPublicPath("/loyalty"), false);
    assert.equal(isGaPublicPath("/card/abc"), false);
    assert.equal(isGaPublicPath("/join/x"), false);
    assert.equal(isGaPublicPath("/c/x"), false);
    assert.equal(isGaPublicPath("/api/contact"), false);
    assert.equal(isGaPublicPath("/demo/go"), false);
  });

  it("bumps cookie consent when ads measurement is included", () => {
    assert.equal(COOKIE_CONSENT_KEY, "atlasnow_cookie_ok_v3");
  });
});
