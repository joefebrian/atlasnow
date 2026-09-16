import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEsSession } from "./embedded-signup";

describe("parseEsSession", () => {
  it("reads coexistence finish", () => {
    const r = parseEsSession({
      type: "WA_EMBEDDED_SIGNUP",
      event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
      data: { waba_id: "W1", phone_number_id: "P1", business_id: "B1" },
    });
    assert.ok(!("error" in r));
    assert.equal(r.coexistence, true);
    assert.equal(r.wabaId, "W1");
    assert.equal(r.phoneNumberId, "P1");
  });

  it("reads dedicated Cloud finish", () => {
    const r = parseEsSession({
      type: "WA_EMBEDDED_SIGNUP",
      event: "FINISH",
      data: { waba_id: "W1", phone_number_id: "P1" },
    });
    assert.ok(!("error" in r));
    assert.equal(r.coexistence, false);
  });

  it("maps cancel", () => {
    const r = parseEsSession({ type: "WA_EMBEDDED_SIGNUP", event: "CANCEL", data: { current_step: "X" } });
    assert.ok("error" in r);
    assert.equal(r.error, "cancelled");
  });
});
