import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  providerLabel,
  providerTreatsPeerAsPhone,
  providerShort,
  providerNativeClient,
} from "./provider";

describe("providerLabel", () => {
  it("maps branch WhatsApp vs HQ, IG/FB to product names", () => {
    assert.equal(providerLabel("WAHA"), "WhatsApp");
    assert.equal(providerLabel("META_CLOUD"), "WhatsApp HQ");
    assert.equal(providerLabel("INSTAGRAM"), "Instagram");
    assert.equal(providerLabel("FACEBOOK"), "Messenger");
    assert.equal(providerLabel("TIKTOK"), "TikTok");
  });
});

describe("providerTreatsPeerAsPhone", () => {
  it("only WhatsApp providers treat bare digits as a phone", () => {
    assert.equal(providerTreatsPeerAsPhone("WAHA"), true);
    assert.equal(providerTreatsPeerAsPhone("META_CLOUD"), true);
    assert.equal(providerTreatsPeerAsPhone("INSTAGRAM"), false);
    assert.equal(providerTreatsPeerAsPhone("FACEBOOK"), false);
    assert.equal(providerTreatsPeerAsPhone("TIKTOK"), false);
  });
});

describe("providerShort", () => {
  it("uses short badges", () => {
    assert.equal(providerShort("INSTAGRAM"), "IG");
    assert.equal(providerShort("WAHA"), "WA");
    assert.equal(providerShort("META_CLOUD"), "HQ");
  });
});

describe("providerNativeClient", () => {
  it("names the native app a live send should appear in", () => {
    assert.equal(providerNativeClient("FACEBOOK"), "Messenger");
    assert.equal(providerNativeClient("INSTAGRAM"), "Instagram");
    assert.equal(providerNativeClient("META_CLOUD"), "WhatsApp");
    assert.equal(providerNativeClient("WAHA"), null);
  });
});
