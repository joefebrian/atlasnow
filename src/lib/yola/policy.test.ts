import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyIntent, normalizeVisitTime, parseFlowForm, toE164, phonesDiffer } from "@/lib/yola/policy";
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

  it("maps the four published Flow slots and keeps the legacy clock times", () => {
    const slots = [
      ["SLOT_1000", "10:00"],
      ["SLOT_1200", "12:00"],
      ["SLOT_1400", "14:00"],
      ["SLOT_1600", "16:00"],
    ] as const;
    for (const [slot, clock] of slots) {
      assert.equal(normalizeVisitTime(slot), clock);
      assert.equal(normalizeVisitTime(clock), clock);
      const parsed = parseFlowForm(JSON.stringify({
        buyer_name: "Sari",
        buyer_phone: "08111111111",
        visit_date: "2026-12-01",
        visit_time: slot,
        flow_token: "flow-token-value",
      }));
      assert.equal(parsed.form?.visitTime, clock);
    }
    assert.equal(normalizeVisitTime("SLOT_1800"), null);
    assert.equal(normalizeVisitTime("10.00 (demo)"), null);
    assert.equal(normalizeVisitTime("09:00"), null);
    const rejected = parseFlowForm(JSON.stringify({
      buyer_name: "Sari",
      buyer_phone: "08111111111",
      visit_date: "2026-12-01",
      visit_time: "SLOT_1800",
      flow_token: "flow-token-value",
    }));
    assert.equal(rejected.form, null);
    assert.deepEqual(rejected.errors, ["visit_time"]);
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
