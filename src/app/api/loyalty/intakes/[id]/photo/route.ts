import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant, canUseLocation } from "@/lib/locations/access";
import { prisma } from "@/lib/db";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const tenantId = session.isAgencyStaff ? url.searchParams.get("client") : session.tenantId;
  if (!tenantId || !(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const row = await prisma.loyaltyIntake.findFirst({
    where: { id, tenantId },
    select: { photoImage: true, photoMime: true, locationId: true },
  });
  if (!row || !canUseLocation(session, row.locationId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!row.photoImage || !row.photoImage.length) {
    return NextResponse.json({ error: "No photo" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(row.photoImage), {
    headers: {
      "Content-Type": row.photoMime || "image/jpeg",
      "Cache-Control": "private, max-age=120",
    },
  });
}
