import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_ATLAS_FEES,
  estimateBroadcast,
  INDONESIA,
  MARKET_RATES,
  metaRateIdr,
  RATE_CARD_EFFECTIVE,
  SERVICE_FREE_PER_PHONE_PER_MONTH,
} from "./rates";

describe("Oct 1 2026 WhatsApp rate card", () => {
  it("uses the October card and Indonesia list rates unchanged vs July", () => {
    assert.equal(RATE_CARD_EFFECTIVE, "1 October 2026");
    assert.equal(INDONESIA.marketing, 586.33);
    assert.equal(INDONESIA.utility, 356.65);
    assert.equal(INDONESIA.authentication, 356.65);
    assert.equal(INDONESIA.authInternational, 1940.13);
    assert.equal(INDONESIA.service, 356.65);
    assert.equal(SERVICE_FREE_PER_PHONE_PER_MONTH, 1000);
  });

  it("sets service equal to utility on every market", () => {
    for (const row of MARKET_RATES) {
      assert.equal(row.service, row.utility, row.market);
    }
  });

  it("bills session notes at the service rate, even inside the 24h window", () => {
    assert.equal(metaRateIdr("session"), 356.65);
    const est = estimateBroadcast({ kind: "session", count: 10, insideWindow: true });
    assert.equal(est.windowFree, false);
    assert.equal(est.metaEach, 356.65);
    assert.equal(est.metaSubtotal, 3566.5);
    assert.equal(est.atlasEach, DEFAULT_ATLAS_FEES.session);
  });

  it("still zeros Meta on the click-to-WhatsApp entry-point window", () => {
    const est = estimateBroadcast({ kind: "session", count: 3, insideEntryPoint: true });
    assert.equal(est.windowFree, true);
    assert.equal(est.metaEach, 0);
    assert.equal(est.metaSubtotal, 0);
  });

  it("bills utility templates inside the 24h window", () => {
    const est = estimateBroadcast({ kind: "utility", count: 1, insideWindow: true });
    assert.equal(est.metaEach, 356.65);
  });

  it("records the published marketing / utility deltas vs July", () => {
    const mexico = MARKET_RATES.find((m) => m.market === "Mexico")!;
    const saudi = MARKET_RATES.find((m) => m.market === "Saudi Arabia")!;
    const uae = MARKET_RATES.find((m) => m.market === "United Arab Emirates")!;
    const pakistan = MARKET_RATES.find((m) => m.market === "Pakistan")!;
    const peru = MARKET_RATES.find((m) => m.market === "Peru")!;
    const za = MARKET_RATES.find((m) => m.market === "South Africa")!;
    assert.equal(mexico.marketing, 565.94);
    assert.equal(saudi.marketing, 820.08);
    assert.equal(uae.marketing, 820.08);
    assert.equal(pakistan.utility, 214.17);
    assert.equal(peru.utility, 428.25);
    assert.equal(za.utility, 135.8);
    assert.ok(MARKET_RATES.some((m) => m.market === "Bangladesh"));
    assert.ok(MARKET_RATES.some((m) => m.market === "Ukraine"));
    assert.ok(MARKET_RATES.some((m) => m.market === "Rest of Asia Pacific"));
  });
});
