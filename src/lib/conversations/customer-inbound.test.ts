import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customerInboundBody, handoffExpiry, handoffMinutes, humanHandoffActive } from "./customer-inbound";
import { readInbound } from "@/lib/yola/inbound";

describe("customer inbound filter", () => {
  it("drops echoes, history, and contact sync before automation", () => {
    const body = {
      entry: [
        {
          changes: [
            { field: "messages", value: { metadata: { phone_number_id: "P" }, messages: [{ id: "wamid.LIVE", from: "628111", type: "text", text: { body: "order menu" } }] } },
            { field: "smb_message_echoes", value: { message_echoes: [{ id: "wamid.ECHO", from: "1555", to: "628111" }] } },
            { field: "history", value: { history: [{ threads: [{ messages: [{ id: "wamid.OLD" }] }] }] } },
            { field: "smb_app_state_sync", value: { state_sync: [{ type: "contact" }] } },
          ],
        },
      ],
    };
    const filtered = customerInboundBody(body, []) as { entry: Array<{ changes: Array<{ field?: string }> }> };
    assert.equal(filtered.entry[0].changes.length, 1);
    assert.equal(filtered.entry[0].changes[0].field, "messages");
    const events = readInbound(filtered);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.wamid, "wamid.LIVE");
  });

  it("removes a customer wamid when a human handoff is active", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messages: [
                  { id: "wamid.KEEP", from: "628111", type: "text", text: { body: "order menu" } },
                  { id: "wamid.SKIP", from: "628111", type: "text", text: { body: "order menu" } },
                ],
                statuses: [{ id: "wamid.OUT", status: "delivered" }],
              },
            },
          ],
        },
      ],
    };
    const filtered = customerInboundBody(body, ["wamid.SKIP"]);
    const events = readInbound(filtered);
    assert.deepEqual(events.map((event) => event.wamid).sort(), ["wamid.KEEP", "wamid.OUT"]);
  });

  it("keeps human handoff separate from the 24 hour service window", () => {
    const now = new Date("2026-10-28T08:00:00.000Z");
    assert.equal(handoffMinutes({}), 30);
    assert.equal(handoffMinutes({ WHATSAPP_HANDOFF_MINUTES: "1440" }), 30);
    assert.equal(handoffMinutes({ WHATSAPP_HANDOFF_MINUTES: "0" }), 0);
    assert.equal(handoffExpiry(now, 0), null);
    assert.equal(
      humanHandoffActive({
        state: "HUMAN_ACTIVE",
        until: new Date("2026-10-28T08:20:00.000Z"),
        now,
      }),
      true
    );
    assert.equal(
      humanHandoffActive({
        state: "HUMAN_ACTIVE",
        until: new Date("2026-10-28T07:00:00.000Z"),
        now,
      }),
      false
    );
    assert.equal(
      humanHandoffActive({
        state: "",
        until: new Date("2026-10-29T08:00:00.000Z"),
        now,
      }),
      false
    );
    assert.equal(humanHandoffActive({ state: "HUMAN_ACTIVE", until: null, now }), true);
  });
});
