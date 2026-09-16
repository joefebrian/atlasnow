import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SILENCE_MS,
  canAgentOpenThread,
  canVisitorSend,
  nextQueuedNotAutoOpenedAfterHours,
  shouldCloseForSilence,
  silenceDeadline,
  visitorMessageSeen,
} from "./rules";

describe("visitorMessageSeen", () => {
  const sent = new Date("2026-09-01T10:00:00Z");
  it("is not seen until Radit opens", () => {
    assert.equal(visitorMessageSeen(null, sent), false);
  });
  it("is seen after open", () => {
    assert.equal(visitorMessageSeen(new Date("2026-09-01T10:01:00Z"), sent), true);
  });
  it("stays not seen if a newer visitor bubble is after openedAt", () => {
    assert.equal(visitorMessageSeen(new Date("2026-09-01T09:59:00Z"), sent), false);
  });
});

describe("silence close", () => {
  it("closes ACTIVE 10 minutes after Radit spoke and the visitor stayed quiet", () => {
    const lastAgentAt = new Date("2026-09-01T10:00:00Z");
    assert.equal(
      shouldCloseForSilence(
        {
          status: "ACTIVE",
          lastAgentAt,
          lastVisitorAt: new Date("2026-09-01T09:50:00Z"),
          silenceDeadlineAt: silenceDeadline(lastAgentAt),
        },
        new Date(lastAgentAt.getTime() + SILENCE_MS)
      ),
      true
    );
  });
  it("does not close if the visitor replied after Radit", () => {
    const lastAgentAt = new Date("2026-09-01T10:00:00Z");
    assert.equal(
      shouldCloseForSilence(
        {
          status: "ACTIVE",
          lastAgentAt,
          lastVisitorAt: new Date("2026-09-01T10:02:00Z"),
          silenceDeadlineAt: silenceDeadline(lastAgentAt),
        },
        new Date("2026-09-01T10:20:00Z")
      ),
      false
    );
  });
  it("does not close QUEUED threads that Radit never opened", () => {
    assert.equal(
      shouldCloseForSilence(
        {
          status: "QUEUED",
          lastAgentAt: null,
          lastVisitorAt: new Date("2026-09-01T10:00:00Z"),
          silenceDeadlineAt: null,
        },
        new Date("2026-09-01T12:00:00Z")
      ),
      false
    );
  });
  it("does not close ACTIVE before Radit has replied", () => {
    assert.equal(
      shouldCloseForSilence(
        {
          status: "ACTIVE",
          lastAgentAt: null,
          lastVisitorAt: new Date("2026-09-01T10:00:00Z"),
          silenceDeadlineAt: null,
        },
        new Date("2026-09-01T12:00:00Z")
      ),
      false
    );
  });
});

describe("visitor send + queue", () => {
  it("blocks a new chat outside hours", () => {
    assert.deepEqual(canVisitorSend({ hoursOpen: false, threadStatus: null }), {
      ok: false,
      reason: "closed_hours",
    });
  });
  it("lets an ACTIVE thread finish after hours", () => {
    assert.deepEqual(canVisitorSend({ hoursOpen: false, threadStatus: "ACTIVE" }), { ok: true });
  });
  it("blocks more messages on a QUEUED thread after hours", () => {
    assert.deepEqual(canVisitorSend({ hoursOpen: false, threadStatus: "QUEUED" }), {
      ok: false,
      reason: "closed_hours",
    });
  });
  it("starts a new thread after close, only while open", () => {
    assert.deepEqual(canVisitorSend({ hoursOpen: true, threadStatus: "CLOSED" }), { ok: true });
    assert.deepEqual(canVisitorSend({ hoursOpen: false, threadStatus: "CLOSED" }), {
      ok: false,
      reason: "closed_hours",
    });
  });
  it("does not let Radit jump the queue", () => {
    assert.equal(canAgentOpenThread({ activeId: "a1", targetId: "a2", hoursOpen: true }), false);
    assert.equal(canAgentOpenThread({ activeId: "a1", targetId: "a1", hoursOpen: true }), true);
  });
  it("does not auto-open the next queued thread after hours", () => {
    assert.equal(nextQueuedNotAutoOpenedAfterHours(false), true);
    assert.equal(canAgentOpenThread({ activeId: null, targetId: "q1", hoursOpen: false }), false);
  });
  it("lets Radit open the oldest queued thread while the desk is open", () => {
    assert.equal(canAgentOpenThread({ activeId: null, targetId: "q1", hoursOpen: true }), true);
  });
});
