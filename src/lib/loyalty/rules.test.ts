import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  currentCardStamps,
  birthdayWaAllowed,
  formatStampMenuReply,
  formatStampStatusReply,
  isStampMenuQuery,
  isStampStatusQuery,
  inBirthdayWindow,
  isConfirmedOutletSender,
  lastCardResetAt,
  memberLifecycle,
  monthPeriodKey,
  normalizeSpenderTiers,
  normalizeStampTiers,
  receiptAllowed,
  redeemAllowed,
  spenderRewardForRank,
  spenderTopN,
  staffPhoneBlocked,
  stampCardGoal,
  stampMeetsMin,
  stampTierStates,
} from "./rules";

describe("stampMeetsMin", () => {
  it("passes any amount when min is 0", () => {
    assert.equal(stampMeetsMin(null, 0), true);
    assert.equal(stampMeetsMin(1000, 0), true);
  });
  it("requires amount when min is set", () => {
    assert.equal(stampMeetsMin(24000, 25000), false);
    assert.equal(stampMeetsMin(25000, 25000), true);
  });
});

describe("currentCardStamps", () => {
  const t = (iso: string) => new Date(iso);
  it("counts stamps after last redeem only", () => {
    const r = currentCardStamps({
      stamps: [
        { stampedAt: t("2026-01-01T00:00:00Z") },
        { stampedAt: t("2026-06-01T00:00:00Z") },
        { stampedAt: t("2026-07-01T00:00:00Z") },
      ],
      lastStampRedeemAt: t("2026-05-01T00:00:00Z"),
      expiry: "lifetime",
    });
    assert.equal(r.stamps.length, 2);
    assert.equal(r.expired, false);
  });
  it("expires a card 1 year after first stamp", () => {
    const r = currentCardStamps({
      stamps: [{ stampedAt: t("2024-01-01T00:00:00Z") }],
      lastStampRedeemAt: null,
      expiry: "years_1",
      now: t("2026-01-02T00:00:00Z"),
    });
    assert.equal(r.expired, true);
    assert.equal(r.stamps.length, 0);
  });
});

describe("isConfirmedOutletSender", () => {
  it("only allows the registered confirmed outlet WA", () => {
    assert.equal(
      isConfirmedOutletSender({
        senderPhone: "085863666290",
        waOutletPhone: "6285863666290",
        waOutletConfirmed: true,
      }),
      true
    );
    assert.equal(
      isConfirmedOutletSender({
        senderPhone: "085863666290",
        waOutletPhone: "6285863666290",
        waOutletConfirmed: false,
      }),
      false
    );
  });
});

describe("staffPhoneBlocked", () => {
  it("blocks member phone matching staff", () => {
    assert.equal(staffPhoneBlocked("0812-3456-7890", ["6281234567890"]), true);
    assert.equal(staffPhoneBlocked("08129990000", ["6281234567890"]), false);
  });
});

describe("monthPeriodKey", () => {
  it("formats year-month in Jakarta", () => {
    assert.match(monthPeriodKey(new Date("2026-08-01T17:00:00Z")), /^\d{4}-\d{2}$/);
  });
});

describe("normalizeStampTiers", () => {
  it("falls back to a single goal+reward when json is empty", () => {
    assert.deepEqual(normalizeStampTiers("[]", { goal: 10, reward: "Gratis es kopi" }), [
      { stamps: 10, reward: "Gratis es kopi" },
    ]);
  });
  it("sorts rows, drops junk, and keeps the last reward per stamp count", () => {
    const rows = normalizeStampTiers([
      { stamps: 10, reward: "Tumbler" },
      { stamps: 5, reward: "Es kopi" },
      { stamps: 5, reward: "Es kopi susu" },
      { stamps: 0, reward: "nope" },
      { stamps: 3 },
    ]);
    assert.deepEqual(rows, [
      { stamps: 3, reward: "" },
      { stamps: 5, reward: "Es kopi susu" },
      { stamps: 10, reward: "Tumbler" },
    ]);
  });
  it("parses a JSON string from the database", () => {
    const rows = normalizeStampTiers('[{"stamps":5,"reward":"A"},{"stamps":10,"reward":"B"}]');
    assert.equal(stampCardGoal(rows), 10);
    assert.equal(rows[0].stamps, 5);
  });
});

describe("stampTierStates option A", () => {
  const tiers = [
    { stamps: 5, reward: "Es kopi" },
    { stamps: 10, reward: "Tumbler" },
  ];
  it("lets 7 stamps redeem the 5-stamp gift and keep collecting", () => {
    const states = stampTierStates({ count: 7, tiers, claimedKeys: [] });
    assert.equal(states[0].canRedeem, true);
    assert.equal(states[1].canRedeem, false);
    assert.equal(states[1].isHighest, true);
  });
  it("lets 10 stamps redeem both unclaimed gifts", () => {
    const states = stampTierStates({ count: 10, tiers, claimedKeys: [] });
    assert.equal(states.every((s) => s.canRedeem), true);
  });
  it("keeps the 10-stamp gift after the 5-stamp gift is claimed", () => {
    const states = stampTierStates({ count: 10, tiers, claimedKeys: ["5"] });
    assert.equal(states[0].claimed, true);
    assert.equal(states[0].canRedeem, false);
    assert.equal(states[1].canRedeem, true);
  });
});

