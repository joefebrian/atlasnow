import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractRpAmounts,
  extractTrxCandidates,
  matchReceiptPhoto,
  normalizeTrxId,
  parseIdrInt,
  trxFoundInOcr,
} from "./receipt-ocr";

describe("parseIdrInt", () => {
  it("reads Indonesian thousands", () => {
    assert.equal(parseIdrInt("28.000"), 28000);
    assert.equal(parseIdrInt("28.000,50"), 28000);
    assert.equal(parseIdrInt("28000"), 28000);
  });
});

describe("extractRpAmounts", () => {
  it("picks Rp lines off a thermal slip", () => {
    const amounts = extractRpAmounts("Vilo Gelato\nTRX-9901\nRp 28.000\nTerima kasih");
    assert.ok(amounts.includes(28000));
  });
});

describe("extractTrxCandidates", () => {
  it("keeps TRX ids and drops the Rp amount", () => {
    const toks = extractTrxCandidates("TRX-9901 Rp 28.000");
    assert.ok(toks.some((t) => normalizeTrxId(t) === "TRX9901"));
  });
});

describe("trxFoundInOcr", () => {
  it("ignores dashes and spaces", () => {
    assert.equal(trxFoundInOcr("TRX-9901", "No. TRX 9901 Rp 28000"), true);
    assert.equal(normalizeTrxId("trx-9901"), "TRX9901");
  });
});

describe("matchReceiptPhoto", () => {
  const base = { typedTrx: "TRX-9901", typedAmount: 28000, typedPhone: "081234567890" };

  it("MATCHes when nomor and Rp are on the paper", () => {
    const r = matchReceiptPhoto({
      ...base,
      ocrText: "Barito\nTRX-9901\nRp 28.000\n",
    });
    assert.equal(r.status, "MATCH");
    assert.equal(r.ocrAmount, 28000);
  });

  it("is UNREADABLE when OCR is empty", () => {
    const r = matchReceiptPhoto({ ...base, ocrText: "   " });
    assert.equal(r.status, "UNREADABLE");
  });

  it("is UNREADABLE when the paper has no Rp", () => {
    const r = matchReceiptPhoto({ ...base, ocrText: "TRX-9901 terima kasih" });
    assert.equal(r.status, "UNREADABLE");
  });

  it("is MISMATCH when Rp on the paper is different", () => {
    const r = matchReceiptPhoto({
      ...base,
      ocrText: "TRX-9901 Rp 12.000",
    });
    assert.equal(r.status, "MISMATCH");
    assert.equal(r.ocrAmount, 12000);
  });

  it("is MISMATCH when a different HP is printed", () => {
    const r = matchReceiptPhoto({
      ...base,
      ocrText: "TRX-9901 Rp 28.000 HP 081299999999",
    });
    assert.equal(r.status, "MISMATCH");
  });
});
