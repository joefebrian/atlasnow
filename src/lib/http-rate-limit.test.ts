import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resetRateLimitBuckets, takeRateToken } from "./http-rate-limit";

describe("takeRateToken", () => {
  it("allows up to the limit then blocks until the window resets", () => {
    resetRateLimitBuckets();
    const t0 = 1_000_000;
    assert.equal(takeRateToken("ip:1", 2, 60_000, t0).ok, true);
    assert.equal(takeRateToken("ip:1", 2, 60_000, t0 + 10).ok, true);
    const blocked = takeRateToken("ip:1", 2, 60_000, t0 + 20);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.ok(blocked.retryAfterSec >= 1);
    assert.equal(takeRateToken("ip:1", 2, 60_000, t0 + 60_000).ok, true);
  });

  it("isolates keys", () => {
    resetRateLimitBuckets();
    const t0 = 2_000_000;
    assert.equal(takeRateToken("a", 1, 60_000, t0).ok, true);
    assert.equal(takeRateToken("a", 1, 60_000, t0).ok, false);
    assert.equal(takeRateToken("b", 1, 60_000, t0).ok, true);
  });
});
