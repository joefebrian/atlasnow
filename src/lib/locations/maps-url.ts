export type MapsPlaceDraft = {
  name?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  website?: string | null;
  mapsUrl?: string | null;
  placeId?: string | null;
  source: "url_parse" | "nominatim" | "google_geocoding" | "google_places";
  warnings: string[];
};

/** Follow short links (maps.app.goo.gl) to final Google Maps URL. */
export async function resolveMapsUrl(input: string): Promise<string> {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  // Short links need redirect resolution
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url)) {
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; AtlasNow/1.0; +https://atlasnow.co)",
        },
      });
      if (res.url) return res.url;
    } catch {
      /* keep original */
    }
  }
  return url;
}

export function parseCoordsFromMapsUrl(url: string): {
  lat: number;
  lng: number;
} | null {
  // !3dlat!4dlng is the place pin. @lat,lng is the camera/viewport (often a neighbor).
  const pins = [...url.matchAll(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/g)];
  if (pins.length) {
    const last = pins[pins.length - 1];
    return { lat: Number(last[1]), lng: Number(last[2]) };
  }
  // @-6.2088,106.8456,17z
  const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,\d+[a-z])?/i);
  if (at) {
    return { lat: Number(at[1]), lng: Number(at[2]) };
  }
  // q=-6.2088,106.8456
  const q = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (q) {
    return { lat: Number(q[1]), lng: Number(q[2]) };
  }
  // ll=
  const ll = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (ll) {
    return { lat: Number(ll[1]), lng: Number(ll[2]) };
  }
  return null;
}

/** Place name from /place/Name/ or /place/Name/@... */
export function parsePlaceNameFromMapsUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/place\/([^/]+)/i);
    if (!m?.[1]) return null;
    return decodeURIComponent(m[1].replace(/\+/g, " ")).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Extract Google Place ID from Maps URLs when present (ChIJ… / hex place ids).
 */
