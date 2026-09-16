import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractMapsIdsFromHtml,
  isMapsRpcBlocked,
  markMapsRpcBlocked,
  parseSetCookiePair,
  resetMapsRpcCircuit,
} from "./maps-http";

describe("parseSetCookiePair", () => {
  it("reads name=value before attributes", () => {
    const pair = parseSetCookiePair(
      "NID=534=abc; expires=Wed, 21-Feb-2027 00:00:00 GMT; path=/; domain=.google.com; HttpOnly"
    );
    assert.deepEqual(pair, { name: "NID", value: "534=abc" });
  });

  it("rejects empty names", () => {
    assert.equal(parseSetCookiePair("=nope"), null);
    assert.equal(parseSetCookiePair(""), null);
  });
});

describe("extractMapsIdsFromHtml", () => {
  it("reads feature id and ChIJ place id", () => {
    const html =
      'data=!3m1!4b1!4m6!3m5!1s0x2e69f5a1b2c3d4e5:0xabc123def456!8m2 and place_id":"ChIJdd4hrwug2EcRmSrV3Vo6llI"';
    const ids = extractMapsIdsFromHtml(html);
    assert.equal(ids.featureId, "0x2e69f5a1b2c3d4e5:0xabc123def456");
    assert.equal(ids.placeId, "ChIJdd4hrwug2EcRmSrV3Vo6llI");
  });
});

describe("RPC circuit breaker", () => {
  it("trips and reports blocked", () => {
    resetMapsRpcCircuit();
    assert.equal(isMapsRpcBlocked(), false);
    markMapsRpcBlocked();
    assert.equal(isMapsRpcBlocked(), true);
    resetMapsRpcCircuit();
    assert.equal(isMapsRpcBlocked(), false);
  });
});
