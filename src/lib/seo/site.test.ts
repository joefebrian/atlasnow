import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalUrl, homeDescription, homeTitle, INDEXABLE_PATHS, OG_IMAGE, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, publicMetadata, ROBOTS_DISALLOW } from "./site";
import { softwareJsonLd } from "./json-ld";

describe("seo site", () => {
  it("builds trailing-slash home canonical and stripped inner paths", () => {
    assert.equal(canonicalUrl("/"), "https://atlasnow.co/");
    assert.equal(canonicalUrl("/pricing"), "https://atlasnow.co/pricing");
    assert.equal(canonicalUrl("/faq/"), "https://atlasnow.co/faq");
  });

  it("homepage title and description name the five crawlable systems", () => {
    const blob = `${homeTitle()} ${homeDescription()}`;
    for (const term of [
      "Google Business Profile",
      "Google Maps",
      "WhatsApp CRM",
      "outlet operations",
      "Revenue attribution",
    ]) {
      assert.match(blob, new RegExp(term, "i"));
    }
    assert.match(homeDescription(), /Optimize Every Outlet/);
    assert.doesNotMatch(homeDescription(), /invent.*Maps visits as revenue/i);
  });

  it("public metadata sets canonical, index, and Open Graph", () => {
    const m = publicMetadata({
      path: "/about",
      title: "About AtlasNow",
      description: "Multi-outlet desk.",
    });
    assert.equal((m.alternates as { canonical: string }).canonical, "https://atlasnow.co/about");
    assert.equal((m.robots as { index: boolean }).index, true);
    assert.equal((m.openGraph as { url: string }).url, "https://atlasnow.co/about");
    const img = (m.openGraph as { images: { url: string; width: number; height: number }[] }).images[0];
    assert.equal(img.url, OG_IMAGE);
    assert.equal(img.width, OG_IMAGE_WIDTH);
    assert.equal(img.height, OG_IMAGE_HEIGHT);
    assert.equal(OG_IMAGE, "/brand/og-1200x630.png");
  });

  it("keeps app routes out of the indexable list and in robots disallow", () => {
    assert.equal(INDEXABLE_PATHS.includes("/" as (typeof INDEXABLE_PATHS)[number]), true);
    assert.ok(ROBOTS_DISALLOW.some((p) => p === "/control-tower"));
    assert.ok(ROBOTS_DISALLOW.some((p) => p === "/api/"));
  });

  it("JSON-LD feature list names the five systems", () => {
    const list = softwareJsonLd().featureList.join(" ");
    assert.match(list, /Google Business Profile/);
    assert.match(list, /WhatsApp CRM/);
    assert.match(list, /Revenue attribution/);
  });
});
