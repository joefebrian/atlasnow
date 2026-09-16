/**
 * Pull public Google Maps reviews for an outlet.
 *
 * 1) listugcposts (newest, paginated) when we have a 0x:0x feature id
 * 2) Places Details reviews_sort=newest (max ~5) when a Maps API key exists
 *
 * Session: cookie warmup on Maps, same-origin headers, stop the RPC circuit
 * for 30 minutes after 403/429. No proxies, no captcha, no TLS impersonation.
 */

import {
  mapsUrlFromLocation,
  parseMapsFeatureId,
  parsePlaceIdFromMapsUrl,
  parsePlaceNameFromMapsUrl,
  resolveMapsUrl,
  resolvePlaceIdFromHint,
} from "@/lib/locations/maps-url";
import { resolvedMapsApiKey } from "@/lib/integrations/service";
import { sleep } from "@/lib/google/rate-limit";
import {
  buildListUgcPostsUrl,
  lookbackDecision,
  parseListUgcPosts,
  parsePlacesReviews,
  type MapsReview,
} from "@/lib/reviews/maps-parse";
import {
  extractMapsIdsFromHtml,
  isMapsRpcBlocked,
  looksBlocked,
  MapsHttpSession,
  markMapsRpcBlocked,
} from "@/lib/reviews/maps-http";

export { buildListUgcPostsUrl } from "@/lib/reviews/maps-parse";

const MAX_PAGES = 20;
const PAGE_GAP_MS = 1200;

export type MapsPullSource = "maps_rpc" | "places";

export type MapsPullResult = {
  reviews: MapsReview[];
  source: MapsPullSource;
  featureId: string | null;
  placeId: string | null;
  mapsUrl: string;
  truncated: boolean;
  warning: string | null;
  windowLabel: string;
  stepIndex: number;
};

function randomRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const b64 = Buffer.from(bytes).toString("base64url");
  return b64.slice(0, 21);
}

export async function fetchListUgcPostsPage(opts: {
  featureId: string;
  pageToken?: string;
  requestId: string;
  referer?: string;
  session: MapsHttpSession;
}): Promise<{ reviews: MapsReview[]; nextPageToken: string | null; blocked: string | null }> {
  if (isMapsRpcBlocked()) {
    return {
      reviews: [],
      nextPageToken: null,
      blocked: "Public Maps feed is paused after Google blocked this server.",
    };
  }
  const url = buildListUgcPostsUrl({
    featureId: opts.featureId,
    pageToken: opts.pageToken,
    requestId: opts.requestId,
  });
  const { status, body, url: finalUrl } = await opts.session.get(url, {
    referer: opts.referer,
    rpc: true,
  });
  const blocked = looksBlocked(status, body, finalUrl);
  if (blocked) {
    if (status === 403 || status === 429) markMapsRpcBlocked();
    return { reviews: [], nextPageToken: null, blocked };
  }
  const parsed = parseListUgcPosts(body, opts.featureId);
  if (!parsed.reviews.length && body.length < 80) {
    return {
      reviews: [],
      nextPageToken: null,
      blocked: "Public Maps feed returned an empty payload.",
    };
  }
  return { reviews: parsed.reviews, nextPageToken: parsed.nextPageToken, blocked: null };
}

