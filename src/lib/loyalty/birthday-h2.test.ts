import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BIRTHDAY_TEMPLATE_BODY_ID,
  daysUntilNextBirthday,
  fillBirthdayTemplateBody,
  firstNameOf,
  inBirthdayH2SendWindow,
  isWaOptInResumeMessage,
  isWaOptOutMessage,
  makeBirthdayVoucherCode,
  pickBirthdayGreeting,
  voucherCodesMatch,
} from "./birthday-h2";

describe("daysUntilNextBirthday", () => {
  const tz = "Asia/Jakarta";
  it("is 2 on H-2", () => {
    assert.equal(
      daysUntilNextBirthday({ month: 9, day: 12, now: new Date("2026-09-10T00:30:00+07:00"), timeZone: tz }),
      2
    );
  });
  it("is 0 on the birthday", () => {
    assert.equal(
      daysUntilNextBirthday({ month: 9, day: 12, now: new Date("2026-09-12T18:00:00+07:00"), timeZone: tz }),
      0
    );
  });
  it("is 3 the day before the send window", () => {
    assert.equal(
      daysUntilNextBirthday({ month: 9, day: 12, now: new Date("2026-09-09T12:00:00+07:00"), timeZone: tz }),
      3
    );
  });
  it("wraps to next year after the birthday", () => {
    const d = daysUntilNextBirthday({
      month: 9,
      day: 12,
      now: new Date("2026-09-13T00:00:00+07:00"),
      timeZone: tz,
    });
    assert.equal(d > 300, true);
  });
});

describe("inBirthdayH2SendWindow", () => {
  it("allows H-2, H-1, and the day", () => {
    assert.equal(inBirthdayH2SendWindow(2), true);
    assert.equal(inBirthdayH2SendWindow(1), true);
    assert.equal(inBirthdayH2SendWindow(0), true);
  });
  it("blocks H-3 and the day after", () => {
    assert.equal(inBirthdayH2SendWindow(3), false);
    assert.equal(inBirthdayH2SendWindow(-1), false);
  });
});

describe("fillBirthdayTemplateBody named", () => {
  const bag = {
    customerName: "Yusuf Febrian Hanjaya",
    voucherNumber: "100.000",
    codeVoucher: "BDY26-K7M2",
  };
  it("fills the Meta named variables", () => {
    const r = fillBirthdayTemplateBody(BIRTHDAY_TEMPLATE_BODY_ID, bag);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.named, [
      { name: "customer_name", text: "Yusuf Febrian Hanjaya" },
      { name: "voucher_number", text: "100.000" },
      { name: "code_voucher", text: "BDY26-K7M2" },
    ]);
  });
  it("refuses when Reward text is empty", () => {
    assert.equal(fillBirthdayTemplateBody(BIRTHDAY_TEMPLATE_BODY_ID, { ...bag, voucherNumber: "" }).ok, false);
  });
});

describe("fillBirthdayTemplateBody positional", () => {
  it("maps {{1}} name, {{2}} voucher, {{3}} code", () => {
    const r = fillBirthdayTemplateBody("Halo {{1}}, voucher {{2}} kode {{3}}", {
      customerName: "Dennies",
      voucherNumber: "100.000",
      codeVoucher: "BDY26-AAAA",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.positional, ["Dennies", "100.000", "BDY26-AAAA"]);
  });
});

describe("makeBirthdayVoucherCode", () => {
  it("uses BDY + year + 4 chars by default", () => {
    assert.match(makeBirthdayVoucherCode("2026"), /^BDY26-[A-Z2-9]{4}$/);
  });
  it("uses HQ prefix without year when asked", () => {
    assert.match(
      makeBirthdayVoucherCode("2026", { prefix: "p2p!", includeYear: false, suffixLen: 3 }),
      /^P2P-[A-Z2-9]{3}$/
    );
  });
});

describe("voucherCodesMatch", () => {
  it("ignores case, spaces, and hyphens", () => {
    assert.equal(voucherCodesMatch("BDY26-K7M2", "bdy26 k7m2"), true);
    assert.equal(voucherCodesMatch("BDY26-K7M2", "BDY26-XXXX"), false);
  });
});

describe("STOP / MULAI", () => {
  it("reads STOP variants", () => {
    assert.equal(isWaOptOutMessage("STOP"), true);
    assert.equal(isWaOptOutMessage(" berhenti. "), true);
    assert.equal(isWaOptOutMessage("please stop blasting"), false);
  });
  it("reads MULAI / START", () => {
    assert.equal(isWaOptInResumeMessage("MULAI"), true);
    assert.equal(isWaOptInResumeMessage("start"), true);
    assert.equal(isWaOptInResumeMessage("mulai lagi dong"), false);
  });
});

describe("firstNameOf", () => {
  it("takes the first word", () => {
    assert.equal(firstNameOf("Yusuf Febrian"), "Yusuf");
  });
});

describe("pickBirthdayGreeting", () => {
  it("prefers an approved Indonesian template", () => {
    const row = pickBirthdayGreeting([
      { name: "birthday_greeting", status: "REJECTED", language: "id" },
      { name: "birthday_greeting", status: "APPROVED", language: "en_US" },
      { name: "birthday_greeting", status: "APPROVED", language: "id" },
      { name: "hello_world", status: "APPROVED", language: "id" },
    ]);
    assert.equal(row?.language, "id");
    assert.equal(row?.status, "APPROVED");
  });
});