export function parsePlaceIdFromMapsUrl(url: string): string | null {
  try {
    const decoded = decodeURIComponent(url);

    const patterns = [
      /[?&]query_place_id=([^&]+)/i,
      /[?&]place_id=([^&]+)/i,
      /place_id[=:]([A-Za-z0-9_-]+)/i,
      /!1s(ChIJ[A-Za-z0-9_-]+)/,
      /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i,
      /ftid=(0x[0-9a-f]+:0x[0-9a-f]+)/i,
    ];

    for (const re of patterns) {
      const m = decoded.match(re);
      if (m?.[1]) {
        const id = m[1].trim();
        // Skip pure hex cid-style without usable Places Details in classic API
        // ChIJ… works; 0x…:0x… often needs Places (New) — still try classic first
        if (id.startsWith("ChIJ") || id.includes(":")) return id;
        if (/^[A-Za-z0-9_-]{10,}$/.test(id)) return id;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Maps feature id (0x…:0x…) used by the public listugcposts feed.
 * Distinct from ChIJ place ids, which Places Details understands.
 */
export function parseMapsFeatureId(url: string): string | null {
  try {
    const decoded = decodeURIComponent(url);
    const patterns = [
      /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i,
      /ftid=(0x[0-9a-f]+:0x[0-9a-f]+)/i,
      /[?&]feature_id=(0x[0-9a-f]+:0x[0-9a-f]+)/i,
      /(0x[0-9a-f]+:0x[0-9a-f]+)/i,
    ];
    for (const re of patterns) {
      const m = decoded.match(re);
      if (m?.[1]) return m[1];
    }
  } catch {
    /* ignore */
  }
  return null;
}

const STREET_PREFIX = /^(jl\.?|jalan|gg\.?|gang)\b/i;

/** Street / address slugs must not become the store name (e.g. Jl. Tomang Raya). */
export function looksLikeStreetName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const n = name.trim();
  if (n.includes(",") && (STREET_PREFIX.test(n) || /\bno\.?\s*\d/i.test(n))) {
    return true;
  }
  return STREET_PREFIX.test(n);
}

/** First candidate that looks like a business, not a street. */
export function preferBusinessName(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const c of candidates) {
    const t = c?.trim();
    if (t && !looksLikeStreetName(t)) return t;
  }
  return null;
}

/** URL slug wins when it is a store name — nearby geocode often hits a neighbor. */
export function resolveStoreName(
  urlName: string | null | undefined,
  ...others: Array<string | null | undefined>
): string | null {
  return preferBusinessName(urlName, ...others);
}

function normalizePlaceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NAME_STOP = new Set(["the", "and", "dan", "cabang", "outlet", "store"]);

export function namesReferToSamePlace(a: string, b: string): boolean {
  const na = normalizePlaceName(a);
  const nb = normalizePlaceName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const tokens = (s: string) =>
    s.split(" ").filter((t) => t.length > 2 && !NAME_STOP.has(t));
  const ta = tokens(na);
  const tb = tokens(nb);
  if (!ta.length || !tb.length) return false;
  const overlap = ta.filter((t) => tb.includes(t));
  return overlap.length >= 2 || (overlap.length === 1 && (ta.length === 1 || tb.length === 1));
}

/** Use a Places/nearby result only if it is the same shop as the Maps slug. */
export function shouldAdoptPlace(
  hintName: string | null | undefined,
  candidateName: string | null | undefined
): boolean {
  if (!candidateName?.trim()) return false;
  if (!hintName?.trim() || looksLikeStreetName(hintName)) return true;
  if (looksLikeStreetName(candidateName)) return true;
  return namesReferToSamePlace(hintName, candidateName);
}

/** Fill empty / street / wrong names when Maps returns a store name. */
export function shouldReplaceLocationName(
  current: string,
  incoming: string | null | undefined
): boolean {
  if (!incoming?.trim() || looksLikeStreetName(incoming)) return false;
  if (!current.trim() || looksLikeStreetName(current)) return true;
  return !namesReferToSamePlace(current, incoming);
}

export type PlaceLike = {
  name?: string | null;
  phone?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
};

/** Merge two place payloads — business name/placeId win over a street geocode. */
export function mergePlaceDetails<T extends PlaceLike>(
  a: T | null,
  b: T | null
): T | null {
  if (!a) return b;
  if (!b) return a;
  const name = preferBusinessName(a.name, b.name);
  const named =
    name && a.name === name && !looksLikeStreetName(a.name)
      ? a
      : name && b.name === name && !looksLikeStreetName(b.name)
        ? b
        : b;
  return {
    ...a,
    ...b,
    name,
    phone: a.phone || b.phone || null,
    website: a.website || b.website || null,
    addressLine1: a.addressLine1 || b.addressLine1 || null,
    city: a.city || b.city || null,
    region: a.region || b.region || null,
    postalCode: a.postalCode || b.postalCode || null,
    country: a.country || b.country || null,
    latitude: a.latitude ?? b.latitude ?? null,
    longitude: a.longitude ?? b.longitude ?? null,
    placeId: named.placeId || b.placeId || a.placeId || null,
  };
}

export function pickGeocodeResult<T extends { types?: string[] }>(
  results: T[]
): T | undefined {
  if (!results.length) return undefined;
  const rank = (types: string[] = []) => {
    if (
      types.some((t) =>
        ["establishment", "point_of_interest", "food", "store", "cafe"].includes(t)
      )
    ) {
      return 0;
    }
    if (types.includes("premise") || types.includes("subpremise")) return 1;
    if (types.includes("street_address")) return 2;
    if (types.includes("route")) return 3;
    return 4;
  };
  return [...results].sort((x, y) => rank(x.types) - rank(y.types))[0];
}

/** Persist a ChIJ so Review Capture can 302 to writereview. Feature ids stay in the fallback URL. */
export function mapsUrlWithPlaceId(
  placeId: string | null | undefined,
  fallback: string,
): string {
  const id = (placeId || "").trim();
  if (id.startsWith("ChIJ") || id.startsWith("GhIJ")) {
    return `https://www.google.com/maps/place/?q=place_id:${id}`;
  }
  return shortenMapsUrl(fallback);
}

/** Keep place/@lat,lng and the place/feature id — drop the rest of data=!. */
export function shortenMapsUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("goo.gl") || u.hostname.includes("maps.app")) {
      return url.slice(0, 500);
    }
    const place = u.pathname.match(/\/place\/[^/]+/i)?.[0];
    const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,[^/?#]+)?/);
    const feature = parseMapsFeatureId(url);
    const chij = parsePlaceIdFromMapsUrl(url);
    const placeId = chij && chij.startsWith("ChIJ") ? chij : null;
    if (place && at) {
      const base = `https://www.google.com/maps${place}/${at[0]}`;
      if (feature) return `${base}/data=!4m2!3m1!1s${feature}`;
      if (placeId) return `${base}?q=place_id:${placeId}`;
      return base;
    }
    if (at) {
      return `https://www.google.com/maps/@${at[1]},${at[2]},17z`;
    }
    return url.length > 500 ? url.slice(0, 500) : url;
  } catch {
    return url.slice(0, 500);
  }
}