describe("lastCardResetAt", () => {
  it("ignores mid-tier claims so the card does not empty", () => {
    const reset = lastCardResetAt([
      { redeemedAt: new Date("2026-08-01T00:00:00Z"), resetsCard: false },
      { redeemedAt: new Date("2026-08-10T00:00:00Z"), resetsCard: true },
    ]);
    assert.equal(reset?.toISOString(), "2026-08-10T00:00:00.000Z");
  });
  it("returns null when only mid-tier gifts were claimed", () => {
    assert.equal(lastCardResetAt([{ redeemedAt: new Date("2026-08-01T00:00:00Z"), resetsCard: false }]), null);
  });
});

describe("normalizeSpenderTiers", () => {
  it("falls back to top N as juara 1..N with the same reward", () => {
    assert.deepEqual(normalizeSpenderTiers("[]", { topN: 2, reward: "Voucher" }), [
      { rank: 1, reward: "Voucher" },
      { rank: 2, reward: "Voucher" },
    ]);
  });
  it("maps each place to its own reward", () => {
    const rows = normalizeSpenderTiers([
      { rank: 2, reward: "100rb" },
      { rank: 1, reward: "200rb" },
    ]);
    assert.equal(spenderTopN(rows), 2);
    assert.equal(spenderRewardForRank(1, rows), "200rb");
    assert.equal(spenderRewardForRank(2, rows), "100rb");
    assert.equal(spenderRewardForRank(3, rows), null);
  });
});

describe("formatStampStatusReply", () => {
  it("lists every unclaimed gift that is already reached", () => {
    const text = formatStampStatusReply({
      enabled: true,
      expired: false,
      count: 10,
      goal: 10,
      minAmount: 0,
      tiers: stampTierStates({
        count: 10,
        tiers: [
          { stamps: 5, reward: "Es kopi" },
          { stamps: 10, reward: "Tumbler" },
        ],
        claimedKeys: [],
      }),
    });
    assert.match(text, /10\/10/);
    assert.match(text, /Es kopi/);
    assert.match(text, /Tumbler/);
    assert.match(text, /ketik nomor HP/);
  });

  it("uses the brand stampOff copy when the program is off", () => {
    const text = formatStampStatusReply(
      {
        enabled: false,
        expired: false,
        count: 0,
        goal: 10,
        minAmount: 0,
        tiers: [],
      },
      { stampOff: "Stamp P2P belum buka. Tulis ke kasir ya." }
    );
    assert.equal(text, "Stamp P2P belum buka. Tulis ke kasir ya.");
  });
});

describe("isStampStatusQuery", () => {
  it("matches HQ card phrases only", () => {
    assert.equal(isStampStatusQuery("Status Stamp"), true);
    assert.equal(isStampStatusQuery("cek stamp"), true);
    assert.equal(isStampStatusQuery("kartu stamp"), true);
    assert.equal(isStampStatusQuery("stamp"), false);
    assert.equal(isStampStatusQuery("halo"), false);
    assert.equal(isStampStatusQuery("status spender"), false);
  });
});

describe("isStampMenuQuery", () => {
  it("matches bare Stamp as the program menu", () => {
    assert.equal(isStampMenuQuery("Stamp"), true);
    assert.equal(isStampMenuQuery("info stamp"), true);
    assert.equal(isStampMenuQuery("Status Stamp"), false);
  });
});

describe("formatStampMenuReply", () => {
  it("lists program points and includes stampOff copy", () => {
    const text = formatStampMenuReply({
      stampOff: "Buat 1 transaksi min Rp 200.000 dapat 1 stamp.",
    });
    assert.match(text, /Status Stamp/);
    assert.match(text, /200\.000/);
  });
});

describe("memberLifecycle", () => {
  it("is none until they register", () => {
    assert.equal(memberLifecycle({ registered: false, qualifyingApprovedCount: 0 }), "none");
    assert.equal(memberLifecycle({ registered: false, qualifyingApprovedCount: 3 }), "none");
  });
  it("is calon after the form, before a qualifying receipt", () => {
    assert.equal(memberLifecycle({ registered: true, qualifyingApprovedCount: 0 }), "calon");
  });
  it("is aktif after the first qualifying approved receipt", () => {
    assert.equal(memberLifecycle({ registered: true, qualifyingApprovedCount: 1 }), "aktif");
  });
});

describe("membership gates", () => {
  it("blocks receipts until they have registered", () => {
    assert.equal(receiptAllowed("none"), false);
    assert.equal(receiptAllowed("calon"), true);
    assert.equal(receiptAllowed("aktif"), true);
  });
  it("blocks redeem and birthday WA until aktif", () => {
    assert.equal(redeemAllowed("calon"), false);
    assert.equal(redeemAllowed("aktif"), true);
    assert.equal(birthdayWaAllowed("aktif", false), false);
    assert.equal(birthdayWaAllowed("calon", true), false);
    assert.equal(birthdayWaAllowed("aktif", true), true);
  });
});

describe("inBirthdayWindow", () => {
  it("opens two days before the birthday", () => {
    assert.equal(
      inBirthdayWindow({ month: 9, day: 12, now: new Date("2026-09-10T00:00:00+07:00") }),
      true
    );
    assert.equal(
      inBirthdayWindow({ month: 9, day: 12, now: new Date("2026-09-09T00:00:00+07:00") }),
      false
    );
  });
});
