import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  newIdentityState,
  oauthPendingRedirect,
  signIdentityState,
  verifyIdentityState,
} from "./signup-oauth";

describe("identity OAuth state", () => {
  it("round-trips a fresh Google state", () => {
    const state = newIdentityState("google");
    const parsed = verifyIdentityState(state, "google");
    assert.ok(parsed);
    assert.equal(parsed.m, "google");
    assert.equal(parsed.t, true);
    assert.equal(parsed.p, undefined);
  });

  it("carries signup WhatsApp on the state", () => {
    const state = newIdentityState("google", "0812-3456-7890", true);
    const parsed = verifyIdentityState(state, "google");
    assert.ok(parsed);
    assert.equal(parsed.p, "6281234567890");
    assert.equal(parsed.k, "brand");
    assert.equal(parsed.g, 1);
  });

  it("rejects the other provider and tampered payloads", () => {
    const state = newIdentityState("facebook");
    assert.equal(verifyIdentityState(state, "google"), null);
    assert.equal(verifyIdentityState(state + "x", "facebook"), null);
    const stale = signIdentityState({
      v: 1,
      n: "abc",
      m: "google",
      t: true,
      iat: Date.now() - 11 * 60 * 1000,
    });
    assert.equal(verifyIdentityState(stale, "google"), null);
  });

  it("pending redirect carries brand for click-to-WA", () => {
    assert.equal(oauthPendingRedirect("https://atlasnow.co"), "https://atlasnow.co/signup/pending");
    assert.equal(
      oauthPendingRedirect("https://atlasnow.co/", "Kopi Sari"),
      "https://atlasnow.co/signup/pending?brand=Kopi%20Sari"
    );
  });
});
