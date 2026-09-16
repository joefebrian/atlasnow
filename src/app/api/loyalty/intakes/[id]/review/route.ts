import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant, canUseLocation } from "@/lib/locations/access";
import { prisma } from "@/lib/db";
import { reviewIntake } from "@/lib/loyalty/service";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const tenantId = session.isAgencyStaff ? url.searchParams.get("client") : session.tenantId;
  if (!tenantId || !(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.role === "BRANCH") {
    return NextResponse.json({ error: "Kasir tidak Approve. Kantor merek yang cap." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string };
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }
  const existing = await prisma.loyaltyIntake.findFirst({
    where: { id, tenantId },
    select: { locationId: true },
  });
  if (!existing || !canUseLocation(session, existing.locationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const r = await reviewIntake({
    tenantId,
    intakeId: id,
    actorId: session.userId,
    action: body.action,
    reason: body.reason,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r);
}
