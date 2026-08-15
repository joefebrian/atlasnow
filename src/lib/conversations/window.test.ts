import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONVERSATION_GAP_MS,
  previewBody,
  shouldStartNewConversation,
} from "./window";

describe("shouldStartNewConversation", () => {
  const now = new Date("2026-08-15T10:00:00.000Z");

  it("starts when there is no prior message", () => {
    assert.equal(shouldStartNewConversation(null, now), true);
  });

  it("continues when gap is under 24h", () => {
    const last = new Date(now.getTime() - CONVERSATION_GAP_MS + 1000);
    assert.equal(shouldStartNewConversation(last, now), false);
  });

  it("starts when gap is 24h or more", () => {
    const last = new Date(now.getTime() - CONVERSATION_GAP_MS);
    assert.equal(shouldStartNewConversation(last, now), true);
  });
});

describe("previewBody", () => {
  it("truncates to 160 chars", () => {
    const s = "x".repeat(200);
    assert.equal(previewBody(s).length, 160);
  });
});
