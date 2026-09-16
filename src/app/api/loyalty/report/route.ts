import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { loadLoyaltyMonthReport } from "@/lib/loyalty/report";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const tenantId = session.isAgencyStaff ? url.searchParams.get("client") : session.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Pick a brand first." }, { status: 400 });
  if (!(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const report = await loadLoyaltyMonthReport(tenantId, url.searchParams.get("month"));
  return NextResponse.json(report);
}
