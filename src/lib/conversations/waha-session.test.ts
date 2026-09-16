import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonPhone } from "./identity";
import {
  isLiveWahaEngineStatus,
  mapWahaSessionStatus,
  pairingPhoneDigits,
  sessionNeedsRelink,
  wahaMaxLiveSessions,
  wahaSlotAvailable,
  webhookUrlForWaha,
} from "./waha-session";

describe("mapWahaSessionStatus", () => {
  it("maps SCAN_QR_CODE to scan and WORKING to working", () => {
    assert.equal(mapWahaSessionStatus("SCAN_QR_CODE"), "scan");
    assert.equal(mapWahaSessionStatus("WORKING"), "working");
    assert.equal(mapWahaSessionStatus("FAILED"), "failed");
    assert.equal(mapWahaSessionStatus("STOPPED"), "stopped");
    assert.equal(mapWahaSessionStatus("STARTING"), "starting");
    assert.equal(mapWahaSessionStatus(null), "none");
  });
});

describe("sessionNeedsRelink", () => {
  it("only FAILED needs a fresh QR, not STOPPED or WORKING", () => {
    assert.equal(sessionNeedsRelink("FAILED"), true);
    assert.equal(sessionNeedsRelink("STOPPED"), false);
    assert.equal(sessionNeedsRelink("WORKING"), false);
  });
});

describe("live WEBJS slot cap", () => {
  it("treats SCAN/STARTING/WORKING/FAILED as live Chromium, not STOPPED", () => {
    assert.equal(isLiveWahaEngineStatus("SCAN_QR_CODE"), true);
    assert.equal(isLiveWahaEngineStatus("STARTING"), true);
    assert.equal(isLiveWahaEngineStatus("WORKING"), true);
    assert.equal(isLiveWahaEngineStatus("FAILED"), true);
    assert.equal(isLiveWahaEngineStatus("STOPPED"), false);
    assert.equal(isLiveWahaEngineStatus(null), false);
  });

  it("defaults to 6 live sessions and parses env", () => {
    assert.equal(wahaMaxLiveSessions(undefined), 6);
    assert.equal(wahaMaxLiveSessions("8"), 8);
    assert.equal(wahaMaxLiveSessions("nope"), 6);
  });

  it("blocks a new session at the cap, allows replacing a live one", () => {
    assert.equal(wahaSlotAvailable(6, 6, false), false);
    assert.equal(wahaSlotAvailable(5, 6, false), true);
    assert.equal(wahaSlotAvailable(6, 6, true), true);
  });
});

describe("pairingPhoneDigits", () => {
  it("normalizes 08 local numbers to 62 for WAHA pairing", () => {
    assert.equal(pairingPhoneDigits("081190083695"), "6281190083695");
    assert.equal(pairingPhoneDigits("+62 812-8332-3278"), "6281283323278");
  });

  it("returns null when there is no usable phone", () => {
    assert.equal(pairingPhoneDigits(""), null);
    assert.equal(pairingPhoneDigits("123"), null);
  });
});

describe("webhookUrlForWaha", () => {
  it("rewrites localhost so Docker WAHA can reach Atlas", () => {
    assert.equal(
      webhookUrlForWaha("http://localhost:3000"),
      "http://host.docker.internal:3000/api/webhooks/waha"
    );
  });

  it("keeps a public host", () => {
    assert.equal(
      webhookUrlForWaha("https://atlasnow.co"),
      "https://atlasnow.co/api/webhooks/waha"
    );
  });

  it("prefers the internal compose base when provided", () => {
    assert.equal(
      webhookUrlForWaha("https://atlasnow.co", "http://atlas:3000"),
      "http://atlas:3000/api/webhooks/waha"
    );
  });
});

describe("canonPhone used by pairing", () => {
  it("matches identity 08→62", () => {
    assert.equal(canonPhone("0811-9008-3695"), "6281190083695");
  });
});
