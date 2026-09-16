import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { staffCaptureForLocation, staffCaptureSummary } from "@/lib/reviews/capture-service";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const locationId = url.searchParams.get("locationId")?.trim() || "";
  const clientId = url.searchParams.get("clientId")?.trim() || "";

  if (locationId) {
    const row = await staffCaptureForLocation(session, locationId);
    if (!row) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(row);
  }

  const tenantId = session.isAgencyStaff ? clientId : session.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Pick a brand first" }, { status: 400 });
  const summary = await staffCaptureSummary(session, tenantId);
  if (!summary) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(summary);
}
