import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { listCustomers } from "@/lib/conversations/service";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || undefined;
  const clientId = url.searchParams.get("clientId") || undefined;
  const locationId = url.searchParams.get("locationId") || undefined;
  const data = await listCustomers({
    isAgencyStaff: session.isAgencyStaff,
    tenantId: session.tenantId,
    q,
    clientId: session.isAgencyStaff ? clientId : undefined,
    locationId,
  });
  return NextResponse.json(data);
}
