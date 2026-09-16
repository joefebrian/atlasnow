import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { provisionWahaSessionForLocation } from "./waha-provision";

describe("provisionWahaSessionForLocation", () => {
  it("does not start a session — connect is explicit", async () => {
    const r = await provisionWahaSessionForLocation({
      atlasLocationId: "atl_test",
      name: "Test",
      phone: "08123456789",
    });
    assert.equal(r.ok, true);
    assert.equal(r.skipped, "explicit_connect_only");
  });
});