export function mapsUrlFromLocation(loc: {
  website?: string | null;
  notes?: string | null;
}): string {
  const note = loc.notes?.match(/Maps:\s*(\S+)/i)?.[1];
  if (note && /^https?:\/\//i.test(note)) return note;
  const site = loc.website?.trim() || "";
  if (/google\.[^/]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(site)) {
    return site;
  }
  return "";
}

async function mapsApiKey(): Promise<string | null> {
  try {
    const { resolvedMapsApiKey } = await import("@/lib/integrations/service");
    const key =
      (await resolvedMapsApiKey()) ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_GEOCODING_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY;
    return key?.trim() || null;
  } catch {
    return (
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_GEOCODING_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      null
    )?.trim() || null;
  }
}

type NominatimResult = {
  display_name?: string;
  address?: {
    road?: string;
    pedestrian?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    city_district?: string;
    state?: string;
    region?: string;
    postcode?: string;
    country_code?: string;
    phone?: string;
  };
  extratags?: { phone?: string; contact_phone?: string; "contact:phone"?: string };
};

async function reverseNominatim(lat: number, lng: number): Promise<MapsPlaceDraft | null> {
  const qs = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lng),
    addressdetails: "1",
    extratags: "1",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${qs}`, {
    headers: {
      "User-Agent": "AtlasNow/1.0 (P2P Labs location onboarding; https://atlasnow.co)",
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as NominatimResult;
  const a = data.address || {};
  const street = [a.house_number, a.road || a.pedestrian].filter(Boolean).join(" ");
  const city =
    a.city || a.town || a.village || a.municipality || a.city_district || a.suburb || null;
  const phone =
    data.extratags?.phone ||
    data.extratags?.contact_phone ||
    data.extratags?.["contact:phone"] ||
    a.phone ||
    null;

  return {
    addressLine1: street || data.display_name?.split(",")[0] || null,
    city,
    region: a.state || a.region || null,
    postalCode: a.postcode || null,
    country: (a.country_code || "id").toUpperCase(),
    latitude: lat,
    longitude: lng,
    phone,
    source: "nominatim",
    warnings: phone ? [] : [],
  };
}

async function reverseGoogle(lat: number, lng: number): Promise<MapsPlaceDraft | null> {
  const key = await mapsApiKey();
  if (!key) return null;

  const qs = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key,
    language: "id",
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${qs}`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status: string;
    results?: Array<{
      formatted_address?: string;
      place_id?: string;
      types?: string[];
      address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
      geometry?: { location?: { lat: number; lng: number } };
    }>;
  };
  if (data.status !== "OK" || !data.results?.length) return null;

  const r = pickGeocodeResult(data.results);
  if (!r) return null;
  const comps = r.address_components || [];
  const pick = (...types: string[]) =>
    comps.find((c) => types.some((t) => c.types.includes(t)))?.long_name || null;
  const pickShort = (...types: string[]) =>
    comps.find((c) => types.some((t) => c.types.includes(t)))?.short_name || null;

  const route = pick("route");
  const streetNumber = pick("street_number");
  const addressLine1 = [streetNumber, route].filter(Boolean).join(" ") || r.formatted_address;

  return {
    addressLine1,
    city:
      pick("locality", "administrative_area_level_2") ||
      pick("sublocality", "sublocality_level_1"),
    region: pick("administrative_area_level_1"),
    postalCode: pick("postal_code"),
    country: pickShort("country") || "ID",
    latitude: r.geometry?.location?.lat ?? lat,
    longitude: r.geometry?.location?.lng ?? lng,
    placeId: r.place_id || null,
    source: "google_geocoding",
    warnings: [],
  };
}

type PlaceDetails = {
  name?: string | null;
  phone?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
};

