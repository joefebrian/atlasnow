import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activityKind, actorLabel, humanizeAction } from "./activity";

describe("activity copy", () => {
  it("labels WhatsApp drop as system", () => {
    assert.equal(activityKind("WAHA_SESSION_DOWN"), "system");
    assert.equal(humanizeAction("WAHA_SESSION_DOWN", "en"), "WhatsApp disconnected");
    assert.equal(humanizeAction("WAHA_SESSION_DOWN", "id"), "WhatsApp terputus");
  });

  it("marks Super Admin actors", () => {
    assert.equal(
      actorLabel({
        actorName: "Joe",
        actorEmail: "admin@p2plabs.local",
        actorIsPlatformAdmin: true,
        locale: "en",
      }),
      "Joe (AtlasNow)"
    );
    assert.equal(
      actorLabel({
        actorName: null,
        actorEmail: null,
        actorIsPlatformAdmin: false,
        locale: "en",
      }),
      "System"
    );
  });
});
