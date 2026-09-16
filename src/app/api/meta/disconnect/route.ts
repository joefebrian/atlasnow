import { NextResponse } from "next/server";
import { readSession, writeAudit } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { disconnectMeta } from "@/lib/meta/service";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const tenantId = session.isAgencyStaff
    ? url.searchParams.get("client") || session.tenantId
    : session.tenantId;
  if (!(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await disconnectMeta(tenantId);
  await writeAudit({
    tenantId,
    actorId: session.userId,
    action: "META_DISCONNECT",
    objectType: "connector",
    objectId: tenantId,
  });
  return NextResponse.json({ ok: true });
}