async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const key = await mapsApiKey();
  if (!key) return null;

  // Classic Place Details — needs Places API enabled on the key
  const qs = new URLSearchParams({
    place_id: placeId,
    fields:
      "name,formatted_phone_number,international_phone_number,formatted_address,address_component,geometry,website,place_id",
    key,
    language: "id",
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${qs}`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    result?: {
      name?: string;
      formatted_phone_number?: string;
      international_phone_number?: string;
      formatted_address?: string;
      website?: string;
      place_id?: string;
      address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
      geometry?: { location?: { lat: number; lng: number } };
    };
  };

  if (data.status !== "OK" || !data.result) {
    return null;
  }

  const r = data.result;
  const comps = r.address_components || [];
  const pick = (...types: string[]) =>
    comps.find((c) => types.some((t) => c.types.includes(t)))?.long_name || null;
  const pickShort = (...types: string[]) =>
    comps.find((c) => types.some((t) => c.types.includes(t)))?.short_name || null;
  const route = pick("route");
  const streetNumber = pick("street_number");
  const addressLine1 =
    [streetNumber, route].filter(Boolean).join(" ") ||
    r.formatted_address?.split(",")[0] ||
    null;

  return {
    name: r.name || null,
    phone: r.international_phone_number || r.formatted_phone_number || null,
    website: r.website || null,
    addressLine1,
    city:
      pick("locality", "administrative_area_level_2") ||
      pick("sublocality", "sublocality_level_1"),
    region: pick("administrative_area_level_1"),
    postalCode: pick("postal_code"),
    country: pickShort("country") || "ID",
    latitude: r.geometry?.location?.lat ?? null,
    longitude: r.geometry?.location?.lng ?? null,
    placeId: r.place_id || placeId,
  };
}

/** Resolve place_id via Find Place (name near coordinates) then details for phone. */
async function findPlaceWithPhone(
  name: string,
  lat: number,
  lng: number
): Promise<PlaceDetails | null> {
  const key = await mapsApiKey();
  if (!key || !name.trim()) return null;

  const qs = new URLSearchParams({
    input: name.trim(),
    inputtype: "textquery",
    fields: "place_id,name",
    locationbias: `point:${lat},${lng}`,
    key,
    language: "id",
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${qs}`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status: string;
    candidates?: Array<{ place_id?: string }>;
  };
  const placeId = data.candidates?.[0]?.place_id;
  if (!placeId) return null;
  return fetchPlaceDetails(placeId);
}

