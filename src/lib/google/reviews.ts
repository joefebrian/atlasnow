/**
 * Google My Business API v4 — reviews list + owner reply.
 * Parent: accounts/{accountId}/locations/{locationId}
 * Docs: accounts.locations.reviews
 */

import { googleFetch, googleErrorMessage } from "@/lib/google/http";
import { toLocationResourceName } from "@/lib/google/http";

export type GoogleReview = {
  name: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string; isAnonymous?: boolean };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
};

const STAR_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  STAR_RATING_UNSPECIFIED: 0,
};

export function starRatingToInt(star?: string): number {
  if (!star) return 0;
  if (STAR_MAP[star] != null) return STAR_MAP[star];
  const n = Number(star);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build accounts/x/locations/y parent from stored externalId.
 */
export function toReviewsParent(externalId: string): string {
  const trimmed = externalId.trim().replace(/\/reviews\/.*$/, "");
  if (trimmed.startsWith("accounts/") && trimmed.includes("/locations/")) {
    return trimmed;
  }
  // locations/{id} alone cannot list reviews without account — caller must store full path
  if (trimmed.startsWith("locations/")) {
    throw new Error(
      `Review sync needs full Google resource name (accounts/…/locations/…), got: ${trimmed}`
    );
  }
  return toLocationResourceName(trimmed);
}

export async function listGoogleReviews(
  accessToken: string,
  locationExternalId: string
): Promise<GoogleReview[]> {
  const parent = toReviewsParent(locationExternalId);
  const out: GoogleReview[] = [];
  let pageToken: string | undefined;

  do {
    const qs = new URLSearchParams({ pageSize: "50" });
    if (pageToken) qs.set("pageToken", pageToken);
    const url = `https://mybusiness.googleapis.com/v4/${parent}/reviews?${qs}`;
    const { ok, status, json } = await googleFetch(url, accessToken);
    if (!ok) {
      throw new Error(googleErrorMessage(json, status));
    }
    const data = json as { reviews?: GoogleReview[]; nextPageToken?: string };
    out.push(...(data.reviews || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}

export async function updateGoogleReviewReply(
  accessToken: string,
  reviewName: string,
  comment: string
): Promise<{ comment?: string; updateTime?: string }> {
  // reviewName = accounts/.../locations/.../reviews/...
  // reply resource = {reviewName}/reply
  const url = `https://mybusiness.googleapis.com/v4/${reviewName}/reply`;
  const { ok, status, json } = await googleFetch(url, accessToken, {
    method: "PUT",
    body: JSON.stringify({ comment }),
  });
  if (!ok) {
    throw new Error(googleErrorMessage(json, status));
  }
  return json as { comment?: string; updateTime?: string };
}

export async function deleteGoogleReviewReply(
  accessToken: string,
  reviewName: string
): Promise<void> {
  const url = `https://mybusiness.googleapis.com/v4/${reviewName}/reply`;
  const { ok, status, json } = await googleFetch(url, accessToken, {
    method: "DELETE",
  });
  if (!ok && status !== 404) {
    throw new Error(googleErrorMessage(json, status));
  }
}
