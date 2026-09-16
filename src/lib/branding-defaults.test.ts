import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_BRANDING,
  isStaleBrandingStory,
  tipForFlowStep,
} from "./branding-defaults";

describe("branding story", () => {
  it("does not treat current defaults as stale", () => {
    assert.equal(isStaleBrandingStory(DEFAULT_BRANDING), false);
  });

  it("detects the old Google-is-not-the-product narrative", () => {
    assert.equal(
      isStaleBrandingStory({
        heroHeadline: "You already run more than one outlet. The chats, members, and reviews should not live in different places.",
        supportingNarrative:
          "Google listings still matter — they are not the product.",
        supportingNarrativeId: "",
      }),
      true
    );
  });

  it("returns a tip for default flow steps", () => {
    const tip = tipForFlowStep("One brand, every outlet", "en");
    assert.ok(tip && tip.includes("Group"));
    const id = tipForFlowStep("Satu merek, semua cabang", "id");
    assert.ok(id && id.includes("Grup"));
  });
});
