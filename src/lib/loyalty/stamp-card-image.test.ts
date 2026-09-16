import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stampImagePublicUrl } from "./stamp-card-image";

describe("stampImagePublicUrl", () => {
  it("puts count in the query so WhatsApp does not cache the wrong card", () => {
    const url = stampImagePublicUrl("an1.abc.def", 3);
    assert.match(url, /\/api\/card\/an1\.abc\.def\/image/);
    assert.match(url, /n=3/);
  });
});
