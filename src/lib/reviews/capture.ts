import { randomBytes } from "node:crypto";
import {
  mapsUrlFromLocation,
  parsePlaceIdFromMapsUrl,
} from "@/lib/locations/maps-url";
import { appBaseUrl } from "@/lib/loyalty/members";

const UTM_MAX = 80;
const UTM_OK = /[^a-zA-Z0-9._-]+/g;

/** Places write-review ids. Maps 0x:0x feature ids do not work on writereview. */
export function isWritablePlaceId(id: string | null | undefined): boolean {
  const s = (id || "").trim();
  if (!s) return false;
  if (s.includes(":")) return false;
  if (s.startsWith("ChIJ") || s.startsWith("GhIJ")) return true;
  return /^[A-Za-z0-9_-]{16,}$/.test(s);
}

export function writeReviewUrl(placeId: string | null | undefined): string | null {
  if (!isWritablePlaceId(placeId)) return null;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId!.trim())}`;
}

/** Active Maps/GBP mapping ids, plus placeId stashed in metaJson (review pull stores feature id as externalId). */
export function mappingPlaceIdCandidates(
  mappings: {
    sourceType: string;
    externalId: string;
    status: string;
    metaJson?: string | null;
  }[],
): string[] {
  const out: string[] = [];
  for (const m of mappings) {
    if (m.status !== "ACTIVE") continue;
    if (m.sourceType !== "GOOGLE_MAPS" && m.sourceType !== "GOOGLE_BUSINESS_PROFILE") continue;
    const id = (m.externalId || "").trim();
    if (id) out.push(id);
    if (!m.metaJson) continue;
    try {
      const meta = JSON.parse(m.metaJson) as { placeId?: unknown };
      if (typeof meta.placeId === "string" && meta.placeId.trim()) {
        out.push(meta.placeId.trim());
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

export function placeIdFromInputs(opts: {
  website?: string | null;
  notes?: string | null;
  mappingExternalIds?: string[];
}): string | null {
  for (const raw of opts.mappingExternalIds || []) {
    const id = raw.trim();
    if (isWritablePlaceId(id)) return id;
    const fromMap = parsePlaceIdFromMapsUrl(id) || parsePlaceIdFromMapsUrl(`https://www.google.com/maps/place/?q=place_id:${id}`);
    if (isWritablePlaceId(fromMap)) return fromMap;
  }
  const mapsUrl = mapsUrlFromLocation({ website: opts.website, notes: opts.notes });
  if (mapsUrl) {
    const parsed = parsePlaceIdFromMapsUrl(mapsUrl);
    if (isWritablePlaceId(parsed)) return parsed;
  }
  return null;
}

export function sanitizeUtmValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(UTM_OK, "").slice(0, UTM_MAX);
  return cleaned || null;
}

export function parseCaptureUtm(params: URLSearchParams): {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
} {
  return {
    utmSource: sanitizeUtmValue(params.get("utm_source")),
    utmMedium: sanitizeUtmValue(params.get("utm_medium")),
    utmCampaign: sanitizeUtmValue(params.get("utm_campaign")),
    utmContent: sanitizeUtmValue(params.get("utm_content")),
  };
}

export function estimatedCaptureRate(intents: number, newReviews: number): number | null {
  if (intents <= 0) return null;
  return newReviews / intents;
}

export function capturePublicPath(token: string): string {
  return `/r/${encodeURIComponent(token)}`;
}

export function capturePublicUrl(token: string): string {
  return `${appBaseUrl()}${capturePublicPath(token)}`;
}

export function newCaptureToken(): string {
  return randomBytes(12).toString("base64url");
}

export function coarseDevice(ua: string | null | undefined): "mobile" | "tablet" | "desktop" | null {
  if (!ua) return null;
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobile|iphone|android/.test(s)) return "mobile";
  return "desktop";
}

export function captureWindowStart(now = new Date(), days = 30): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function formatEstimatedRate(rate: number | null): string {
  if (rate == null) return "—";
  return `~${Math.round(rate * 100)}%`;
}
