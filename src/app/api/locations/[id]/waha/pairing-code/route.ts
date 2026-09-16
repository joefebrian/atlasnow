import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getLocationForSession } from "@/lib/locations/access";
import { requestWahaPairingCode } from "@/lib/conversations/waha-client";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const location = await getLocationForSession(session, id);
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const r = await requestWahaPairingCode(location.atlasLocationId, location.phone || "");
  if ("error" in r) {
    return NextResponse.json({ error: r.error }, { status: 400 });
  }
  return NextResponse.json({ code: r.code });
}
