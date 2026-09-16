import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  atlasHqClickToWaHref,
  atlasHqWhatsAppDigits,
  DEFAULT_ATLAS_HQ_WHATSAPP,
  signupPendingPath,
} from "./hq-whatsapp";

describe("AtlasNow HQ click-to-WA", () => {
  it("normalizes digits", () => {
    assert.equal(atlasHqWhatsAppDigits("0858-6366-6290"), "6285863666290");
    assert.equal(atlasHqWhatsAppDigits("+62 858 6366 6290"), "6285863666290");
    assert.equal(atlasHqWhatsAppDigits(""), DEFAULT_ATLAS_HQ_WHATSAPP);
  });

  it("builds wa.me with prefill they must Send", () => {
    const id = atlasHqClickToWaHref({ brand: "Kopi Sari", locale: "id" });
    assert.match(id, /^https:\/\/wa\.me\/6285863666290\?text=/);
    assert.match(decodeURIComponent(id), /Halo AtlasNow, saya baru daftar Kopi Sari$/);
    const en = atlasHqClickToWaHref({ brand: "Kopi Sari", locale: "en" });
    assert.match(decodeURIComponent(en), /Hi AtlasNow, I just signed up Kopi Sari$/);
    const bare = atlasHqClickToWaHref({ locale: "id" });
    assert.match(decodeURIComponent(bare), /Halo AtlasNow, saya baru daftar$/);
  });

  it("carries brand on the pending path", () => {
    assert.equal(signupPendingPath(""), "/signup/pending");
    assert.equal(signupPendingPath("Kopi Sari"), "/signup/pending?brand=Kopi%20Sari");
  });
});
