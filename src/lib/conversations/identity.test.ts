import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeIdentity, resolveIdentity } from "./identity";

describe("resolveIdentity", () => {
  it("stores digits from @c.us as PHONE_VERIFIED", () => {
    const r = resolveIdentity("628123456789@c.us");
    assert.equal(r.phone, "628123456789");
    assert.equal(r.confidence, "PHONE_VERIFIED");
    assert.equal(r.identifier, "628123456789");
    assert.equal(r.lid, null);
  });

  it("stores digits from @s.whatsapp.net as PHONE_VERIFIED", () => {
    const r = resolveIdentity("628123456789@s.whatsapp.net");
    assert.equal(r.phone, "628123456789");
    assert.equal(r.confidence, "PHONE_VERIFIED");
  });

  it("does not invent a phone from @lid only", () => {
    const r = resolveIdentity("123456789012345@lid");
    assert.equal(r.phone, null);
    assert.equal(r.lid, "123456789012345");
    assert.equal(r.confidence, "OPAQUE_LID");
    assert.equal(r.identifier, "123456789012345@lid");
  });

  it("uses extraPhone with lid as LID_RESOLVED", () => {
    const r = resolveIdentity("123456789012345@lid", "628111222333");
    assert.equal(r.phone, "628111222333");
    assert.equal(r.lid, "123456789012345");
    assert.equal(r.confidence, "LID_RESOLVED");
    assert.equal(r.identifier, "628111222333");
  });

  it("treats bare numeric peer as PHONE_VERIFIED", () => {
    const r = resolveIdentity("628999888777");
    assert.equal(r.phone, "628999888777");
    assert.equal(r.confidence, "PHONE_VERIFIED");
  });

  it("strips :device suffix before digits on @c.us", () => {
    const r = resolveIdentity("628123456789:12@c.us");
    assert.equal(r.phone, "628123456789");
    assert.equal(r.identifier, "628123456789");
    assert.equal(r.confidence, "PHONE_VERIFIED");
    assert.equal(r.lid, null);
  });

  it("strips :device suffix on @s.whatsapp.net", () => {
    const r = resolveIdentity("628123456789:55@s.whatsapp.net");
    assert.equal(r.phone, "628123456789");
    assert.equal(r.confidence, "PHONE_VERIFIED");
  });

  it("does not treat @g.us as a phone", () => {
    const r = resolveIdentity("120363042000000000@g.us");
    assert.equal(r.phone, null);
    assert.equal(r.confidence, "UNKNOWN");
    assert.equal(r.identifier, "120363042000000000@g.us");
    assert.equal(r.lid, null);
  });

  it("does not treat @newsletter as a phone", () => {
    const r = resolveIdentity("120363040000000000@newsletter");
    assert.equal(r.phone, null);
    assert.equal(r.confidence, "UNKNOWN");
    assert.equal(r.identifier, "120363040000000000@newsletter");
  });

  it("does not invent a phone from extraPhone on @g.us", () => {
    const r = resolveIdentity("120363042000000000@g.us", "628111222333");
    assert.equal(r.phone, null);
    assert.equal(r.confidence, "UNKNOWN");
  });

  it("returns UNKNOWN for empty peer", () => {
    const r = resolveIdentity("");
    assert.equal(r.phone, null);
    assert.equal(r.confidence, "UNKNOWN");
    assert.equal(r.identifier, "unknown");
  });
});

describe("mergeIdentity", () => {
  it("upgrades lid-only contact when a later event has a phone", () => {
    const first = resolveIdentity("999@lid");
    const second = resolveIdentity("628123456789@c.us");
    const merged = mergeIdentity(first, second);
    assert.equal(merged.phone, "628123456789");
    assert.equal(merged.confidence, "PHONE_VERIFIED");
    assert.equal(merged.lid, "999");
  });
});
