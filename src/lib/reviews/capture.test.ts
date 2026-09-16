import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  capturePublicPath,
  coarseDevice,
  estimatedCaptureRate,
  isWritablePlaceId,
  mappingPlaceIdCandidates,
  parseCaptureUtm,
  placeIdFromInputs,
  sanitizeUtmValue,
  writeReviewUrl,
} from "./capture";

describe("isWritablePlaceId", () => {
  it("accepts ChIJ Places ids", () => {
    assert.equal(isWritablePlaceId("ChIJN1t_tDeuEmsRUsoyG83frY4"), true);
  });
  it("rejects Maps feature ids", () => {
    assert.equal(isWritablePlaceId("0x2e69f5d4dfad8c6d:0x1a0c3f0c0c0c0c0c"), false);
  });
  it("rejects empty", () => {
    assert.equal(isWritablePlaceId(""), false);
    assert.equal(isWritablePlaceId(null), false);
  });
});

describe("writeReviewUrl", () => {
  it("points at Google write-review with encoded place id", () => {
    assert.equal(
      writeReviewUrl("ChIJN1t_tDeuEmsRUsoyG83frY4"),
      "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4",
    );
  });
  it("returns null when not a Places id", () => {
    assert.equal(writeReviewUrl("0xabc:0xdef"), null);
  });
});

describe("placeIdFromInputs", () => {
  it("prefers a ChIJ mapping over a Maps URL", () => {
    assert.equal(
      placeIdFromInputs({
        website: "https://maps.google.com/?cid=1",
        notes: "Maps: https://www.google.com/maps/place/?q=place_id:ChIJother",
        mappingExternalIds: ["ChIJN1t_tDeuEmsRUsoyG83frY4", "0xabc:0xdef"],
      }),
      "ChIJN1t_tDeuEmsRUsoyG83frY4",
    );
  });
  it("parses place_id from the Maps note URL", () => {
    assert.equal(
      placeIdFromInputs({
        notes: "Maps: https://www.google.com/maps/place/?q=place_id:ChIJN1t_tDeuEmsRUsoyG83frY4",
        mappingExternalIds: [],
      }),
      "ChIJN1t_tDeuEmsRUsoyG83frY4",
    );
  });
  it("returns null when only a feature id exists", () => {
    assert.equal(
      placeIdFromInputs({ mappingExternalIds: ["0x2e69:0x1234"] }),
      null,
    );
  });
});

describe("mappingPlaceIdCandidates", () => {
  it("reads ChIJ from metaJson when externalId is a feature id", () => {
    const ids = mappingPlaceIdCandidates([
      {
        sourceType: "GOOGLE_MAPS",
        externalId: "0x2e69:0x1234",
        status: "ACTIVE",
        metaJson: JSON.stringify({ placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4", featureId: "0x2e69:0x1234" }),
      },
    ]);
    assert.equal(
      placeIdFromInputs({ mappingExternalIds: ids }),
      "ChIJN1t_tDeuEmsRUsoyG83frY4",
    );
  });
});

describe("parseCaptureUtm", () => {
  it("reads utm_* and ignores junk", () => {
    const u = parseCaptureUtm(
      new URLSearchParams("utm_source=nfc&utm_medium=exit&utm_campaign=senopati&foo=1&utm_content=<script>"),
    );
    assert.equal(u.utmSource, "nfc");
    assert.equal(u.utmMedium, "exit");
    assert.equal(u.utmCampaign, "senopati");
    assert.equal(u.utmContent, "script");
  });
});

describe("sanitizeUtmValue", () => {
  it("strips to short safe tokens", () => {
    assert.equal(sanitizeUtmValue("QR-Table_1"), "QR-Table_1");
    assert.equal(sanitizeUtmValue("a".repeat(100))?.length, 80);
    assert.equal(sanitizeUtmValue("hello world!"), "helloworld");
  });
});

describe("estimatedCaptureRate", () => {
  it("is null without intents, else reviews/intents", () => {
    assert.equal(estimatedCaptureRate(0, 3), null);
    assert.equal(estimatedCaptureRate(10, 2), 0.2);
  });
});

describe("capturePublicPath", () => {
  it("is /r/{token} with no UTM on the printed path", () => {
    assert.equal(capturePublicPath("abcToken"), "/r/abcToken");
  });
});

describe("coarseDevice", () => {
  it("classifies mobile vs desktop", () => {
    assert.equal(coarseDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"), "mobile");
    assert.equal(coarseDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "desktop");
    assert.equal(coarseDevice(null), null);
  });
});
