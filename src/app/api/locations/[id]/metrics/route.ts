import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildLocationMetricCards } from "@/lib/metrics/observations";
import { canAccessTenant } from "@/lib/locations/access";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const location = await prisma.location.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      timezone: true,
      atlasLocationId: true,
      tenantId: true,
    },
  });
  if (!location) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await canAccessTenant(session, location.tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const days = Math.min(90, Math.max(7, Number(url.searchParams.get("days") || 28)));

  const pack = await buildLocationMetricCards(location, { days });
  return NextResponse.json(pack);
}
