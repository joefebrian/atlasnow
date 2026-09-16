import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveWaReceiptActor } from "./wa-receipt";

const stores = [
  { id: "kemang", phone: "021111", waOutletPhone: "628111000222" },
  { id: "barito", phone: null, waOutletPhone: "628111000333" },
];

describe("resolveWaReceiptActor", () => {
  it("treats a member (not staff) as guest upload", () => {
    const r = resolveWaReceiptActor({
      senderPhone: "081234567890",
      caption: "TRX-1 Rp 20000",
      stores,
      member: { phone: "6281234567890", signupLocationId: "barito" },
    });
    assert.equal(r.kind, "member");
    if (r.kind === "member") {
      assert.equal(r.locationId, "barito");
      assert.equal(r.phone, "6281234567890");
    }
  });

  it("treats outlet WA as kasir and reads member HP from caption", () => {
    const r = resolveWaReceiptActor({
      senderPhone: "08111000222",
      caption: "081234567890 TRX-9901 Rp 28000",
      stores,
      member: null,
    });
    assert.equal(r.kind, "staff");
    if (r.kind === "staff") {
      assert.equal(r.locationId, "kemang");
      assert.equal(r.memberPhone, "6281234567890");
    }
  });

  it("unknown sender is not a stamp", () => {
    const r = resolveWaReceiptActor({
      senderPhone: "081200000000",
      caption: "",
      stores,
      member: null,
    });
    assert.equal(r.kind, "unknown");
  });
});
