import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { purposePermitted, type WorkspaceAutomationState } from "@/lib/commerce-automation/policy";

const off: WorkspaceAutomationState = {
  configured: false,
  inboundEnabled: false,
  paymentFollowUpEnabled: false,
  marketingEnabled: false,
  pilotMode: true,
};

const allOn: WorkspaceAutomationState = {
  configured: true,
  inboundEnabled: true,
  paymentFollowUpEnabled: true,
  marketingEnabled: true,
  pilotMode: false,
};

describe("workspace automation policy", () => {
  it("lets a false legacy flag block every purpose", () => {
    for (const purpose of ["flow_invite", "payment_link", "marketing"] as const) {
      assert.equal(purposePermitted({ purpose, legacyFlag: false, workspace: allOn }), false);
    }
  });

  it("keeps an enabled legacy flag on its own purpose", () => {
    assert.equal(purposePermitted({ purpose: "flow_invite", legacyFlag: true, workspace: off }), true);
    assert.equal(purposePermitted({ purpose: "payment_link", legacyFlag: false, workspace: allOn }), false);
    assert.equal(purposePermitted({ purpose: "marketing", legacyFlag: false, workspace: allOn }), false);
  });

  it("leaves a new workspace disabled until its own row is enabled", () => {
    assert.equal(purposePermitted({ purpose: "flow_invite", legacyFlag: null, workspace: off }), false);
    assert.equal(purposePermitted({ purpose: "payment_link", legacyFlag: null, workspace: off }), false);
    assert.equal(purposePermitted({ purpose: "marketing", legacyFlag: null, workspace: off }), false);
    const paymentOnly: WorkspaceAutomationState = { ...off, configured: true, paymentFollowUpEnabled: true };
    assert.equal(purposePermitted({ purpose: "payment_link", legacyFlag: null, workspace: paymentOnly }), true);
    assert.equal(purposePermitted({ purpose: "flow_invite", legacyFlag: null, workspace: paymentOnly }), false);
    assert.equal(purposePermitted({ purpose: "marketing", legacyFlag: null, workspace: paymentOnly }), false);
  });
});