/** Closest establishment at the pin — used when the Maps slug is an address. */
async function nearbyEstablishment(
  lat: number,
  lng: number,
  hintName?: string | null
): Promise<PlaceDetails | null> {
  const key = await mapsApiKey();
  if (!key) return null;

  const qs = new URLSearchParams({
    location: `${lat},${lng}`,
    rankby: "distance",
    type: "establishment",
    key,
    language: "id",
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${qs}`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status: string;
    results?: Array<{ place_id?: string; name?: string }>;
  };
  const rows = data.results || [];
  const candidate =
    rows.find((r) => r.place_id && shouldAdoptPlace(hintName, r.name)) ||
    (!hintName || looksLikeStreetName(hintName)
      ? rows.find((r) => r.place_id && !looksLikeStreetName(r.name))
      : undefined);
  if (!candidate?.place_id) return null;
  return fetchPlaceDetails(candidate.place_id);
}

/**
 * Resolve a Google Maps URL into draft location fields for the create form.
 * Phone requires Google Places API (same Maps key) or rare Nominatim extratags.
 */
export async function draftFromMapsUrl(rawUrl: string): Promise<MapsPlaceDraft> {
  const warnings: string[] = [];
  if (!rawUrl?.trim()) {
    throw new Error("Maps URL is required");
  }

  const finalUrl = await resolveMapsUrl(rawUrl);
  const nameFromUrl = parsePlaceNameFromMapsUrl(finalUrl);
  const coords = parseCoordsFromMapsUrl(finalUrl);
  let placeId = parsePlaceIdFromMapsUrl(finalUrl);

  if (!coords && !placeId) {
    throw new Error(
      "Could not read coordinates or place id from this URL. Open the place in Google Maps, copy the full link (with @lat,lng), or use maps.app.goo.gl share link."
    );
  }

  // 1) Places Details first (phone + website)
  let places: PlaceDetails | null = null;
  if (placeId) {
    places = await fetchPlaceDetails(placeId);
    if (!places) {
      warnings.push(
        "Place Details failed for this URL (enable Places API on your Google Maps key, or place id not supported)."
      );
    }
  }

  // 2) Reverse geocode for address components
  let geo: MapsPlaceDraft | null = null;
  if (coords) {
    geo =
      (await reverseGoogle(coords.lat, coords.lng)) ||
      (await reverseNominatim(coords.lat, coords.lng));

    // Geocode often returns a better place_id than the URL hex cid —
    // but that id is frequently the street or a neighbor at the camera pin.
    if (!places && geo?.placeId) {
      const geoPlace = await fetchPlaceDetails(geo.placeId);
      if (geoPlace && shouldAdoptPlace(nameFromUrl, geoPlace.name)) {
        placeId = geo.placeId;
        places = geoPlace;
      }
    }

    const needsBusiness =
      !resolveStoreName(nameFromUrl, places?.name) || !places?.phone;

    // 3) Find Place by slug/name near pin (address queries often resolve to the shop)
    if (needsBusiness) {
      const searchName = resolveStoreName(nameFromUrl, places?.name) || nameFromUrl || "";
      if (searchName) {
        const found = await findPlaceWithPhone(searchName, coords.lat, coords.lng);
        if (found && shouldAdoptPlace(nameFromUrl || searchName, found.name)) {
          places = mergePlaceDetails(places, found);
          if (found.placeId && preferBusinessName(found.name)) {
            placeId = found.placeId;
          }
        }
      }
    }

    // 4) Nearby — only when we still lack a matching shop (never a different neighbor)
    if (!resolveStoreName(nameFromUrl, places?.name) || !places?.phone) {
      const near = await nearbyEstablishment(
        coords.lat,
        coords.lng,
        nameFromUrl || places?.name
      );
      if (near && shouldAdoptPlace(nameFromUrl || places?.name, near.name)) {
        places = mergePlaceDetails(places, near);
        if (near.placeId && preferBusinessName(near.name)) {
          placeId = near.placeId;
        }
      }
    }
  }

  if (!geo && !places) {
    if (coords) {
      warnings.push("Reverse geocode unavailable — filled coordinates only");
      geo = {
        latitude: coords.lat,
        longitude: coords.lng,
        country: "ID",
        source: "url_parse",
        warnings: [],
      };
    } else {
      throw new Error("Could not resolve place details for this Maps URL.");
    }
  }

  const name = resolveStoreName(nameFromUrl, places?.name);
  if (!name && (places?.name || nameFromUrl)) {
    warnings.push(
      "Store name on this link is a street/address. We left name empty — type the brand on the sign, or paste a pin on the shop."
    );
  }

  const phone = places?.phone || geo?.phone || null;
  if (!phone) {
    const key = await mapsApiKey();
    if (!key) {
      warnings.push(
        "Phone not filled — add a Google Maps / Places API key in Settings → API Configuration to pull phone numbers."
      );
    } else {
      warnings.push(
        "Phone not available for this place (missing on Google, or Places API not enabled for the key)."
      );
    }
  }

  const source: MapsPlaceDraft["source"] = places
    ? "google_places"
    : geo?.source || "url_parse";

  return {
    name,
    addressLine1: places?.addressLine1 || geo?.addressLine1 || null,
    city: places?.city || geo?.city || null,
    region: places?.region || geo?.region || null,
    postalCode: places?.postalCode || geo?.postalCode || null,
    country: places?.country || geo?.country || "ID",
    latitude: places?.latitude ?? geo?.latitude ?? coords?.lat ?? null,
    longitude: places?.longitude ?? geo?.longitude ?? coords?.lng ?? null,
    phone,
    website: places?.website || null,
    mapsUrl: finalUrl,
    placeId: places?.placeId || placeId || geo?.placeId || null,
    source,
    warnings: [...warnings, ...(geo?.warnings || [])],
  };
}

/** Recover ChIJ / feature id when the stored Maps link was shortened to name + pin. */
export async function resolvePlaceIdFromHint(opts: {
  mapsUrl?: string | null;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<{ placeId: string | null; featureId: string | null; name: string | null }> {
  const url = opts.mapsUrl || "";
  let featureId = parseMapsFeatureId(url);
  const parsed = parsePlaceIdFromMapsUrl(url);
  if (parsed?.includes(":")) featureId = featureId || parsed;
  let placeId =
    parsed && (parsed.startsWith("ChIJ") || !parsed.includes(":")) ? parsed : null;

  const name = resolveStoreName(opts.name, parsePlaceNameFromMapsUrl(url));
  const coords =
    opts.latitude != null && opts.longitude != null
      ? { lat: opts.latitude, lng: opts.longitude }
      : parseCoordsFromMapsUrl(url);

  if (!placeId && name && coords) {
    const found = await findPlaceWithPhone(name, coords.lat, coords.lng);
    if (found?.placeId && shouldAdoptPlace(name, found.name)) {
      placeId = found.placeId;
    }
  }
  if (!placeId && coords) {
    const near = await nearbyEstablishment(coords.lat, coords.lng, name);
    if (near?.placeId && shouldAdoptPlace(name, near.name)) {
      placeId = near.placeId;
    }
  }

  return { placeId, featureId, name };
}
