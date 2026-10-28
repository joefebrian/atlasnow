import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { paymentLinkMessage } from "@/lib/yola/checkout";
import { pilotAllowlist, pilotLinkSendEnabled, recipientAllowed } from "@/lib/yola/config";

describe("yola demo checkout", () => {
  const previous = {
    allow: process.env.YOLA_PILOT_ALLOWLIST,
    send: process.env.YOLA_PILOT_LINK_SEND_ENABLED,
  };

  after(() => {
    if (previous.allow === undefined) delete process.env.YOLA_PILOT_ALLOWLIST;
    else process.env.YOLA_PILOT_ALLOWLIST = previous.allow;
    if (previous.send === undefined) delete process.env.YOLA_PILOT_LINK_SEND_ENABLED;
    else process.env.YOLA_PILOT_LINK_SEND_ENABLED = previous.send;
  });

  it("builds the test payment message without a phone number", () => {
    const body = paymentLinkMessage({
      orderId: "YOLA-20261028-000002",
      url: "https://atlasnow.co/pay/yola/abcDEF123_token-value",
    });
    assert.match(body, /Pesanan YOLA FUN kamu sudah kami terima!/);
    assert.match(body, /Order ID: YOLA-20261028-000002/);
    assert.match(body, /Presale Card 2x Entry/);
    assert.match(body, /Rp499\.000/);
    assert.match(body, /Menunggu Pembayaran/);
    assert.match(body, /https:\/\/atlasnow\.co\/pay\/yola\/abcDEF123_token-value/);
    assert.match(body, /TEST MODE/);
    assert.equal(body.includes("+62"), false);
    assert.equal(body.includes("08"), false);
  });

  it("keeps the pilot allowlist empty and refuses the test sender", () => {
    delete process.env.YOLA_PILOT_ALLOWLIST;
    delete process.env.YOLA_PILOT_LINK_SEND_ENABLED;
    assert.deepEqual(pilotAllowlist(), []);
    assert.equal(pilotLinkSendEnabled(), false);
    assert.equal(recipientAllowed("628111111111"), false);
    assert.equal(recipientAllowed("15554362839"), false);
    process.env.YOLA_PILOT_ALLOWLIST = "+1 555-436-2839,6281234567890";
    assert.deepEqual(pilotAllowlist(), ["6281234567890"]);
    assert.equal(recipientAllowed("6281234567890"), true);
    assert.equal(recipientAllowed("+62 812-3456-7890"), true);
    process.env.YOLA_PILOT_LINK_SEND_ENABLED = "false";
    assert.equal(pilotLinkSendEnabled(), false);
    process.env.YOLA_PILOT_LINK_SEND_ENABLED = "true";
    assert.equal(pilotLinkSendEnabled(), true);
  });
});
