import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  brandLetter,
  extractCardToken,
  inspectCardToken,
  isJoinQr,
  memberAppPath,
  parseMemberAppPath,
  signCardToken,
  verifyCardToken,
} from "./card-token";

describe("card token", () => {
  it("round-trips a member QR", () => {
    const token = signCardToken("tenant_a", "62812", 3600);
    const r = verifyCardToken(token);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.claims.tid, "tenant_a");
      assert.equal(r.claims.phone, "62812");
    }
  });

  it("rejects a tampered token", () => {
    const token = signCardToken("tenant_a", "62812", 3600);
    const bad = token.slice(0, -2) + "xx";
    assert.equal(verifyCardToken(bad).ok, false);
  });

  it("rejects an expired token", () => {
    const token = signCardToken("tenant_a", "62812", -10);
    const r = verifyCardToken(token);
    assert.equal(r.ok, false);
  });

  it("still reads an expired token so the phone page can refresh it", () => {
    const token = signCardToken("tenant_a", "62812", -10);
    const r = inspectCardToken(token);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.expired, true);
      assert.equal(r.claims.tid, "tenant_a");
    }
  });

  it("shortens a brand name to home-screen letters", () => {
    assert.equal(brandLetter("P2P LABS"), "P2");
    assert.equal(brandLetter("Kopi Kenangan"), "KO");
  });

  it("pulls the token out of a card URL", () => {
    const token = signCardToken("t", "62811", 3600);
    assert.equal(extractCardToken(`https://atlasnow.co/card/${token}`), token);
    assert.equal(extractCardToken(token), token);
  });

  it("spots a join QR so we do not treat daftar as stamp", () => {
    assert.equal(isJoinQr("https://atlasnow.co/join/abc"), true);
    assert.equal(isJoinQr("https://atlasnow.co/card/an1.x.y"), false);
  });

  it("builds a stable per-brand card path", () => {
    const path = memberAppPath("villo-gelato", "mem_1");
    assert.equal(path, "/c/villo-gelato/mem_1");
    assert.deepEqual(parseMemberAppPath(`https://atlasnow.co${path}`), {
      slug: "villo-gelato",
      memberId: "mem_1",
    });
    assert.equal(parseMemberAppPath("https://atlasnow.co/card/an1.x.y"), null);
  });
});
