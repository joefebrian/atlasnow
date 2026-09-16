import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { atlasProductCopyright, LEGAL_ENTITY, LEGAL_OPERATOR_LINE } from "./copy";

describe("public legal credit", () => {
  it("footer names PT Sorak Digital Media after P2P Labs", () => {
    assert.equal(LEGAL_OPERATOR_LINE, "P2P Labs (PT Sorak Digital Media)");
    assert.equal(LEGAL_ENTITY, "PT Sorak Digital Media");
    assert.equal(
      atlasProductCopyright(new Date("2026-09-11T00:00:00+07:00")),
      "© 2026 AtlasNow · A P2P Labs (PT Sorak Digital Media) product",
    );
  });
});
