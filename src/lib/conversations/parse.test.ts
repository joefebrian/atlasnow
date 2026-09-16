import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWahaEvent, parseWahaSessionStatus } from "./parse";

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

  it("uses to (customer) as peer on fromMe, not the branch from", () => {
    const r = parseWahaEvent({
      event: "message",
      session: "atl_x",
      payload: {
        id: "out-1",
        fromMe: true,
        from: "6285863666290@c.us",
        to: "6285697210806@c.us",
        body: "Sorry I message with other number",
        timestamp: 1776230616,
      },
    });
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.peerRaw, "6285697210806@c.us");
    assert.equal(r.fromMe, true);
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

describe("parseWahaSessionStatus", () => {
  it("reads FAILED and ignores messages", () => {
    const r = parseWahaSessionStatus({
      event: "session.status",
      session: "toko-a",
      payload: { status: "FAILED" },
    });
    assert.ok(r && !("error" in r));
    if (!r || "error" in r) return;
    assert.equal(r.status, "FAILED");
    assert.equal(parseWahaSessionStatus({ event: "message", session: "x" }), null);
  });
});
