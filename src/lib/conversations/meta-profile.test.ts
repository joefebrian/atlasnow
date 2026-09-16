import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMetaPeerLabel,
  isOpaqueMetaLabel,
  labelFromParticipants,
  metaPeerIdFromContact,
  shouldFetchMetaDisplayName,
} from "./meta-label";

describe("formatMetaPeerLabel", () => {
  it("prefers @username for Instagram", () => {
    assert.equal(
      formatMetaPeerLabel("INSTAGRAM", { username: "joefebrian.h", name: "Joe" }),
      "@joefebrian.h"
    );
    assert.equal(formatMetaPeerLabel("INSTAGRAM", { username: "@atlasnow.official" }), "@atlasnow.official");
  });

  it("falls back to name, skips generic Instagram User", () => {
    assert.equal(formatMetaPeerLabel("INSTAGRAM", { name: "Joe Febrian" }), "Joe Febrian");
    assert.equal(formatMetaPeerLabel("INSTAGRAM", { name: "Instagram User" }), null);
    assert.equal(formatMetaPeerLabel("FACEBOOK", { name: "Anita" }), "Anita");
  });

  it("joins first_name last_name for Messenger", () => {
    assert.equal(
      formatMetaPeerLabel("FACEBOOK", { first_name: "Anita", last_name: "Wijaya" }),
      "Anita Wijaya"
    );
    assert.equal(formatMetaPeerLabel("FACEBOOK", { first_name: "Joe", last_name: "" }), "Joe");
    assert.equal(formatMetaPeerLabel("FACEBOOK", { name: "28143730531949661" }), null);
  });
});

describe("isOpaqueMetaLabel", () => {
  it("treats IGSID/PSID as unusable titles", () => {
    assert.equal(isOpaqueMetaLabel("28143730531949661"), true);
    assert.equal(isOpaqueMetaLabel("ig:1054839573831547"), true);
    assert.equal(isOpaqueMetaLabel("@joefebrian.h"), false);
    assert.equal(isOpaqueMetaLabel("Anita Wijaya"), false);
    assert.equal(shouldFetchMetaDisplayName(null), true);
    assert.equal(shouldFetchMetaDisplayName("@joefebrian.h"), false);
  });
});

describe("labelFromParticipants", () => {
  it("picks the peer, not the Page", () => {
    assert.equal(
      labelFromParticipants("FACEBOOK", "PSID1", "PAGE1", [
        { id: "PAGE1", name: "AtlasNow" },
        { id: "PSID1", name: "Joe Febrian" },
      ]),
      "Joe Febrian"
    );
    assert.equal(
      labelFromParticipants("INSTAGRAM", "IGSID1", "IGBIZ", [
        { id: "IGBIZ", username: "atlasnow.official" },
        { id: "IGSID1", username: "joefebrian.h", name: "Joe" },
      ]),
      "@joefebrian.h"
    );
  });
});

describe("metaPeerIdFromContact", () => {
  it("uses lid then strips ig:/fb: prefix", () => {
    assert.equal(metaPeerIdFromContact({ lid: "10548", identifier: "ig:10548" }), "10548");
    assert.equal(metaPeerIdFromContact({ lid: null, identifier: "ig:99" }), "99");
    assert.equal(metaPeerIdFromContact({ lid: null, identifier: "fb:88" }), "88");
  });
});
