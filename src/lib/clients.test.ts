import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSelfServeSignup, needsFollowUp } from "./clients";

describe("self-serve follow-up", () => {
  it("recognizes the signup note prefix", () => {
    assert.equal(isSelfServeSignup("Self-serve signup (email). Waiting for agency follow-up."), true);
    assert.equal(isSelfServeSignup("Agency onboard"), false);
    assert.equal(isSelfServeSignup(null), false);
  });

  it("treats login-off active brands as follow-up", () => {
    assert.equal(needsFollowUp({ loginEnabled: false, status: "ACTIVE" }), true);
    assert.equal(needsFollowUp({ loginEnabled: true, status: "ACTIVE" }), false);
    assert.equal(needsFollowUp({ loginEnabled: false, status: "ARCHIVED" }), false);
  });
});
