import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { listBroadcastHistory } from "@/lib/broadcast/history";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const client = url.searchParams.get("client");
  let tenantId = session.tenantId;
  if (session.isAgencyStaff) {
    if (!client) return NextResponse.json({ error: "Pick a brand" }, { status: 400 });
    const ok = await canAccessTenant(session, client);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    tenantId = client;
  }
  const batches = await listBroadcastHistory(tenantId);
  return NextResponse.json({ batches });
}
