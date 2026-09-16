import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSecretCodeMessage } from "./secret-code";

describe("isSecretCodeMessage", () => {
  it("flags WhatsApp pairing copy", () => {
    assert.equal(isSecretCodeMessage("000-000 is your WhatsApp code. Don't share it."), true);
    assert.equal(isSecretCodeMessage("Don't share this code with anyone."), true);
    assert.equal(isSecretCodeMessage("Jangan bagikan kode ini ke siapa pun."), true);
    assert.equal(isSecretCodeMessage("Your pairing code is 000000"), true);
  });

  it("lets normal customer chat through", () => {
    assert.equal(isSecretCodeMessage("halo, mau daftar stamp"), false);
    assert.equal(isSecretCodeMessage("Status Stamp"), false);
    assert.equal(isSecretCodeMessage("kode meja 12"), false);
  });
});
