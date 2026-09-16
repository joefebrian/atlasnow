import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getLocationForSession } from "@/lib/locations/access";
import { getWahaQr } from "@/lib/conversations/waha-client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const location = await getLocationForSession(session, id);
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const qr = await getWahaQr(location.atlasLocationId);
  if (!qr) {
    return NextResponse.json(
      { error: "QR not ready yet. Wait a few seconds and refresh." },
      { status: 404 }
    );
  }
  return NextResponse.json(qr);
}
