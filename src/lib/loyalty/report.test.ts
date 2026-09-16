import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMonthLabel, monthBounds, parseMonthKey, shiftMonthKey } from "./rules";
import { shortMemberLabel, summarizeLoyaltyMonth } from "./report-summary";

describe("monthBounds", () => {
  it("uses Jakarta midnight, not UTC", () => {
    const { start, endExclusive } = monthBounds("2026-08", "Asia/Jakarta");
    assert.equal(start.toISOString(), "2026-07-31T17:00:00.000Z");
    assert.equal(endExclusive.toISOString(), "2026-08-31T17:00:00.000Z");
  });
});

describe("month key helpers", () => {
  it("parses YYYY-MM and rejects junk", () => {
    assert.equal(parseMonthKey("2026-08", "2026-01"), "2026-08");
    assert.equal(parseMonthKey("2026-13", "2026-01"), "2026-01");
    assert.equal(parseMonthKey("nope", "2026-01"), "2026-01");
  });
  it("shifts across year", () => {
    assert.equal(shiftMonthKey("2026-01", -1), "2025-12");
    assert.equal(shiftMonthKey("2025-12", 1), "2026-01");
  });
  it("labels in English and Indonesian", () => {
    assert.match(formatMonthLabel("2026-08", "en"), /August 2026/);
    assert.match(formatMonthLabel("2026-08", "id"), /Agustus 2026/);
  });
});

describe("summarizeLoyaltyMonth", () => {
  const program = {
    stampEnabled: true,
    spenderEnabled: true,
    birthdayEnabled: true,
    stampGoal: 10,
    stampTiers: [{ stamps: 10, reward: "Tumbler" }],
    spenderTiers: [{ rank: 1, reward: "Voucher 200rb" }],
    spenderMinAmount: 0,
    spenderTopN: 1,
    spenderScope: "BRAND",
    spenderLocationId: null,
  };

  it("maps Cirqle-style cards onto stamps and redemptions, not visits", () => {
    const s = summarizeLoyaltyMonth({
      program,
      joinedThisMonth: 4,
      names: [
        { phone: "628111", name: "Budi" },
        { phone: "628222", name: "Sari" },
      ],
      priorStampPhones: ["628111"],
      redemptionsThisMonth: [
        { memberPhone: "628111", kind: "STAMP_CARD" },
        { memberPhone: "628222", kind: "BIRTHDAY" },
      ],
      stampsThisMonth: [
        { memberPhone: "628111", locationId: "a", locationName: "Kemang", amount: 40000, stampedAt: new Date() },
        { memberPhone: "628111", locationId: "a", locationName: "Kemang", amount: 25000, stampedAt: new Date() },
        { memberPhone: "628222", locationId: "b", locationName: "PIK", amount: 80000, stampedAt: new Date() },
      ],
    });
    assert.equal(s.hero.membersReturned, 1);
    assert.equal(s.hero.uniqueShoppers, 2);
    assert.equal(s.hero.activatedThisMonth, 1);
    assert.equal(s.hero.volume, 3);
    assert.equal(s.hero.volumeKind, "stamps");
    assert.equal(s.hero.rewardsRedeemed, 2);
    assert.equal(s.hero.redemptionByKind.stamp, 1);
    assert.equal(s.hero.redemptionByKind.birthday, 1);
    assert.equal(s.hero.topRegular?.stamps, 2);
    assert.match(s.hero.topRegular?.label || "", /Budi/);
    assert.equal(s.hero.topSpender?.spend, 80000);
    assert.equal(s.outlets[0].stamps, 2);
    assert.equal(s.spenderBoard[0].spend, 80000);
    assert.equal(s.stampBoard[0].stamps, 2);
    assert.match(s.stampBoard[0].label, /Budi/);
    assert.equal(s.stampBoard[1].stamps, 1);
    assert.equal(s.birthdayBoard.length, 1);
    assert.equal(s.birthdayBoard[0].phone, "628222");
  });

  it("calls the volume receipts when the stamp card is off", () => {
    const s = summarizeLoyaltyMonth({
      program: { ...program, stampEnabled: false },
      joinedThisMonth: 0,
      names: [],
      priorStampPhones: [],
      redemptionsThisMonth: [],
      stampsThisMonth: [
        { memberPhone: "628111", locationId: "a", locationName: "Kemang", amount: 10000, stampedAt: new Date() },
      ],
    });
    assert.equal(s.hero.volumeKind, "receipts");
  });
});

describe("shortMemberLabel", () => {
  it("masks the phone", () => {
    assert.equal(shortMemberLabel("Budi", "6281190083695"), "Budi · •••3695");
    assert.equal(shortMemberLabel("", "0812"), "•••0812");
  });
});
