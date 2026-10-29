import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  merchantHandoffMessage,
  resolvePaymentPlan,
  savablePaymentMode,
  validateMerchantPaymentUrl,
} from "@/lib/yola/merchant-link";

describe("yola merchant payment link", () => {
  it("keeps a public https url unchanged and adds no customer data", () => {
    const stored = "https://pay.example.com/yola?ref=sku1";
    const checked = validateMerchantPaymentUrl(stored);
    assert.equal(checked.ok, true);
    if (!checked.ok) return;
    assert.equal(checked.url, stored);
    assert.equal(checked.url.includes("6285697210806"), false);
    assert.equal(checked.url.includes("buyer"), false);
  });

  it("rejects unsafe payment destinations", () => {
    const reason = (raw: string) => {
      const checked = validateMerchantPaymentUrl(raw);
      return checked.ok ? "ok" : checked.reason;
    };
    assert.equal(reason(""), "empty");
    assert.equal(reason("http://pay.example.com/yola"), "not_https");
    assert.equal(reason("https://user:secret@pay.example.com/yola"), "credentials");
    assert.equal(reason("https://pay.example.com:8443/yola"), "port");
    assert.equal(reason("https://localhost/yola"), "destination");
    assert.equal(reason("https://127.0.0.1/yola"), "destination");
    assert.equal(reason("https://10.1.1.1/yola"), "destination");
    assert.equal(reason("https://192.168.1.8/yola"), "destination");
    assert.equal(reason("https://169.254.169.254/latest"), "destination");
    assert.equal(reason("https://2130706433/"), "destination");
    assert.equal(reason("https://[::ffff:127.0.0.1]/yola"), "destination");
    assert.equal(reason("https://[::ffff:10.1.1.1]/yola"), "destination");
    assert.equal(reason("https://[::1]/"), "destination");
    assert.equal(reason("https://atlasnow.co/pay/yola/token"), "destination");
    assert.equal(reason("javascript:alert(1)"), "not_https");
  });

  it("uses demo checkout unless a valid merchant url is saved", () => {
    assert.deepEqual(resolvePaymentPlan(null), { kind: "demo" });
    assert.deepEqual(resolvePaymentPlan({ mode: "DEMO_CHECKOUT", merchantUrl: "" }), { kind: "demo" });
    assert.deepEqual(resolvePaymentPlan({ mode: "MERCHANT_GATEWAY_WEBHOOK", merchantUrl: "https://pay.example.com/yola" }), { kind: "demo" });
    assert.deepEqual(resolvePaymentPlan({ mode: "ATLASNOW_GATEWAY", merchantUrl: "" }), { kind: "demo" });
    assert.deepEqual(resolvePaymentPlan({ mode: "MERCHANT_EXTERNAL_LINK", merchantUrl: "http://pay.example.com" }), { kind: "demo" });
    assert.deepEqual(resolvePaymentPlan({ mode: "MERCHANT_EXTERNAL_LINK", merchantUrl: "https://pay.example.com/yola" }), {
      kind: "merchant",
      url: "https://pay.example.com/yola",
    });
    assert.equal(savablePaymentMode("DEMO_CHECKOUT"), true);
    assert.equal(savablePaymentMode("MERCHANT_EXTERNAL_LINK"), true);
    assert.equal(savablePaymentMode("MERCHANT_GATEWAY_WEBHOOK"), false);
    assert.equal(savablePaymentMode("ATLASNOW_GATEWAY"), false);
  });

  it("sends the atlasnow handoff url and not the buyer phone", () => {
    const body = merchantHandoffMessage({
      orderId: "YOLA-20261029-000009",
      url: "https://atlasnow.co/pay/yola/abcDEF123_token-value",
    });
    assert.match(body, /https:\/\/atlasnow\.co\/pay\/yola\/abcDEF123_token-value/);
    assert.equal(body.includes("pay.example.com"), false);
    assert.equal(body.includes("+62"), false);
    assert.match(body, /belum membuktikan pembayaran/);
    assert.match(body, /tidak mencatat pembayaran otomatis/);
    assert.match(body, /Tiket belum diterbitkan/);
  });
});
