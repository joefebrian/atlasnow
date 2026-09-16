import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  looksLikeStreetName,
  mapsUrlFromLocation,
  mergePlaceDetails,
  namesReferToSamePlace,
  parseCoordsFromMapsUrl,
  parseMapsFeatureId,
  parsePlaceNameFromMapsUrl,
  pickGeocodeResult,
  preferBusinessName,
  resolveStoreName,
  shouldAdoptPlace,
  shouldReplaceLocationName,
  mapsUrlWithPlaceId,
  shortenMapsUrl,
} from "./maps-url";

describe("looksLikeStreetName", () => {
  it("flags Indonesian street slugs and address-style names", () => {
    assert.equal(looksLikeStreetName("Jalan Tomang Raya"), true);
    assert.equal(looksLikeStreetName("Jl. Tomang Raya No.54"), true);
    assert.equal(
      looksLikeStreetName(
        "Jl. Tomang Raya No.54, Tomang, Kec. Grogol petamburan, Kota Jakarta Barat"
      ),
      true
    );
    assert.equal(looksLikeStreetName("Gg. Jambu No.33"), true);
    assert.equal(looksLikeStreetName("Gang Jambu"), true);
  });

  it("keeps real store names", () => {
    assert.equal(looksLikeStreetName("Vilo Gelato Tomang"), false);
    assert.equal(looksLikeStreetName("Vilo Gelato Puri Indah"), false);
  });
});

describe("preferBusinessName", () => {
  it("picks Vilo Gelato Tomang over the street slug from Maps", () => {
    assert.equal(
      preferBusinessName("Jl. Tomang Raya No.54", "Vilo Gelato Tomang"),
      "Vilo Gelato Tomang"
    );
  });

  it("returns null when every candidate is a street", () => {
    assert.equal(preferBusinessName("Jl. Tomang Raya No.54", "Jalan Tomang Raya"), null);
  });
});

describe("resolveStoreName", () => {
  it("keeps Vilo Gelato Menteng from the URL over a nearby neighbor", () => {
    assert.equal(
      resolveStoreName("Vilo Gelato Menteng", "Bakpo SONG BIE Pak Yudi"),
      "Vilo Gelato Menteng"
    );
  });

  it("uses Places name when the URL slug is a street", () => {
    assert.equal(
      resolveStoreName("Jl. Tomang Raya No.54", "Vilo Gelato Tomang"),
      "Vilo Gelato Tomang"
    );
  });
});

describe("namesReferToSamePlace / shouldAdoptPlace", () => {
  it("matches brand variants and rejects a different shop", () => {
    assert.equal(namesReferToSamePlace("Vilo Gelato Menteng", "Vilo Gelato"), true);
    assert.equal(
      namesReferToSamePlace("Vilo Gelato Menteng", "Bakpo SONG BIE Pak Yudi"),
      false
    );
  });

  it("does not adopt a neighbor when the Maps slug is a store name", () => {
    assert.equal(
      shouldAdoptPlace("Vilo Gelato Menteng", "Bakpo SONG BIE Pak Yudi"),
      false
    );
    assert.equal(shouldAdoptPlace("Vilo Gelato Menteng", "Vilo Gelato Menteng"), true);
  });

  it("adopts an establishment when the URL slug is only a street", () => {
    assert.equal(shouldAdoptPlace("Jl. Tomang Raya No.54", "Vilo Gelato Tomang"), true);
  });
});

describe("mergePlaceDetails", () => {
  it("keeps Find Place business name and phone when geocode place is the street", () => {
    const street = {
      name: "Jl. Tomang Raya No.54",
      addressLine1: "Jl. Tomang Raya No.54",
      phone: null as string | null,
      placeId: "geo-street",
    };
    const found = {
      name: "Vilo Gelato Tomang",
      addressLine1: "Jl. Tomang Raya No.54",
      phone: "+62 812-8332-3278",
      placeId: "place-vilo",
    };
    const merged = mergePlaceDetails(street, found);
    assert.equal(merged?.name, "Vilo Gelato Tomang");
    assert.equal(merged?.phone, "+62 812-8332-3278");
    assert.equal(merged?.placeId, "place-vilo");
  });
});

describe("shouldReplaceLocationName", () => {
  it("overwrites a street name when Maps returns a store name", () => {
    assert.equal(
      shouldReplaceLocationName("Gg. Jambu No.33", "Vilo Gelato Tomang"),
      true
    );
  });

  it("does not overwrite a store name with a street slug", () => {
    assert.equal(
      shouldReplaceLocationName("Vilo Gelato Tomang", "Jl. Tomang Raya No.54"),
      false
    );
  });

  it("overwrites a wrong neighbor name when Maps returns the store", () => {
    assert.equal(
      shouldReplaceLocationName("Bakpo SONG BIE Pak Yudi", "Vilo Gelato Menteng"),
      true
    );
  });

  it("fills an empty name", () => {
    assert.equal(shouldReplaceLocationName("", "Vilo Gelato Tomang"), true);
  });
});

