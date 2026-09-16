import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { resolvedTikTokApp } from "@/lib/tiktok/config";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("client");
  const tenantId = session.isAgencyStaff ? clientId : session.tenantId;
  const app = await resolvedTikTokApp();

  if (tenantId && !(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    configured: app.configured,
    connected: false,
    accounts: [] as { id: string; handle: string }[],
    webhookUrl: app.webhookUrl,
    redirectUri: app.redirectUri,
  });
}
