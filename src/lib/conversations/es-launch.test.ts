import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coexistenceLaunchEnabled, embeddedSignupVersion } from "./es-config";
import { decideConnection, embeddedSignupExtras, keepSyncStatus } from "./es-launch";

describe("embedded signup launch", () => {
  it("keeps coexistence launch off unless the platform flag is exactly true", () => {
    assert.equal(coexistenceLaunchEnabled({}), false);
    assert.equal(coexistenceLaunchEnabled({ WHATSAPP_COEXISTENCE_ENABLED: "false" }), false);
    assert.equal(coexistenceLaunchEnabled({ WHATSAPP_COEXISTENCE_ENABLED: "true" }), true);
  });

  it("defaults Embedded Signup to v4 and accepts only v5", () => {
    assert.equal(embeddedSignupVersion({}), "v4");
    assert.equal(embeddedSignupVersion({ META_ES_VERSION: "v3" }), "v4");
    assert.equal(embeddedSignupVersion({ META_ES_VERSION: "v5" }), "v5");
  });

  it("uses the official v4 coexistence extras and a plain v4 Cloud API launch", () => {
    assert.deepEqual(embeddedSignupExtras("COEXISTENCE", "v4"), {
      version: "v4",
      setup: {},
      featureType: "whatsapp_business_app_onboarding",
      sessionInfoVersion: "3",
    });
    const cloud = embeddedSignupExtras("CLOUD_API_ONLY", "v4");
    assert.deepEqual(cloud, { version: "v4" });
    assert.equal("featureType" in cloud, false);
    assert.equal("sessionInfoVersion" in cloud, false);
  });

  it("uses v5 defaults for coexistence and opts the Cloud API path out", () => {
    assert.deepEqual(embeddedSignupExtras("COEXISTENCE", "v5"), { version: "v5" });
    assert.deepEqual(embeddedSignupExtras("CLOUD_API_ONLY", "v5"), {
      version: "v5",
      features: [{ name: "whatsapp_business_app_onboarding", enabled: false }],
    });
    assert.equal("sessionInfoVersion" in embeddedSignupExtras("COEXISTENCE", "v5"), false);
  });

  it("rejects coexistence before a connector exists when the launch is off", () => {
    assert.deepEqual(
      decideConnection({
        sessionCoexistence: true,
        graphOnBizApp: false,
        requestedMode: "COEXISTENCE",
        launchEnabled: false,
      }),
      { error: "coexistence_disabled" }
    );
    assert.deepEqual(
      decideConnection({
        sessionCoexistence: false,
        graphOnBizApp: true,
        requestedMode: "CLOUD_API_ONLY",
        launchEnabled: false,
      }),
      { error: "coexistence_disabled" }
    );
  });

  it("stores coexistence only when Meta confirms the Business App and the launch is on", () => {
    assert.deepEqual(
      decideConnection({
        sessionCoexistence: true,
        graphOnBizApp: true,
        requestedMode: "COEXISTENCE",
        launchEnabled: true,
      }),
      { mode: "COEXISTENCE" }
    );
    assert.deepEqual(
      decideConnection({
        sessionCoexistence: false,
        graphOnBizApp: false,
        requestedMode: "COEXISTENCE",
        launchEnabled: true,
      }),
      { error: "not_business_app" }
    );
    assert.deepEqual(
      decideConnection({
        sessionCoexistence: true,
        graphOnBizApp: false,
        requestedMode: "CLOUD_API_ONLY",
        launchEnabled: true,
      }),
      { error: "use_coexistence_option" }
    );
    assert.deepEqual(
      decideConnection({
        sessionCoexistence: false,
        graphOnBizApp: false,
        requestedMode: "CLOUD_API_ONLY",
        launchEnabled: false,
      }),
      { mode: "CLOUD_API_ONLY" }
    );
  });

  it("does not let a later webhook downgrade a finished or declined sync", () => {
    assert.equal(keepSyncStatus("complete", "syncing"), "complete");
    assert.equal(keepSyncStatus("declined", "syncing"), "declined");
    assert.equal(keepSyncStatus("syncing", "complete"), "complete");
    assert.equal(keepSyncStatus("complete", "declined"), "declined");
    assert.equal(keepSyncStatus("syncing", "error"), "error");
  });
});
