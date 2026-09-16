import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATLAS_PRICE_IDR,
  extraIncrementIdr,
  formatIdr,
  planTotalIdr,
  pricingCopy,
} from "./pricing";

describe("pricing copy", () => {
  it("prints public rupiah on Silver, Gold, Platinum — Diamond is talk to us", () => {
    assert.equal(ATLAS_PRICE_IDR.silverMonthly, 500_000);
    assert.equal(ATLAS_PRICE_IDR.goldMonthly, 2_000_000);
    assert.equal(ATLAS_PRICE_IDR.platinumMonthly, 8_000_000);
    assert.equal(ATLAS_PRICE_IDR.extraOutletMonthly, 150_000);
    const en = pricingCopy("en");
    const byId = Object.fromEntries(en.plans.map((p) => [p.id, p]));
    assert.equal(en.plans.map((p) => p.id).join(","), "free,silver,gold,platinum,diamond");
    assert.equal(byId.free.price, "Free");
    assert.match(byId.silver.price, /500/);
    assert.match(byId.gold.price, /2/);
    assert.match(byId.platinum.price, /8/);
    assert.match(byId.diamond.price, /Talk to us/i);
    assert.equal(byId.gold.featured, true);
    assert.equal(byId.free.featured, false);
  });

  it("leads with a free plan that does not sell APIs", () => {
    const en = pricingCopy("en");
    const id = pricingCopy("id");
    assert.equal(en.plans[0].price, "Free");
    assert.equal(id.plans[0].price, "Gratis");
    assert.doesNotMatch(JSON.stringify(en.plans[0]), /Use the desk first/i);
    assert.doesNotMatch(JSON.stringify(id.plans[0]), /Pakai mejanya dulu/i);
    assert.match(en.plans[0].without.join(" "), /WhatsApp/);
    assert.match(en.plans[0].points.join(" "), /photos the receipt/i);
    assert.doesNotMatch(en.plans[0].points.join(" "), /HQ WhatsApp|Google listings|TikTok GO live/i);
    assert.match(en.honest, /do not invent visits, leads, or revenue/);
  });

  it("uses brand in English, merek in Indonesian — not merk, not Agency", () => {
    const en = pricingCopy("en");
    const id = pricingCopy("id");
    const enBlob = JSON.stringify(en);
    const idBlob = JSON.stringify(id);
    assert.doesNotMatch(enBlob, /agency/i);
    assert.doesNotMatch(idBlob, /agency/i);
    assert.doesNotMatch(idBlob, /merk/i);
    assert.match(idBlob, /merek/);
    assert.equal(id.plans[4].title, "Diamond");
    assert.match(id.plans[4].points.join(" "), /Grup/);
  });

  it("formats rupiah and extra-outlet math", () => {
    assert.match(formatIdr(1_500_000), /^Rp 1[.,]500[.,]000$/);
    assert.equal(extraIncrementIdr(0), 0);
    assert.equal(extraIncrementIdr(3), 450_000);
    assert.equal(planTotalIdr("free", 3), 0);
    assert.equal(planTotalIdr("silver", 3), 950_000);
    assert.equal(planTotalIdr("gold", 3), 2_450_000);
    assert.equal(planTotalIdr("platinum", 3), 8_450_000);
    assert.equal(planTotalIdr("diamond", 3), null);
  });

  it("does not sell native TikTok inbox or Meta Business Agent as live", () => {
    const en = pricingCopy("en");
    const blob = JSON.stringify(en);
    assert.match(blob, /not a stamp/i);
    assert.match(blob, /Meta Business Agent/);
    assert.match(en.extra[1].body, /native TikTok/);
    assert.equal(en.plans.find((p) => p.id === "gold")?.usesStepper, true);
    assert.equal(en.plans.find((p) => p.id === "free")?.usesStepper, false);
  });

  it("states no cash refund — finish the paid period, 30-day notice", () => {
    const en = pricingCopy("en");
    const id = pricingCopy("id");
    assert.match(en.cancelTitle, /Cancel and refunds/i);
    assert.match(en.cancelLede, /do not pay that money back/i);
    const enBlob = en.cancel.map((c) => c.body).join(" ");
    assert.match(enBlob, /30 days/i);
    assert.match(enBlob, /not refunded/i);
    assert.match(enBlob, /credits are not paid out in cash/i);
    assert.match(enBlob, /90-day pilot/i);
    assert.equal(en.cancelTermsHref, "/terms#fees-cancellation-refunds");
    assert.match(id.cancelTitle, /Batal dan refund/i);
    assert.match(id.cancel.map((c) => c.body).join(" "), /tidak dikembalikan/);
    assert.match(id.cancel.map((c) => c.body).join(" "), /Workspace/);
  });

  it("gives Silver one Cloud HQ number and blast, not branch WAHA", () => {
    const en = pricingCopy("en");
    const silver = en.plans.find((p) => p.id === "silver")!;
    const blob = silver.points.join(" ") + silver.without.join(" ");
    assert.match(blob, /official WhatsApp Business number/i);
    assert.match(blob, /blast/i);
    assert.match(blob, /Not a store QR/i);
    assert.match(silver.without.join(" "), /WAHA/);
    assert.doesNotMatch(silver.sub, /Still no Cloud/i);
    const hq = en.compare.find((r) => /HQ WhatsApp/i.test(r.feature));
    assert.equal(hq?.silver, "1 number");
    const blast = en.compare.find((r) => /blast/i.test(r.feature));
    assert.equal(blast?.silver, "credit");
  });
});
