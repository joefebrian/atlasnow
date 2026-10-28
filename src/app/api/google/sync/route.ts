import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgencySession, writeAudit } from "@/lib/auth";
import { GOOGLE_PROVIDER } from "@/lib/google/config";
import { getAgencyTenant } from "@/lib/google/connector";
import { syncRemoteLocations } from "@/lib/google/business-info";

/**
 * POST /api/google/sync
 * body/query: force=true → always hit Google (rate-limited + backoff)
 * default → use DB cache if last sync < 15 minutes
 */
export async function POST(request: Request) {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  const agency = await getAgencyTenant();
  if (!agency) {
    return NextResponse.json({ error: "Agency tenant missing" }, { status: 500 });
  }

  const connector = await prisma.connector.findUnique({
    where: {
      tenantId_provider_accountKey: { tenantId: agency.id, provider: GOOGLE_PROVIDER, accountKey: "" },
    },
  });
  if (!connector || connector.status === "DISCONNECTED") {
    return NextResponse.json({ error: "Google not connected" }, { status: 400 });
  }

  if (connector.mode === "MOCK") {
    return NextResponse.json(
      {
        error:
          "Mock connector is disabled. Disconnect on Data Health, then Connect Google with live OAuth.",
      },
      { status: 400 }
    );
  }

  let force = false;
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true") {
      force = true;
    }
    const body = await request.json().catch(() => null);
    if (body && typeof body === "object" && "force" in body) {
      force = Boolean((body as { force?: boolean }).force);
    }
  } catch {
    /* no body */
  }

  try {
    const result = await syncRemoteLocations(connector.id, { force });
    await writeAudit({
      tenantId: agency.id,
      actorId: session.userId,
      action: force ? "GOOGLE_SYNC_LOCATIONS_FORCE" : "GOOGLE_SYNC_LOCATIONS",
      objectType: "connector",
      objectId: connector.id,
      meta: result,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      message:
        result.source === "cache"
          ? `Using cached locations (${result.count}) — last sync ${
              result.cacheAgeSeconds != null
                ? `${result.cacheAgeSeconds}s ago`
                : "recently"
            }. Use Force refresh to call Google again.`
          : `Synced ${result.count} locations from Google (live).`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
