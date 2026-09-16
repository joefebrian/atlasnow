import { NextResponse } from "next/server";
import { readSession, requirePlatformSession, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isStandaloneBrandSession } from "@/lib/tenancy";

export async function GET() {
  const session = await requirePlatformSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const items = await prisma.agencyUpgradeRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true, slug: true, contactEmail: true } },
      applicant: { select: { email: true, name: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!isStandaloneBrandSession(session)) {
    return NextResponse.json({ error: "Only a standalone brand can apply" }, { status: 403 });
  }
  const existing = await prisma.agencyUpgradeRequest.findFirst({
    where: { clientId: session.tenantId, status: "PENDING" },
  });
  if (existing) return NextResponse.json({ ok: true, id: existing.id, already: true });
  const row = await prisma.agencyUpgradeRequest.create({
    data: {
      clientId: session.tenantId,
      applicantUserId: session.userId,
      status: "PENDING",
    },
  });
  await writeAudit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "AGENCY_UPGRADE_APPLY",
    objectType: "tenant",
    objectId: session.tenantId,
  });
  return NextResponse.json({ ok: true, id: row.id });
}
