import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EarnExclusiveError,
  assertEarnExclusive,
  countEarnPrograms,
  earnExclusiveMessage,
} from "./earn-exclusive";

describe("countEarnPrograms", () => {
  it("counts only stamp, points, and top spender", () => {
    assert.equal(countEarnPrograms({}), 0);
    assert.equal(countEarnPrograms({ stampEnabled: true }), 1);
    assert.equal(countEarnPrograms({ stampEnabled: true, pointEnabled: true }), 2);
    assert.equal(
      countEarnPrograms({ stampEnabled: true, pointEnabled: true, spenderEnabled: true }),
      3
    );
  });
});

describe("assertEarnExclusive", () => {
  it("allows none or one earn program", () => {
    assertEarnExclusive({});
    assertEarnExclusive({ stampEnabled: true });
    assertEarnExclusive({ pointEnabled: true });
    assertEarnExclusive({ spenderEnabled: true });
  });

  it("allows birthday beside one earn program", () => {
    assertEarnExclusive({ stampEnabled: true, pointEnabled: false, spenderEnabled: false });
  });

  it("rejects two earn programs", () => {
    assert.throws(
      () => assertEarnExclusive({ stampEnabled: true, spenderEnabled: true }),
      (e: unknown) => e instanceof EarnExclusiveError && e.code === "earn_exclusive"
    );
  });
});

describe("earnExclusiveMessage", () => {
  it("keeps EN and ID copy", () => {
    assert.match(earnExclusiveMessage("en"), /Birthday can stay on/);
    assert.match(earnExclusiveMessage("id"), /Ultah boleh tetap nyala/);
  });
});
