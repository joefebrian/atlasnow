import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildListUgcPostsUrl,
  clampWindowDays,
  dateFromUnixish,
  filterReviewsByWindow,
  lookbackDecision,
  lookbackStepLabel,
  mapsLookbackSteps,
  mapsReviewExternalId,
  pageIsOlderThanWindow,
  parseListUgcPosts,
  parsePlacesReviews,
  parseRelativeReviewTime,
  stripXssiPrefix,
  withinWindow,
  type MapsReview,
} from "./maps-parse";

function review(partial: Partial<MapsReview> & { createTime: Date | null }): MapsReview {
  return {
    externalId: partial.externalId || "maps:x",
    reviewerName: partial.reviewerName ?? "A",
    starRating: partial.starRating ?? 5,
    comment: partial.comment ?? "ok",
    createTime: partial.createTime,
    updateTime: partial.updateTime ?? partial.createTime,
    replyComment: partial.replyComment ?? null,
    replyUpdateTime: partial.replyUpdateTime ?? null,
    relativeTime: partial.relativeTime ?? null,
    raw: partial.raw ?? null,
  };
}

describe("clampWindowDays", () => {
  it("allows 30/60/90 and defaults to 90", () => {
    assert.equal(clampWindowDays(30), 30);
    assert.equal(clampWindowDays(60), 60);
    assert.equal(clampWindowDays(90), 90);
    assert.equal(clampWindowDays(7), 90);
    assert.equal(clampWindowDays(undefined), 90);
  });
});

describe("parseRelativeReviewTime", () => {
  const now = Date.parse("2026-08-21T00:00:00Z");

  it("parses english and indonesian relatives", () => {
    const week = parseRelativeReviewTime("2 weeks ago", now);
    assert.ok(week);
    assert.equal(Math.round((now - week.getTime()) / 86_400_000), 14);

    const bulan = parseRelativeReviewTime("3 bulan lalu", now);
    assert.ok(bulan);
    assert.equal(Math.round((now - bulan.getTime()) / 86_400_000), 90);

    const sebulan = parseRelativeReviewTime("sebulan lalu", now);
    assert.ok(sebulan);
    assert.equal(Math.round((now - sebulan.getTime()) / 86_400_000), 30);
  });

  it("strips Edited prefix", () => {
    const d = parseRelativeReviewTime("Edited a day ago", now);
    assert.ok(d);
    assert.equal(Math.round((now - d.getTime()) / 86_400_000), 1);
  });
});

describe("dateFromUnixish / window", () => {
  it("accepts seconds and micros", () => {
    const sec = dateFromUnixish(1_750_000_000);
    assert.ok(sec);
    assert.equal(sec.toISOString().startsWith("2025-"), true);
    const micro = dateFromUnixish(1_750_000_000_000_000);
    assert.ok(micro);
    assert.equal(micro.getTime(), sec.getTime());
  });

  it("keeps last 90 days and drops older", () => {
    const now = Date.parse("2026-08-21T00:00:00Z");
    const inside = new Date(now - 20 * 86_400_000);
    const older = new Date(now - 120 * 86_400_000);
    assert.equal(withinWindow(inside, 90, now), true);
    assert.equal(withinWindow(older, 90, now), false);
    assert.equal(withinWindow(null, 90, now), true);

    const { kept, droppedOlder } = filterReviewsByWindow(
      [review({ createTime: inside }), review({ createTime: older })],
      90,
      now
    );
    assert.equal(kept.length, 1);
    assert.equal(droppedOlder, 1);
    assert.equal(
      pageIsOlderThanWindow(
        [review({ createTime: older }), review({ createTime: older })],
        90,
        now
      ),
      true
    );
  });
});

