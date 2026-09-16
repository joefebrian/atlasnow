import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { landingCopy } from "./landing";

const SYSTEMS = [
  "Google Business Profile",
  "Google Maps",
  "WhatsApp CRM",
  "Outlet operations",
  "Revenue attribution",
] as const;

describe("landing crawlable systems", () => {
  it("exposes all five system titles in EN and ID HTML copy", () => {
    for (const locale of ["en", "id"] as const) {
      const titles = landingCopy(locale).systems.map((s) => s.title);
      assert.deepEqual(titles, [...SYSTEMS]);
    }
  });

  it("EN lede names WhatsApp CRM, Google Business Profile, and revenue attribution", () => {
    const lede = landingCopy("en").lede;
    assert.match(lede, /WhatsApp CRM/);
    assert.match(lede, /Google Business Profile/);
    assert.match(lede, /Google Maps/);
    assert.match(lede, /outlet operations/);
    assert.match(lede, /revenue attribution/i);
  });
});
