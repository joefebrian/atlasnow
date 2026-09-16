import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDeletionRequest } from "./deletion-request";

describe("parseDeletionRequest", () => {
  it("accepts a Facebook Messenger deletion request", () => {
    const r = parseDeletionRequest({
      name: "Ada",
      email: "ada@example.com",
      kind: "facebook",
      identifier: "PSID 123",
      details: "Please delete my Page DMs",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.email, "ada@example.com");
    assert.equal(r.value.kind, "facebook");
    assert.equal(r.value.identifier, "PSID 123");
  });

  it("rejects missing email and unknown kind", () => {
    const noEmail = parseDeletionRequest({
      name: "Ada",
      kind: "facebook",
    });
    assert.equal(noEmail.ok, false);

    const badKind = parseDeletionRequest({
      email: "ada@example.com",
      kind: "not-a-channel",
    });
    assert.equal(badKind.ok, false);
  });

  it("accepts a TikTok Direct deletion request", () => {
    const r = parseDeletionRequest({
      name: "Ada",
      email: "ada@example.com",
      kind: "tiktok",
      identifier: "open_id abc",
      details: "Please delete my TikTok DMs",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.kind, "tiktok");
  });

  it("trims fields and defaults optional bits", () => {
    const r = parseDeletionRequest({
      email: "  bob@p2plabs.co  ",
      kind: "account",
      name: "  ",
      identifier: "",
      details: null,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.email, "bob@p2plabs.co");
    assert.equal(r.value.name, "");
    assert.equal(r.value.identifier, "");
    assert.equal(r.value.details, "");
  });
});
