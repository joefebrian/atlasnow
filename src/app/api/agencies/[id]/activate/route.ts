import { NextResponse } from "next/server";
import { requirePlatformSession, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const session = await requirePlatformSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const agency = await prisma.tenant.findFirst({ where: { id, type: "AGENCY" } });
  if (!agency) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.tenant.update({
    where: { id },
    data: {
      loginEnabled: true,
      status: "ACTIVE",
      activatedAt: agency.activatedAt || new Date(),
    },
  });
  await writeAudit({
    tenantId: id,
    actorId: session.userId,
    action: "AGENCY_LOGIN_ACTIVATE",
    objectType: "tenant",
    objectId: id,
  });
  return NextResponse.json({ ok: true, agency: updated });
}