describe("parsePlaceNameFromMapsUrl", () => {
  it("decodes the /place/ slug", () => {
    const url =
      "https://www.google.com/maps/place/Jl.+Tomang+Raya+No.54/@-6.178,106.797,17z";
    assert.equal(parsePlaceNameFromMapsUrl(url), "Jl. Tomang Raya No.54");
  });
});

describe("parseCoordsFromMapsUrl", () => {
  it("prefers the place pin !3d!4d over the camera @ viewport", () => {
    const url =
      "https://www.google.com/maps/place/Vilo+Gelato+Menteng/@-6.1936628,106.8265409,17z/data=!3m1!4b1!4m6!3m5!1s0x2e69f5a9a36dc8dd:0x59df8c82a6b4b7e8!8m2!3d-6.1936628!4d106.8291158";
    const c = parseCoordsFromMapsUrl(url);
    assert.equal(c?.lat, -6.1936628);
    assert.equal(c?.lng, 106.8291158);
  });
});

describe("pickGeocodeResult", () => {
  it("prefers establishment over street_address", () => {
    const picked = pickGeocodeResult([
      { place_id: "street", types: ["street_address"] },
      { place_id: "shop", types: ["establishment", "food", "point_of_interest"] },
    ]);
    assert.equal(picked?.place_id, "shop");
  });
});

describe("parseMapsFeatureId", () => {
  it("reads 0x:0x from data=!1s", () => {
    const url =
      "https://www.google.com/maps/place/Vilo+Gelato+Tomang/@-6.178,106.797,17z/data=!3m1!4b1!4m6!3m5!1s0x2e69f5a1b2c3d4e5:0xabc123def456!8m2!3d-6.178!4d106.797";
    assert.equal(parseMapsFeatureId(url), "0x2e69f5a1b2c3d4e5:0xabc123def456");
  });

  it("ignores ChIJ place ids", () => {
    assert.equal(
      parseMapsFeatureId("https://www.google.com/maps/place/?q=place_id:ChIJabc123"),
      null
    );
  });
});

describe("shortenMapsUrl / mapsUrlFromLocation", () => {
  it("drops giant data= payloads but keeps the feature id", () => {
    const long =
      "https://www.google.com/maps/place/Vilo+Gelato+Tomang/@-6.178,106.797,17z/data=!3m1!4b1!4m6!3m5!1s0x2e69f5a1b2c3d4e5:0xabc123def456!8m2!3d-6.178!4d106.797";
    assert.equal(
      shortenMapsUrl(long),
      "https://www.google.com/maps/place/Vilo+Gelato+Tomang/@-6.178,106.797,17z/data=!4m2!3m1!1s0x2e69f5a1b2c3d4e5:0xabc123def456"
    );
  });

  it("drops junk data= when there is no feature id", () => {
    const long =
      "https://www.google.com/maps/place/Vilo+Gelato+Tomang/@-6.178,106.797,17z/data=!3m1!4b1!4m6!3m5!1s0xabc";
    assert.equal(
      shortenMapsUrl(long),
      "https://www.google.com/maps/place/Vilo+Gelato+Tomang/@-6.178,106.797,17z"
    );
  });

  it("writes a place_id URL when Fetch from Maps returns ChIJ", () => {
    assert.equal(
      mapsUrlWithPlaceId("ChIJN1t_tDeuEmsRUsoyG83frY4", "https://www.google.com/maps/place/P2P+Labs/@-6.19,106.73,17z"),
      "https://www.google.com/maps/place/?q=place_id:ChIJN1t_tDeuEmsRUsoyG83frY4",
    );
    assert.equal(
      mapsUrlWithPlaceId("0xabc:0xdef", "https://www.google.com/maps/place/P2P+Labs/@-6.19,106.73,17z"),
      "https://www.google.com/maps/place/P2P+Labs/@-6.19,106.73,17z",
    );
  });

  it("reads Maps: note or maps website", () => {
    assert.equal(
      mapsUrlFromLocation({
        website: "https://vilogelato.com",
        notes: "Maps: https://maps.app.goo.gl/abc",
      }),
      "https://maps.app.goo.gl/abc"
    );
    assert.equal(
      mapsUrlFromLocation({
        website: "https://maps.app.goo.gl/xyz",
        notes: null,
      }),
      "https://maps.app.goo.gl/xyz"
    );
  });
});
