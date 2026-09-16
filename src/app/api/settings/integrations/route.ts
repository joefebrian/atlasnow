import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { listIntegrationViews } from "@/lib/integrations/service";
import { isAgencyStaff, isPlatformAdmin } from "@/lib/roles";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAgencyStaff(session.role)) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  const integrations = await listIntegrationViews();
  return NextResponse.json({ integrations });
}
