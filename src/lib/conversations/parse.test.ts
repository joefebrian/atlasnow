import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWahaEvent } from "./parse";

describe("parseWahaEvent", () => {
  it("reads nested payload.id.id and session", () => {
    const r = parseWahaEvent({
      event: "message",
      session: "toko-a",
      payload: {
        id: { id: "wamid.ABC" },
        from: "628123456789@c.us",
        fromMe: false,
        body: "halo",
        timestamp: 1776230616,
      },
    });
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.session, "toko-a");
    assert.equal(r.externalId, "wamid.ABC");
    assert.equal(r.peerRaw, "628123456789@c.us");
    assert.equal(r.fromMe, false);
    assert.equal(r.body, "halo");
    assert.equal(r.sentAt.getTime(), 1776230616 * 1000);
  });

  it("accepts type + string payload.id + _data.remote", () => {
    const r = parseWahaEvent({
      type: "message.any",
      session: "hq",
      payload: {
        id: "msgid-1",
        fromMe: true,
        body: "",
        timestamp: 1776230616,
        _data: { id: { remote: "111@lid" } },
      },
    });
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.event, "message.any");
    assert.equal(r.externalId, "msgid-1");
    assert.equal(r.peerRaw, "111@lid");
    assert.equal(r.fromMe, true);
    assert.equal(r.body, "");
  });

  it("returns error when session or id missing", () => {
    const r = parseWahaEvent({ event: "message", payload: {} });
    assert.ok("error" in r);
  });

  it("returns error for non-object", () => {
    const r = parseWahaEvent(null);
    assert.ok("error" in r);
  });
});
