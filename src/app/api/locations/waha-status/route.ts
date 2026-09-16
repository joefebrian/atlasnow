import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessTenant, listAccessibleClientTenants } from "@/lib/locations/access";
import { listWahaSessions } from "@/lib/conversations/waha-client";
import { isWahaIngestEnabled } from "@/lib/conversations/waha-config";
import { mapWahaSessionStatus, wahaStatusLabel } from "@/lib/conversations/waha-session";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("client");
  const clients = await listAccessibleClientTenants(session);
  const tenantId = session.isAgencyStaff
    ? clientId && clients.some((c) => c.id === clientId)
      ? clientId
      : null
    : session.tenantId;

  if (session.isAgencyStaff && clientId && !(await canAccessTenant(session, clientId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json({ configured: true, sessions: {} });
  }

  const locations = await prisma.location.findMany({
    where: { tenantId, status: { not: "ARCHIVED" } },
    select: { id: true, atlasLocationId: true, phone: true },
  });

  if (!(await isWahaIngestEnabled())) {
    return NextResponse.json({ configured: false, sessions: {} });
  }

  const listed = await listWahaSessions();
  if (!listed) {
    return NextResponse.json({ configured: true, offline: true, sessions: {} });
  }

  const byName = new Map(listed.map((s) => [s.name, s]));
  const sessions: Record<
    string,
    { atlasLocationId: string; status: string | null; uiStatus: string; label: string }
  > = {};
  for (const loc of locations) {
    const raw = byName.get(loc.atlasLocationId);
    const uiStatus = raw ? mapWahaSessionStatus(raw.status) : loc.phone ? "none" : "none";
    sessions[loc.id] = {
      atlasLocationId: loc.atlasLocationId,
      status: raw?.status || null,
      uiStatus,
      label: raw ? wahaStatusLabel(mapWahaSessionStatus(raw.status)) : loc.phone ? "Not linked" : "No phone",
    };
  }

  return NextResponse.json({ configured: true, sessions });
}