export async function fetchPlacesNewestReviews(placeId: string): Promise<{
  reviews: MapsReview[];
  error: string | null;
}> {
  if (!placeId.startsWith("ChIJ") && !/^[A-Za-z0-9_-]{10,}$/.test(placeId)) {
    return { reviews: [], error: null };
  }
  const key = await resolvedMapsApiKey();
  if (!key) {
    return {
      reviews: [],
      error: "No Google Maps / Places API key — add one in Settings → API to use the Places fallback.",
    };
  }

  const qs = new URLSearchParams({
    place_id: placeId,
    fields: "reviews,name,place_id,rating,user_ratings_total",
    reviews_sort: "newest",
    key,
    language: "id",
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${qs}`);
  if (!res.ok) {
    return { reviews: [], error: `Places Details HTTP ${res.status}` };
  }
  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    result?: {
      place_id?: string;
      reviews?: Array<{
        author_name?: string;
        rating?: number;
        text?: string;
        time?: number;
        relative_time_description?: string;
      }>;
    };
  };
  if (data.status !== "OK" || !data.result) {
    return {
      reviews: [],
      error: data.error_message || `Places Details ${data.status}`,
    };
  }
  return { reviews: parsePlacesReviews(data.result), error: null };
}

export async function resolveMapsReviewTarget(
  rawUrl: string,
  session?: MapsHttpSession,
  hint?: { name?: string | null; latitude?: number | null; longitude?: number | null }
): Promise<{
  mapsUrl: string;
  featureId: string | null;
  placeId: string | null;
  name: string | null;
  warmupBlocked: string | null;
}> {
  const mapsUrl = await resolveMapsUrl(rawUrl);
  let featureId = parseMapsFeatureId(mapsUrl);
  const parsedPlace = parsePlaceIdFromMapsUrl(mapsUrl);
  let placeId =
    parsedPlace && parsedPlace.startsWith("ChIJ")
      ? parsedPlace
      : parsedPlace && !parsedPlace.includes(":")
        ? parsedPlace
        : null;
  let warmupBlocked: string | null = null;
  let name = hint?.name || parsePlaceNameFromMapsUrl(mapsUrl);

  if (session) {
    const warmed = await session.warmup(mapsUrl);
    const fromHtml = extractMapsIdsFromHtml(warmed.html);
    featureId = featureId || fromHtml.featureId;
    placeId = placeId || fromHtml.placeId;
    warmupBlocked = looksBlocked(warmed.status, warmed.html, warmed.finalUrl);
    if (warmed.status === 403 || warmed.status === 429) markMapsRpcBlocked();
  }

  if (!placeId || !featureId) {
    const fromPlaces = await resolvePlaceIdFromHint({
      mapsUrl,
      name: name || hint?.name,
      latitude: hint?.latitude,
      longitude: hint?.longitude,
    });
    placeId = placeId || fromPlaces.placeId;
    featureId = featureId || fromPlaces.featureId;
    name = name || fromPlaces.name;
  }

  if (session && placeId && !featureId && !isMapsRpcBlocked()) {
    const pidUrl = `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
    const page = await session.get(pidUrl, {
      navigation: true,
      referer: mapsUrl,
    });
    const fromPid = extractMapsIdsFromHtml(page.body);
    featureId = featureId || fromPid.featureId;
  }

  return {
    mapsUrl,
    featureId,
    placeId,
    name,
    warmupBlocked,
  };
}

export function mapsUrlForLocation(loc: {
  website?: string | null;
  notes?: string | null;
}): string {
  return mapsUrlFromLocation(loc);
}

function fallbackNote(stepIndex: number, label: string): string | null {
  if (stepIndex <= 0) return null;
  return `No reviews in the last 1 month — used ${label}.`;
}

export async function pullMapsReviews(opts: {
  mapsUrl: string;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  maxPages?: number;
}): Promise<MapsPullResult> {
  const maxPages = Math.min(opts.maxPages ?? MAX_PAGES, 24);
  const session = new MapsHttpSession();
  const target = await resolveMapsReviewTarget(opts.mapsUrl, session, {
    name: opts.name,
    latitude: opts.latitude,
    longitude: opts.longitude,
  });
  const nowMs = Date.now();

  const rpcReviews: MapsReview[] = [];
  let rpcBlocked: string | null = null;
  let truncated = false;

  if (target.warmupBlocked) {
    rpcBlocked = target.warmupBlocked;
  } else if (target.featureId && !isMapsRpcBlocked()) {
    const requestId = randomRequestId();
    let pageToken: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      if (page > 0) await sleep(PAGE_GAP_MS);
      const batch = await fetchListUgcPostsPage({
        featureId: target.featureId,
        pageToken,
        requestId,
        referer: target.mapsUrl,
        session,
      });
      if (batch.blocked) {
        rpcBlocked = batch.blocked;
        break;
      }
      if (!batch.reviews.length) break;
      rpcReviews.push(...batch.reviews);
      const noMore = !batch.nextPageToken;
      const decision = lookbackDecision(rpcReviews, nowMs, { noMorePages: noMore });
      if (decision.donePaging) break;
      if (noMore) break;
      pageToken = batch.nextPageToken || undefined;
      if (page === maxPages - 1) truncated = true;
    }
  }

  const rpcPick = lookbackDecision(rpcReviews, nowMs, { noMorePages: true });
  if (rpcPick.reviews.length > 0) {
    const notes = [
      fallbackNote(rpcPick.stepIndex, rpcPick.label),
      truncated
        ? `Stopped after ${maxPages} pages — Google still had older reviews.`
        : null,
    ].filter(Boolean);
    return {
      reviews: rpcPick.reviews,
      source: "maps_rpc",
      featureId: target.featureId,
      placeId: target.placeId,
      mapsUrl: target.mapsUrl,
      truncated,
      warning: notes.join(" ") || null,
      windowLabel: rpcPick.label,
      stepIndex: rpcPick.stepIndex,
    };
  }

  const placeId = target.placeId;
  if (placeId) {
    const places = await fetchPlacesNewestReviews(placeId);
    const pick = lookbackDecision(places.reviews, nowMs, { noMorePages: true });
    const warningParts: string[] = [];
    if (rpcBlocked) warningParts.push(rpcBlocked);
    else if (target.featureId) {
      warningParts.push("Public Maps feed had no reviews in the lookback.");
    }
    if (places.error) warningParts.push(places.error);
    const fb = fallbackNote(pick.stepIndex, pick.label);
    if (fb) warningParts.push(fb);
    warningParts.push(
      "Places API only returns the latest handful of public reviews. Connect Google Business Profile for the complete inbox and replies."
    );
    return {
      reviews: pick.reviews,
      source: "places",
      featureId: target.featureId,
      placeId,
      mapsUrl: target.mapsUrl,
      truncated: true,
      warning: warningParts.filter(Boolean).join(" "),
      windowLabel: pick.label,
      stepIndex: pick.stepIndex,
    };
  }

  throw new Error(
    rpcBlocked ||
      "Could not read reviews from this Maps link. Open the outlet in Google Maps, copy the full place link (with 0x…:0x… or place_id), save it on the outlet, then try again. Or connect Google Business Profile."
  );
}
