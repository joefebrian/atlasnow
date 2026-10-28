import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveNumberHealth } from "@/lib/conversations/cloud-hq";
import { encryptSecret } from "@/lib/google/crypto";
import { effectiveNumberAutomation, numberUsesWorkspaceDefault } from "@/lib/commerce-automation/number-policy";

const workspace = {
  phoneNumberId: "phone-a",
  wabaId: "waba-a",
  marketingAuthorizedAt: null,
  allowlist: [],
  inboundEnabled: true,
  paymentFollowUpEnabled: false,
  marketingEnabled: false,
  pilotMode: false,
  flowId: "flow",
  flowScreen: "START",
  flowCta: "Open",
  inboundBody: "Hello",
  triggerPhrases: "menu",
  paymentTriggerPhrases: null,
  paymentMessageText: null,
};

describe("number automation policy", () => {
  it("keeps a single number on the workspace default", () => {
    assert.equal(
      numberUsesWorkspaceDefault({
        workspacePhoneNumberId: null,
        phoneNumberId: "phone-a",
        isDefault: false,
        connectedCount: 1,
      }),
      true
    );
  });

  it("does not activate a second number from another number's default", () => {
    const second = effectiveNumberAutomation({
      tenantId: "tenant",
      phoneNumberId: "phone-b",
      wabaId: "waba-a",
      isDefault: false,
      connectedCount: 2,
      workspace,
      override: null,
    });
    assert.equal(second?.usesWorkspaceDefault, false);
    assert.equal(second?.inboundEnabled, false);
    const first = effectiveNumberAutomation({
      tenantId: "tenant",
      phoneNumberId: "phone-a",
      wabaId: "waba-a",
      isDefault: true,
      connectedCount: 2,
      workspace,
      override: null,
    });
    assert.equal(first?.inboundEnabled, true);
  });

  it("lets an explicit override turn one number off", () => {
    const row = effectiveNumberAutomation({
      tenantId: "tenant",
      phoneNumberId: "phone-a",
      wabaId: "waba-a",
      isDefault: true,
      connectedCount: 1,
      workspace,
      override: {
        inboundEnabled: false,
        paymentFollowUpEnabled: null,
        marketingEnabled: null,
        pilotMode: null,
        flowId: null,
        flowScreen: null,
        flowCta: null,
        inboundBody: null,
        triggerPhrases: null,
        paymentTriggerPhrases: null,
        paymentMessageText: null,
      },
    });
    assert.equal(row?.inboundEnabled, false);
    assert.equal(row?.flowId, "flow");
  });
});

describe("whatsapp number health", () => {
  it("does not call a missing connector healthy", () => {
    assert.equal(deriveNumberHealth(null), "not_configured");
    assert.equal(
      deriveNumberHealth({ status: "CONNECTED", accessTokenEnc: null, lastError: null, metaJson: "{}" }),
      "not_configured"
    );
  });

  it("keeps a paused connection out of the healthy state", () => {
    const token = encryptSecret("fixture-token");
    assert.equal(
      deriveNumberHealth({
        status: "CONNECTED",
        accessTokenEnc: token,
        lastError: null,
        metaJson: JSON.stringify({ connectionStatus: "needs_attention" }),
      }),
      "needs_attention"
    );
    assert.equal(
      deriveNumberHealth({
        status: "DISCONNECTED",
        accessTokenEnc: null,
        lastError: null,
        metaJson: "{}",
      }),
      "disconnected"
    );
    assert.equal(
      deriveNumberHealth({
        status: "CONNECTED",
        accessTokenEnc: token,
        lastError: "oauth token unauthorized",
        metaJson: "{}",
      }),
      "unauthorized"
    );
  });
});
