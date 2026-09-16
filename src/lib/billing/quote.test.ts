import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BILLING_SELLER, DEFAULT_BILLING_BANK, sellerLine } from "./seller";
import { invoiceQuote } from "./quote";

describe("AtlasNow invoice quote", () => {
  it("uses PT Sorak Digital Media and does not charge PPN", () => {
    assert.equal(BILLING_SELLER.legalName, "PT Sorak Digital Media");
    assert.equal(BILLING_SELLER.tradeName, "P2P Labs");
    assert.equal(BILLING_SELLER.chargePpn, false);
    assert.match(sellerLine(), /PT Sorak Digital Media \(P2P Labs\)/);
    assert.equal(DEFAULT_BILLING_BANK.bankName, "BCA");
    assert.equal(DEFAULT_BILLING_BANK.accountNumber, "2480707501");
    assert.match(DEFAULT_BILLING_BANK.accountName, /PT Sorak Digital Media/);
  });

  it("matches public Gold + 3 extra = Rp 2.450.000 with no PPN", () => {
    const q = invoiceQuote("gold", 3);
    assert.equal(q.baseIdr, 2_000_000);
    assert.equal(q.extraIdr, 450_000);
    assert.equal(q.subtotalIdr, 2_450_000);
    assert.equal(q.vat.active, false);
    assert.equal(q.vat.amountIdr, 0);
    assert.equal(q.totalIdr, 2_450_000);
    assert.equal(q.includedOutlets, 5);
  });

  it("does not add extra outlets on Diamond — quoted amount only", () => {
    const q = invoiceQuote("diamond", 9, 12_000_000);
    assert.equal(q.extraCount, 0);
    assert.equal(q.extraIdr, 0);
    assert.equal(q.totalIdr, 12_000_000);
    assert.equal(q.vat.amountIdr, 0);
  });

  it("adds Indonesian PPN 11% when VAT is on — including SG company clients", () => {
    const q = invoiceQuote("gold", 0, 0, { active: true });
    assert.equal(q.subtotalIdr, 2_000_000);
    assert.equal(q.vat.amountIdr, 220_000);
    assert.equal(q.totalIdr, 2_220_000);
    assert.match(q.vat.label, /PPN 11%/);
    assert.doesNotMatch(q.vat.label, /GST/);
  });

  it("Platinum 15 included, extra 0 is 8 jt", () => {
    const q = invoiceQuote("platinum", 0);
    assert.equal(q.includedOutlets, 15);
    assert.equal(q.totalIdr, 8_000_000);
  });
});
