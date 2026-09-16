import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { citiesForProvince, isValidIdDomicile, phoneLooksIndonesia } from "./indonesia";

describe("indonesia domicile", () => {
  it("treats 62 and 08 as Indonesia", () => {
    assert.equal(phoneLooksIndonesia("085697210806"), true);
    assert.equal(phoneLooksIndonesia("+62 858-6366-6290"), true);
    assert.equal(phoneLooksIndonesia("6285863666290"), true);
    assert.equal(phoneLooksIndonesia("14155550123"), false);
  });

  it("accepts a city only inside its province", () => {
    assert.equal(isValidIdDomicile("DKI Jakarta", "Jakarta Selatan"), true);
    assert.equal(isValidIdDomicile("Jawa Barat", "Kota Bandung"), true);
    assert.equal(isValidIdDomicile("DKI Jakarta", "Kota Bandung"), false);
    assert.ok(citiesForProvince("Bali").includes("Kab. Badung"));
  });
});
