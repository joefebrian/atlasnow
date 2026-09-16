import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PITCH_ONE_DESK, PITCH_TAGLINE_A, PITCH_TAGLINE_B, pitchCopy } from "./pitch-copy";

describe("pitch copy", () => {
  it("locks the English tagline in both locales", () => {
    assert.equal(PITCH_TAGLINE_A, "Optimize Every Outlet.");
    assert.equal(PITCH_TAGLINE_B, "Capture More Demand.");
    assert.equal(PITCH_ONE_DESK, "One desk for every location.");
  });

  it("keeps EN copy in English — no mixed kasir/struk headlines", () => {
    const en = JSON.stringify(pitchCopy("en"));
    assert.doesNotMatch(en, /kasir|struk|merek hidup|daftar saja/i);
    assert.match(pitchCopy("en").inbox.title, /WhatsApp/);
    assert.match(pitchCopy("en").join.title, /receipt/);
  });

  it("has a full ID room for the toggle", () => {
    const id = pitchCopy("id");
    assert.match(id.inbox.title, /WhatsApp/);
    assert.match(id.join.title, /struk|daftar/i);
    assert.equal(id.pains.items.length, 6);
  });
});
