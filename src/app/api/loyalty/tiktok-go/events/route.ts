import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { listGoEvents } from "@/lib/tiktok-go/ledger";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const tenantId = session.isAgencyStaff ? url.searchParams.get("client") : session.tenantId;
  if (!tenantId || !(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await listGoEvents(tenantId, 50);
  return NextResponse.json({
    events: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      demo: r.demo,
      title: r.title,
      detail: r.detail,
      outlet: r.location.name,
      at: r.createdAt.toISOString(),
    })),
  });
}
