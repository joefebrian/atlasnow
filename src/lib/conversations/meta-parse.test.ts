import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMetaWebhook } from "./meta-parse";

describe("parseMetaWebhook", () => {
  it("reads a Facebook Messenger inbound text", () => {
    const r = parseMetaWebhook({
      object: "page",
      entry: [
        {
          id: "PAGE1",
          messaging: [
            {
              sender: { id: "PSID99" },
              recipient: { id: "PAGE1" },
              timestamp: 1700000000000,
              message: { mid: "m.abc", text: "halo vilo" },
            },
          ],
        },
      ],
    });
    assert.ok(!("error" in r));
    assert.equal(r.events.length, 1);
    assert.equal(r.events[0].provider, "FACEBOOK");
    assert.equal(r.events[0].assetId, "PAGE1");
    assert.equal(r.events[0].senderId, "PSID99");
    assert.equal(r.events[0].externalId, "meta:m.abc");
    assert.equal(r.events[0].body, "halo vilo");
    assert.equal(r.events[0].fromMe, false);
  });

  it("reads an Instagram inbound and skips delivery pings", () => {
    const r = parseMetaWebhook({
      object: "instagram",
      entry: [
        {
          id: "IG1",
          messaging: [
            { sender: { id: "X" }, recipient: { id: "IG1" }, delivery: { mids: ["z"] } },
            {
              sender: { id: "IGSID1" },
              recipient: { id: "IG1" },
              timestamp: 1700000001000,
              message: { mid: "ig.1", text: "mau gelato" },
            },
          ],
        },
      ],
    });
    assert.ok(!("error" in r));
    assert.equal(r.events.length, 1);
    assert.equal(r.events[0].provider, "INSTAGRAM");
    assert.equal(r.events[0].senderId, "IGSID1");
    assert.equal(r.events[0].assetId, "IG1");
  });

  it("marks page echoes as fromMe", () => {
    const r = parseMetaWebhook({
      object: "page",
      entry: [
        {
          messaging: [
            {
              sender: { id: "PAGE1" },
              recipient: { id: "PSID99" },
              timestamp: 1,
              message: { mid: "m.out", text: "ok", is_echo: true },
            },
          ],
        },
      ],
    });
    assert.ok(!("error" in r));
    assert.equal(r.events[0].fromMe, true);
    assert.equal(r.events[0].senderId, "PSID99");
    assert.equal(r.events[0].assetId, "PAGE1");
  });

  it("reads an image attachment as a placeholder", () => {
    const r = parseMetaWebhook({
      object: "page",
      entry: [
        {
          id: "PAGE1",
          messaging: [
            {
              sender: { id: "PSID99" },
              recipient: { id: "PAGE1" },
              timestamp: 2,
              message: { mid: "m.img", attachments: [{ type: "image" }] },
            },
          ],
        },
      ],
    });
    assert.ok(!("error" in r));
    assert.equal(r.events[0].body, "[image]");
  });

  it("rejects non-objects", () => {
    const r = parseMetaWebhook(null);
    assert.ok("error" in r);
  });
});
