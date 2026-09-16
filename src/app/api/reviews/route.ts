import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { listReviewsForSession } from "@/lib/reviews/service";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") || undefined;
  const filter = (url.searchParams.get("filter") || "all") as
    | "all"
    | "unreplied"
    | "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "lte3";
  const locationId = url.searchParams.get("locationId") || undefined;
  const requestedClient = url.searchParams.get("clientId");

  const tenantId = session.isAgencyStaff
    ? requestedClient
    : session.tenantId;

  if (!tenantId) {
    return NextResponse.json({ error: "Pick a brand first" }, { status: 400 });
  }
  if (!(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reviews = await listReviewsForSession({
    tenantId,
    q,
    filter,
    locationId,
  });

  const unreplied = reviews.filter((r) => !r.replied).length;
  const withRating = reviews.filter((r) => r.starRating > 0);
  const avg =
    withRating.length > 0
      ? withRating.reduce((s, r) => s + r.starRating, 0) / withRating.length
      : 0;

  return NextResponse.json({
    reviews,
    stats: {
      total: reviews.length,
      unreplied,
      avg: Math.round(avg * 100) / 100,
    },
  });
}
