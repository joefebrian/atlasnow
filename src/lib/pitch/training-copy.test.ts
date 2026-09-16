import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { trainingCopy } from "./training-copy";

describe("training copy · Free", () => {
  it("leads with Free onboarding and keeps loyalty slides", () => {
    const en = trainingCopy("en");
    const id = trainingCopy("id");
    assert.equal(en.cover.kicker, "Free training");
    assert.match(en.agenda.on.join(" "), /2 outlets/);
    assert.match(en.agenda.off.join(" "), /Outlet #3/);
    assert.equal(en.onboard.steps.length, 5);
    assert.match(en.users.lede, /does not self-serve|not an invite/i);
    assert.match(en.receipt.title, /receipt/i);
    assert.equal(en.setupPath.tabs.length, 4);
    assert.equal(en.pocket.rows.length, 6);
    assert.doesNotMatch(JSON.stringify(en), /Use the desk first/i);
    assert.doesNotMatch(JSON.stringify(id), /Pakai mejanya dulu/i);
    assert.equal(id.cover.kicker, "Pelatihan Gratis");
    assert.match(id.agenda.on.join(" "), /2 outlet/);
  });
});
