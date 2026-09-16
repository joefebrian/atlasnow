import { NextResponse } from "next/server";
import { requireAgencySession, writeAudit } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { syncReviewsFromGoogle, syncReviewsFromMaps } from "@/lib/reviews/service";

export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  let locationId: string | undefined;
  let tenantId: string | undefined;
  let mode: "maps" | "gbp" = "maps";
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.locationId === "string" && body.locationId.trim()) {
      locationId = body.locationId.trim();
    }
    if (body && typeof body.clientId === "string" && body.clientId.trim()) {
      tenantId = body.clientId.trim();
    } else if (body && typeof body.tenantId === "string" && body.tenantId.trim()) {
      tenantId = body.tenantId.trim();
    }
    if (body?.mode === "gbp" || body?.mode === "google") mode = "gbp";
    if (body?.mode === "maps") mode = "maps";
  } catch {
    /* empty */
  }

  if (tenantId && !(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    if (mode === "maps") {
      const result = await syncReviewsFromMaps({ locationId, tenantId });
      await writeAudit({
        tenantId: session.tenantId,
        actorId: session.userId,
        action: "REVIEWS_SYNC_MAPS",
        objectType: "reviews",
        meta: result,
      });
      const extra =
        result.warnings.length > 0 ? ` ${result.warnings[0]}` : "";
      const fail =
        result.errors.length > 0
          ? ` ${result.errors.length} outlet(s) failed.`
          : "";
      return NextResponse.json({
        ok: true,
        ...result,
        message: `Pulled ${result.upserted} review(s) from ${result.locationsTried} Maps outlet(s). Last 1 month first; empty months fall back 2 months at a time.${fail}${extra}`,
      });
    }

    const result = await syncReviewsFromGoogle({ locationId, tenantId });
    await writeAudit({
      tenantId: session.tenantId,
      actorId: session.userId,
      action: "REVIEWS_SYNC_GOOGLE",
      objectType: "reviews",
      meta: result,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      message:
        result.errors.length > 0
          ? `Synced ${result.upserted} reviews from ${result.locationsTried} locations; ${result.errors.length} location(s) failed.`
          : `Synced ${result.upserted} reviews from ${result.locationsTried} mapped location(s).`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 400 }
    );
  }
}
