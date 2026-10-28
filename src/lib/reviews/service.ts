import { prisma } from "@/lib/db";
import { GOOGLE_PROVIDER } from "@/lib/google/config";
import { getValidAccessToken } from "@/lib/google/oauth";
import {
  listGoogleReviews,
  starRatingToInt,
  updateGoogleReviewReply,
} from "@/lib/google/reviews";
import { getAgencyTenant } from "@/lib/google/connector";
import { sleep } from "@/lib/google/rate-limit";

export type ReviewListItem = {
  id: string;
  externalId: string;
  sourceType: string;
  canPublish: boolean;
  reviewerName: string | null;
  starRating: number;
  comment: string | null;
  createTime: string | null;
  updateTime: string | null;
  replyComment: string | null;
  replyUpdateTime: string | null;
  replied: boolean;
  locationId: string;
  locationName: string;
  locationCode: string | null;
  clientName: string;
  draft: null | {
    id: string;
    body: string;
    status: string;
    lastError: string | null;
    updatedAt: string;
  };
};

export async function listReviewsForSession(opts: {
  tenantId: string;
  q?: string;
  filter?: "all" | "unreplied" | "1" | "2" | "3" | "4" | "5" | "lte3";
  locationId?: string;
}): Promise<ReviewListItem[]> {
  const locationWhere = {
    status: { not: "ARCHIVED" as const },
    tenantId: opts.tenantId,
  };

  const starFilter =
    opts.filter === "unreplied" || !opts.filter || opts.filter === "all"
      ? {}
      : opts.filter === "lte3"
        ? { starRating: { gte: 1, lte: 3 } }
        : { starRating: Number(opts.filter) };

  const reviews = await prisma.review.findMany({
    where: {
      location: locationWhere,
      ...(opts.locationId ? { locationId: opts.locationId } : {}),
      ...(opts.filter === "unreplied" ? { replyComment: null } : {}),
      ...starFilter,
      ...(opts.q
        ? {
            OR: [
              { reviewerName: { contains: opts.q } },
              { comment: { contains: opts.q } },
              { location: { name: { contains: opts.q } } },
            ],
          }
        : {}),
    },
    include: {
      location: {
        select: {
          id: true,
          name: true,
          code: true,
          tenant: { select: { name: true } },
        },
      },
      drafts: {
        where: { status: { in: ["DRAFT", "PENDING_APPROVAL", "FAILED"] } },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ updateTime: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  return reviews.map((r) => {
    const draft = r.drafts[0];
    return {
      id: r.id,
      externalId: r.externalId,
      sourceType: r.sourceType,
      canPublish:
        r.sourceType === "GOOGLE_BUSINESS_PROFILE" &&
        r.externalId.startsWith("accounts/"),
      reviewerName: r.reviewerName,
      starRating: r.starRating,
      comment: r.comment,
      createTime: r.createTime?.toISOString() ?? null,
      updateTime: r.updateTime?.toISOString() ?? null,
      replyComment: r.replyComment,
      replyUpdateTime: r.replyUpdateTime?.toISOString() ?? null,
      replied: Boolean(r.replyComment?.trim()),
      locationId: r.locationId,
      locationName: r.location.name,
      locationCode: r.location.code,
      clientName: r.location.tenant.name,
      draft: draft
        ? {
            id: draft.id,
            body: draft.body,
            status: draft.status,
            lastError: draft.lastError,
            updatedAt: draft.updatedAt.toISOString(),
          }
        : null,
    };
  });
}

/**
 * Pull reviews from Google for all (or one) mapped GBP locations.
 */
export async function syncReviewsFromGoogle(opts?: {
  locationId?: string;
  tenantId?: string;
}): Promise<{
  locationsTried: number;
  upserted: number;
  errors: string[];
  source: "google";
}> {
  const agency = await getAgencyTenant();
  if (!agency) throw new Error("Agency tenant missing");

  const connector = await prisma.connector.findUnique({
    where: {
      tenantId_provider_accountKey: { tenantId: agency.id, provider: GOOGLE_PROVIDER, accountKey: "" },
    },
  });
  if (!connector || connector.status === "DISCONNECTED" || connector.mode === "MOCK") {
    throw new Error(
      "Connect Google Business Profile (LIVE) on Data Health before syncing reviews."
    );
  }

  const token = await getValidAccessToken(connector.id);
  if (!token || token === "mock-access-token") {
    throw new Error("No valid Google access token. Reconnect Google on Data Health.");
  }

  const mappings = await prisma.sourceMapping.findMany({
    where: {
      sourceType: "GOOGLE_BUSINESS_PROFILE",
      status: "ACTIVE",
      ...(opts?.locationId ? { locationId: opts.locationId } : {}),
      location: {
        status: { not: "ARCHIVED" },
        ...(opts?.tenantId ? { tenantId: opts.tenantId } : { tenant: { type: "CLIENT" } }),
      },
    },
    include: { location: { select: { id: true, name: true } } },
  });

  if (mappings.length === 0) {
    throw new Error(
      "No Google Business Profile mappings yet. Map locations on Data Health first, then Sync reviews."
    );
  }

  let upserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < mappings.length; i++) {
    const m = mappings[i];
    if (i > 0) await sleep(500);
    try {
      const googleReviews = await listGoogleReviews(token, m.externalId);
      for (const gr of googleReviews) {
        if (!gr.name) continue;
        const star = starRatingToInt(gr.starRating);
        await prisma.review.upsert({
          where: { externalId: gr.name },
          create: {
            locationId: m.locationId,
            externalId: gr.name,
            sourceType: "GOOGLE_BUSINESS_PROFILE",
            reviewerName: gr.reviewer?.isAnonymous
              ? "Anonymous"
              : gr.reviewer?.displayName || null,
            starRating: star || 0,
            comment: gr.comment || null,
            createTime: gr.createTime ? new Date(gr.createTime) : null,
            updateTime: gr.updateTime ? new Date(gr.updateTime) : null,
            replyComment: gr.reviewReply?.comment || null,
            replyUpdateTime: gr.reviewReply?.updateTime
              ? new Date(gr.reviewReply.updateTime)
              : null,
            rawJson: JSON.stringify(gr),
            lastSyncedAt: new Date(),
          },
          update: {
            locationId: m.locationId,
            sourceType: "GOOGLE_BUSINESS_PROFILE",
            reviewerName: gr.reviewer?.isAnonymous
              ? "Anonymous"
              : gr.reviewer?.displayName || null,
            starRating: star || 0,
            comment: gr.comment || null,
            createTime: gr.createTime ? new Date(gr.createTime) : null,
            updateTime: gr.updateTime ? new Date(gr.updateTime) : null,
            replyComment: gr.reviewReply?.comment || null,
            replyUpdateTime: gr.reviewReply?.updateTime
              ? new Date(gr.reviewReply.updateTime)
              : null,
            rawJson: JSON.stringify(gr),
            lastSyncedAt: new Date(),
          },
        });
        upserted++;
      }
    } catch (e) {
      errors.push(
        `${m.location.name}: ${e instanceof Error ? e.message : "sync failed"}`
      );
    }
  }

  return {
    locationsTried: mappings.length,
    upserted,
    errors,
    source: "google",
  };
}

function mapsUrlFromMapping(externalId: string): string | null {
  const id = externalId.trim();
  if (!id) return null;
  if (id.includes(":") && /^0x/i.test(id)) {
    return `https://www.google.com/maps/place/data=!1s${id}`;
  }
  if (id.startsWith("ChIJ") || /^[A-Za-z0-9_-]{10,}$/.test(id)) {
    return `https://www.google.com/maps/place/?q=place_id:${id}`;
  }
  if (/^https?:\/\//i.test(id)) return id;
  return null;
}

/**
 * Pull public Maps reviews. Last 1 month first; if empty, the 2 months
 * before that; repeat. Does not require the Google Business Profile connector.
 */
export async function syncReviewsFromMaps(opts?: {
  locationId?: string;
  tenantId?: string;
}): Promise<{
  locationsTried: number;
  upserted: number;
  skipped: number;
  errors: string[];
  warnings: string[];
  source: "maps";
  windowLabels: string[];
  feed: "maps_rpc" | "places" | "mixed" | "none";
}> {
  const { mapsUrlForLocation, pullMapsReviews } = await import("@/lib/reviews/maps-fetch");

  const locations = await prisma.location.findMany({
    where: {
      status: { not: "ARCHIVED" },
      tenant: { type: "CLIENT", ...(opts?.tenantId ? { id: opts.tenantId } : {}) },
      ...(opts?.locationId ? { id: opts.locationId } : {}),
    },
    select: {
      id: true,
      name: true,
      website: true,
      notes: true,
      latitude: true,
      longitude: true,
      mappings: {
        where: { sourceType: "GOOGLE_MAPS", status: "ACTIVE" },
        select: { externalId: true },
      },
    },
  });

  const targets = locations
    .map((loc) => {
      const fromNotes = mapsUrlForLocation(loc);
      const fromMap = loc.mappings[0]?.externalId
        ? mapsUrlFromMapping(loc.mappings[0].externalId)
        : null;
      return { loc, mapsUrl: fromNotes || fromMap };
    })
    .filter((t): t is { loc: (typeof locations)[number]; mapsUrl: string } =>
      Boolean(t.mapsUrl)
    );

  if (targets.length === 0) {
    throw new Error(
      opts?.locationId
        ? "This outlet has no Google Maps link yet. Open the outlet, paste the Maps share URL, save, then pull again."
        : "No outlet has a Google Maps link yet. Open an outlet, paste the Maps share URL, save, then Pull from Maps."
    );
  }

  let upserted = 0;
  let skipped = 0;
  const errors: string[] = [];
  const warnings: string[] = [];
  const windowLabels: string[] = [];
  const feeds = new Set<"maps_rpc" | "places">();

  for (let i = 0; i < targets.length; i++) {
    const { loc, mapsUrl } = targets[i];
    if (i > 0) await sleep(2500);
    try {
      const pulled = await pullMapsReviews({
        mapsUrl,
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      feeds.add(pulled.source);
      if (pulled.windowLabel) windowLabels.push(`${loc.name}: ${pulled.windowLabel}`);
      if (pulled.warning) warnings.push(`${loc.name}: ${pulled.warning}`);

      const mapKey = pulled.featureId || pulled.placeId;
      if (mapKey) {
        const existingMap = await prisma.sourceMapping.findUnique({
          where: {
            sourceType_externalId: { sourceType: "GOOGLE_MAPS", externalId: mapKey },
          },
        });
        const metaJson = JSON.stringify({
          mapsUrl: pulled.mapsUrl,
          featureId: pulled.featureId,
          placeId: pulled.placeId,
          feed: pulled.source,
        });
        if (!existingMap) {
          await prisma.sourceMapping.create({
            data: {
              locationId: loc.id,
              sourceType: "GOOGLE_MAPS",
              externalId: mapKey,
              externalLabel: loc.name,
              confidence: "MEDIUM",
              status: "ACTIVE",
              metaJson,
            },
          });
        } else if (existingMap.locationId === loc.id) {
          await prisma.sourceMapping.update({
            where: { id: existingMap.id },
            data: { externalLabel: loc.name, status: "ACTIVE", metaJson },
          });
        }
      }

      if (pulled.reviews.length === 0) {
        skipped += 1;
        continue;
      }

      for (const gr of pulled.reviews) {
        await prisma.review.upsert({
          where: { externalId: gr.externalId },
          create: {
            locationId: loc.id,
            externalId: gr.externalId,
            sourceType: "GOOGLE_MAPS",
            reviewerName: gr.reviewerName,
            starRating: gr.starRating,
            comment: gr.comment,
            createTime: gr.createTime,
            updateTime: gr.updateTime,
            replyComment: gr.replyComment,
            replyUpdateTime: gr.replyUpdateTime,
            rawJson: JSON.stringify({ feed: pulled.source, review: gr.raw }),
            lastSyncedAt: new Date(),
          },
          update: {
            locationId: loc.id,
            sourceType: "GOOGLE_MAPS",
            reviewerName: gr.reviewerName,
            starRating: gr.starRating,
            comment: gr.comment,
            createTime: gr.createTime,
            updateTime: gr.updateTime,
            replyComment: gr.replyComment,
            replyUpdateTime: gr.replyUpdateTime,
            rawJson: JSON.stringify({ feed: pulled.source, review: gr.raw }),
            lastSyncedAt: new Date(),
          },
        });
        upserted += 1;
      }
    } catch (e) {
      errors.push(`${loc.name}: ${e instanceof Error ? e.message : "Maps pull failed"}`);
    }
  }

  const feed =
    feeds.size === 0 ? "none" : feeds.size === 2 ? "mixed" : [...feeds][0];

  return {
    locationsTried: targets.length,
    upserted,
    skipped,
    errors,
    warnings,
    source: "maps",
    windowLabels,
    feed,
  };
}

export async function saveReviewDraft(opts: {
  reviewId: string;
  body: string;
  authorId?: string;
}) {
  const body = opts.body.trim();
  if (body.length < 2) throw new Error("Reply text is too short");
  if (body.length > 4000) throw new Error("Reply text is too long (max 4000)");

  const review = await prisma.review.findUnique({ where: { id: opts.reviewId } });
  if (!review) throw new Error("Review not found");

  const existing = await prisma.reviewReplyDraft.findFirst({
    where: {
      reviewId: opts.reviewId,
      status: { in: ["DRAFT", "PENDING_APPROVAL", "FAILED"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    return prisma.reviewReplyDraft.update({
      where: { id: existing.id },
      data: {
        body,
        status: "DRAFT",
        authorId: opts.authorId,
        lastError: null,
      },
    });
  }

  return prisma.reviewReplyDraft.create({
    data: {
      reviewId: opts.reviewId,
      body,
      status: "DRAFT",
      authorId: opts.authorId,
    },
  });
}

/**
 * Publish draft reply to Google (same page — updateReply).
 */
export async function publishReviewReply(opts: {
  reviewId: string;
  body?: string;
  authorId?: string;
}) {
  const review = await prisma.review.findUnique({ where: { id: opts.reviewId } });
  if (!review) throw new Error("Review not found");

  let body = opts.body?.trim();
  let draft = await prisma.reviewReplyDraft.findFirst({
    where: {
      reviewId: opts.reviewId,
      status: { in: ["DRAFT", "PENDING_APPROVAL", "FAILED"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (body) {
    draft = await saveReviewDraft({
      reviewId: opts.reviewId,
      body,
      authorId: opts.authorId,
    });
  } else {
    body = draft?.body?.trim();
  }

  if (!body) throw new Error("No reply text to publish");

  if (
    review.sourceType === "GOOGLE_MAPS" ||
    !review.externalId.startsWith("accounts/")
  ) {
    throw new Error(
      "This review came from the Maps pull. Connect Google Business Profile on Data Health to publish the reply on Google."
    );
  }

  const agency = await getAgencyTenant();
  if (!agency) throw new Error("Agency tenant missing");
  const connector = await prisma.connector.findUnique({
    where: {
      tenantId_provider_accountKey: { tenantId: agency.id, provider: GOOGLE_PROVIDER, accountKey: "" },
    },
  });
  if (!connector || connector.mode !== "LIVE") {
    throw new Error("LIVE Google connector required to publish replies");
  }

  const token = await getValidAccessToken(connector.id);
  if (!token || token === "mock-access-token") {
    throw new Error("No valid Google access token");
  }

  try {
    const reply = await updateGoogleReviewReply(token, review.externalId, body);
    await prisma.review.update({
      where: { id: review.id },
      data: {
        replyComment: reply.comment || body,
        replyUpdateTime: reply.updateTime ? new Date(reply.updateTime) : new Date(),
      },
    });
    if (draft) {
      await prisma.reviewReplyDraft.update({
        where: { id: draft.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          lastError: null,
          body,
        },
      });
    }
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Publish failed";
    if (draft) {
      await prisma.reviewReplyDraft.update({
        where: { id: draft.id },
        data: { status: "FAILED", lastError: message, body },
      });
    }
    throw new Error(message);
  }
}
