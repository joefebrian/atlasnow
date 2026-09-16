import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSignupRequest } from "./signup";

const base = { email: "a@b.co", password: "longenough", acceptTerms: true, phone: "081234567890" };

describe("parseSignupRequest", () => {
  it("requires terms, email, phone, and a strong password for email signup", () => {
    const ok = parseSignupRequest(base);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.value.phone, "6281234567890");
      assert.equal(ok.value.kind, "brand");
      assert.equal(ok.value.wantsGroup, false);
    }
    assert.equal(parseSignupRequest({ ...base, acceptTerms: undefined }).ok, false);
    assert.equal(parseSignupRequest({ ...base, email: "nope" }).ok, false);
    assert.equal(parseSignupRequest({ ...base, password: "short" }).ok, false);
    assert.equal(parseSignupRequest({ ...base, phone: "" }).ok, false);
    assert.equal(parseSignupRequest({ ...base, phone: "0812" }).ok, false);
  });

  it("allows oauth signup without a password but still needs phone", () => {
    const r = parseSignupRequest({
      email: "ada@example.com",
      acceptTerms: true,
      method: "google",
      phone: "+62 812 3456 7890",
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.method, "google");
      assert.equal(r.value.phone, "6281234567890");
    }
    assert.equal(
      parseSignupRequest({ email: "ada@example.com", acceptTerms: true, method: "google" }).ok,
      false
    );
  });

  it("always opens one brand — agency kind is ignored; wantsGroup is a follow-up note", () => {
    const agency = parseSignupRequest({ ...base, kind: "agency" });
    assert.equal(agency.ok, true);
    if (agency.ok) {
      assert.equal(agency.value.kind, "brand");
      assert.equal(agency.value.wantsGroup, false);
    }
    const group = parseSignupRequest({ ...base, wantsGroup: true });
    assert.equal(group.ok, true);
    if (group.ok) {
      assert.equal(group.value.kind, "brand");
      assert.equal(group.value.wantsGroup, true);
    }
  });

  it("rejects a pre-checked-looking payload when acceptTerms is not true", () => {
    assert.equal(parseSignupRequest({ ...base, acceptTerms: "true" }).ok, false);
    assert.equal(parseSignupRequest({ ...base, acceptTerms: 1 }).ok, false);
  });
});
