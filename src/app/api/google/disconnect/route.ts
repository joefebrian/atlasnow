import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgencySession, writeAudit } from "@/lib/auth";
import { GOOGLE_PROVIDER } from "@/lib/google/config";
import { getAgencyTenant } from "@/lib/google/connector";

export async function POST() {
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
      tenantId_provider: { tenantId: agency.id, provider: GOOGLE_PROVIDER },
    },
  });
  if (!connector) {
    return NextResponse.json({ ok: true });
  }

  await prisma.googleRemoteLocation.deleteMany({ where: { connectorId: connector.id } });
  await prisma.syncRun.deleteMany({ where: { connectorId: connector.id } });
  await prisma.connector.update({
    where: { id: connector.id },
    data: {
      status: "DISCONNECTED",
      accessTokenEnc: null,
      refreshTokenEnc: null,
      tokenExpiresAt: null,
      accountEmail: null,
      lastError: null,
      lastSyncAt: null,
      mode: "LIVE",
      displayName: "Google Business Profile",
      metaJson: null,
    },
  });

  // Drop in-memory Google account / rate caches for this connector
  try {
    const { cacheDelete } = await import("@/lib/google/rate-limit");
    cacheDelete(`gbp:accounts:${connector.id}`);
  } catch {
    /* ignore */
  }

  await writeAudit({
    tenantId: agency.id,
    actorId: session.userId,
    action: "GOOGLE_DISCONNECT",
    objectType: "connector",
    objectId: connector.id,
  });

  return NextResponse.json({ ok: true });
}
