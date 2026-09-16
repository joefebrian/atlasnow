import { NextResponse } from "next/server";
import { requirePlatformSession } from "@/lib/auth";
import { listAgenciesForPlatform } from "@/lib/locations/access";
import { isPlatformMode } from "@/lib/tenancy";

export async function GET() {
  const session = await requirePlatformSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const agencies = await listAgenciesForPlatform(session);
  return NextResponse.json({ agencies, platform: isPlatformMode(session) });
}
