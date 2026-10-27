import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyIntent, toE164, phonesDiffer } from "@/lib/yola/policy";
import { bulkMarketingEnabled, flowSendEnabled, livePaymentsEnabled, ticketLiveIssuanceEnabled } from "@/lib/yola/config";
import { sendBulkCampaign } from "@/lib/yola/template";
import { xenditChargeAllowed } from "@/lib/yola/payments";

describe("yola policy", () => {
  it("treats a bare presale word as handoff and a yola phrase as yola", () => {
    assert.equal(classifyIntent("presale"), "ambiguous");
    assert.equal(classifyIntent("tiket"), "ambiguous");
    assert.equal(classifyIntent("yola fun"), "yola");
    assert.equal(classifyIntent("kartu presale"), "yola");
    assert.equal(classifyIntent("berhenti"), "opt_out");
    assert.equal(classifyIntent("halo"), "unrelated");
  });

  it("maps a local mobile number to +62", () => {
    assert.equal(toE164("08111111111"), "+628111111111");
    assert.equal(phonesDiffer("628111111111", "+628111111111"), false);
    assert.equal(phonesDiffer("628222222222", "+628111111111"), true);
  });

  it("keeps customer-facing flags off unless each one is exactly true", () => {
    const previous = {
      send: process.env.YOLA_FLOW_SEND_ENABLED,
      bulk: process.env.YOLA_BULK_MARKETING_ENABLED,
      pay: process.env.YOLA_LIVE_PAYMENTS_ENABLED,
      ticket: process.env.YOLA_TICKET_LIVE_ISSUANCE_ENABLED,
    };
    delete process.env.YOLA_FLOW_SEND_ENABLED;
    delete process.env.YOLA_BULK_MARKETING_ENABLED;
    delete process.env.YOLA_LIVE_PAYMENTS_ENABLED;
    delete process.env.YOLA_TICKET_LIVE_ISSUANCE_ENABLED;
    assert.equal(flowSendEnabled(), false);
    assert.equal(bulkMarketingEnabled(), false);
    assert.equal(livePaymentsEnabled(), false);
    assert.equal(ticketLiveIssuanceEnabled(), false);
    assert.deepEqual(sendBulkCampaign(), { ok: false, reason: "bulk_disabled" });
    assert.equal(xenditChargeAllowed(), false);
    process.env.YOLA_BULK_MARKETING_ENABLED = "true";
    assert.deepEqual(sendBulkCampaign(), { ok: false, reason: "bulk_disabled" });
    for (const [key, value] of Object.entries(previous)) {
      const name = key === "send" ? "YOLA_FLOW_SEND_ENABLED" : key === "bulk" ? "YOLA_BULK_MARKETING_ENABLED" : key === "pay" ? "YOLA_LIVE_PAYMENTS_ENABLED" : "YOLA_TICKET_LIVE_ISSUANCE_ENABLED";
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
});
