import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchesPhrase,
  parseAllowlist,
  parsePhrases,
  validateAutomationInput,
  withinServiceWindow,
  workspaceFlowPayload,
  workspaceTextPayload,
} from "@/lib/commerce-automation/match";

const base = {
  inboundEnabled: false,
  paymentFollowUpEnabled: false,
  marketingEnabled: false,
  pilotMode: true,
  flowId: "",
  flowScreen: "",
  flowCta: "",
  inboundBody: "",
  triggerPhrases: "",
  paymentTriggerPhrases: "",
  paymentMessageText: "",
};

describe("workspace automation matching", () => {
  it("treats an empty trigger list as no match", () => {
    assert.deepEqual(parsePhrases("\n a \n"), []);
    assert.equal(matchesPhrase("hello order", []), false);
    assert.equal(matchesPhrase("  ", ["order"]), false);
    assert.equal(matchesPhrase("I want the Menu", parsePhrases("menu")), true);
  });

  it("keeps the 24 hour service window closed when the last inbound is missing or old", () => {
    const now = new Date("2026-10-28T00:00:00.000Z");
    assert.equal(withinServiceWindow(null, now), false);
    assert.equal(withinServiceWindow(new Date("2026-10-26T23:59:59.000Z"), now), false);
    assert.equal(withinServiceWindow(new Date("2026-10-27T00:00:00.000Z"), now), true);
  });

  it("builds a session flow or text payload and refuses a template shape", () => {
    const flow = workspaceFlowPayload({
      to: "+628123450001",
      flowId: "123456789012345",
      flowToken: "tok",
      screen: "START",
      body: "Here is the form.",
      cta: "Open",
    });
    const text = workspaceTextPayload("628123450001", "Payment link");
    assert.equal(flow.type, "interactive");
    assert.equal(flow.interactive.type, "flow");
    assert.equal(text.type, "text");
    assert.equal(JSON.stringify(flow).includes("template"), false);
    assert.equal(JSON.stringify(text).includes("template"), false);
    assert.equal(JSON.stringify(flow).includes("499"), false);
    assert.equal(JSON.stringify(flow).includes("YOLA"), false);
  });

  it("rejects an enabled inbound workflow that is missing its Flow", () => {
    const rejected = validateAutomationInput({ ...base, inboundEnabled: true, triggerPhrases: "menu" });
    assert.equal(rejected.ok, false);
    const payment = validateAutomationInput({ ...base, paymentFollowUpEnabled: true });
    assert.equal(payment.ok, false);
    const allow = parseAllowlist(["62812", "not-a-number"]);
    assert.equal(allow.ok, false);
  });
});
