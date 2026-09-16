import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  freeOutletCapReached,
  freeStoreOutletCap,
  isFreePlan,
  isLocationCapError,
  LocationCapError,
} from "./plan";

describe("Free outlet cap", () => {
  it("treats missing plan as Free", () => {
    assert.equal(isFreePlan(null), true);
    assert.equal(isFreePlan(""), true);
    assert.equal(isFreePlan("free"), true);
    assert.equal(isFreePlan("gold"), false);
  });

  it("stops at 2 store outlets on Free only", () => {
    assert.equal(freeStoreOutletCap(), 2);
    assert.equal(freeOutletCapReached("free", 1), false);
    assert.equal(freeOutletCapReached("free", 2), true);
    assert.equal(freeOutletCapReached(null, 2), true);
    assert.equal(freeOutletCapReached("", 2), true);
    assert.equal(freeOutletCapReached("silver", 5), false);
    assert.equal(freeOutletCapReached("gold", 2), false);
  });

  it("tags LocationCapError", () => {
    const e = new LocationCapError();
    assert.equal(isLocationCapError(e), true);
    assert.match(e.message, /2 outlets/);
  });
});