describe("lookback waterfall", () => {
  const now = Date.parse("2026-08-21T00:00:00Z");
  const daysAgo = (d: number) => new Date(now - d * 86_400_000);

  it("builds 1 month then 2-month steps", () => {
    const steps = mapsLookbackSteps();
    assert.equal(steps[0].endDays, 30);
    assert.equal(steps[1].startDays, 30);
    assert.equal(steps[1].endDays, 90);
    assert.equal(steps[2].startDays, 90);
    assert.equal(steps[2].endDays, 150);
    assert.equal(lookbackStepLabel(steps[0], 0), "last 1 month");
    assert.equal(
      lookbackStepLabel(steps[1], 1),
      "the 2 months before that (1–3 months ago)"
    );
  });

  it("keeps last 1 month when it has reviews", () => {
    const picked = lookbackDecision(
      [
        review({ createTime: daysAgo(10), comment: "new" }),
        review({ createTime: daysAgo(45), comment: "old" }),
      ],
      now,
      { noMorePages: true }
    );
    assert.equal(picked.stepIndex, 0);
    assert.equal(picked.reviews.length, 1);
    assert.equal(picked.reviews[0].comment, "new");
    assert.equal(picked.donePaging, true);
  });

  it("falls back to the 2 months before when last month is empty", () => {
    const picked = lookbackDecision(
      [
        review({ createTime: daysAgo(40), comment: "m2" }),
        review({ createTime: daysAgo(80), comment: "m3" }),
      ],
      now,
      { noMorePages: true }
    );
    assert.equal(picked.stepIndex, 1);
    assert.equal(picked.reviews.length, 2);
    assert.match(picked.label, /2 months before/);
  });

  it("repeats the same 2-month pattern when the previous slice is empty", () => {
    const picked = lookbackDecision(
      [review({ createTime: daysAgo(100), comment: "older" })],
      now,
      { noMorePages: true }
    );
    assert.equal(picked.stepIndex, 2);
    assert.equal(picked.reviews[0].comment, "older");
  });

  it("keeps paging last month until reviews older than 30 days appear", () => {
    const mid = lookbackDecision(
      [review({ createTime: daysAgo(8), comment: "fresh" })],
      now,
      { noMorePages: false }
    );
    assert.equal(mid.stepIndex, 0);
    assert.equal(mid.donePaging, false);

    const done = lookbackDecision(
      [
        review({ createTime: daysAgo(8), comment: "fresh" }),
        review({ createTime: daysAgo(40), comment: "past" }),
      ],
      now,
      { noMorePages: false }
    );
    assert.equal(done.stepIndex, 0);
    assert.equal(done.reviews.length, 1);
    assert.equal(done.donePaging, true);
  });

  it("treats undated reviews as last 1 month", () => {
    const picked = lookbackDecision(
      [review({ createTime: null, comment: "no date" })],
      now,
      { noMorePages: true }
    );
    assert.equal(picked.stepIndex, 0);
    assert.equal(picked.reviews.length, 1);
  });
});

describe("parseListUgcPosts", () => {
  it("strips XSSI and reads nested review fields", () => {
    const postedMicro = 1_755_744_000_000_000; // ~2025-08-21
    const el = [
      "ChZDSUhNMG9nS0VJQ0FnSURabc",
      [
        null,
        null,
        postedMicro,
        postedMicro,
        [null, null, null, null, null, ["Andi Gelato"]],
        null,
        "2 weeks ago",
      ],
      [
        [5],
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        [["Rasanya enak banget"]],
      ],
      [
        null,
        postedMicro,
        postedMicro,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        [],
        [null, ["Makasih ya!"]],
      ],
    ];
    const envelope = [null, "NEXT_TOKEN", [[el]]];
    const raw = ")]}'\n" + JSON.stringify(envelope);
    assert.equal(stripXssiPrefix(raw).startsWith("["), true);

    const parsed = parseListUgcPosts(raw, "0xabc:0xdef");
    assert.equal(parsed.nextPageToken, "NEXT_TOKEN");
    assert.equal(parsed.reviews.length, 1);
    const r = parsed.reviews[0];
    assert.equal(r.reviewerName, "Andi Gelato");
    assert.equal(r.starRating, 5);
    assert.equal(r.comment, "Rasanya enak banget");
    assert.equal(r.replyComment, "Makasih ya!");
    assert.equal(r.externalId, "maps:ChZDSUhNMG9nS0VJQ0FnSURabc");
    assert.ok(r.createTime);
  });

  it("returns empty on HTML consent pages", () => {
    const parsed = parseListUgcPosts("<html>Before you continue to Google</html>");
    assert.equal(parsed.reviews.length, 0);
    assert.equal(parsed.nextPageToken, null);
  });
});

describe("parsePlacesReviews / external ids", () => {
  it("builds stable ids without a Google review id", () => {
    const a = mapsReviewExternalId({
      placeKey: "ChIJ1",
      author: "Budi",
      timeSec: 1750000000,
      text: "Mantap",
    });
    const b = mapsReviewExternalId({
      placeKey: "ChIJ1",
      author: "Budi",
      timeSec: 1750000000,
      text: "Mantap",
    });
    assert.equal(a, b);
    assert.equal(a.startsWith("maps:h:"), true);
  });

  it("maps Places Details payload", () => {
    const reviews = parsePlacesReviews({
      place_id: "ChIJ123",
      reviews: [
        {
          author_name: "Sari",
          rating: 4,
          text: "Ramah",
          time: 1_750_000_000,
          relative_time_description: "a month ago",
        },
      ],
    });
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].reviewerName, "Sari");
    assert.equal(reviews[0].starRating, 4);
    assert.ok(reviews[0].createTime);
  });
});

describe("buildListUgcPostsUrl", () => {
  it("sorts newest-first and encodes the feature id", () => {
    const url = buildListUgcPostsUrl({
      featureId: "0xabc:0xdef",
      pageToken: "tok",
      requestId: "reqidreqidreqidreqid1",
    });
    assert.equal(url.includes("listugcposts"), true);
    assert.equal(url.includes(encodeURIComponent("0xabc:0xdef")), true);
    assert.equal(url.includes("!13m1!1e2"), true);
    assert.equal(url.includes("gl=id"), true);
    assert.equal(url.includes("!2s" + encodeURIComponent("tok")), true);
  });
});

