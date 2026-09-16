import { NextResponse } from "next/server";
import { requirePlatformSession, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const session = await requirePlatformSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  let action = "approve";
  try {
    const body = (await request.json()) as { action?: string };
    if (body.action === "reject") action = "reject";
  } catch {
    /* default approve */
  }

  const row = await prisma.agencyUpgradeRequest.findUnique({
    where: { id },
    include: { client: true, applicant: true },
  });
  if (!row || row.status !== "PENDING") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.client.agencyId) {
    return NextResponse.json({ error: "Brand already has an agency" }, { status: 409 });
  }

  if (action === "reject") {
    await prisma.agencyUpgradeRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedByUserId: session.userId,
        reviewedAt: new Date(),
      },
    });
    await writeAudit({
      tenantId: row.clientId,
      actorId: session.userId,
      action: "AGENCY_UPGRADE_REJECT",
      objectType: "AgencyUpgradeRequest",
      objectId: id,
    });
    return NextResponse.json({ ok: true, status: "REJECTED" });
  }

  const result = await prisma.$transaction(async (tx) => {
    const base = slugify(row.client.name) || "agency";
    let slug = `${base}-agency`;
    if (await tx.tenant.findUnique({ where: { slug } })) {
      slug = `${base}-agency-${Date.now().toString(36).slice(-4)}`;
    }
    const agency = await tx.tenant.create({
      data: {
        name: row.client.name,
        slug,
        type: "AGENCY",
        status: "ACTIVE",
        loginEnabled: true,
        timezone: row.client.timezone,
        contactName: row.client.contactName,
        contactEmail: row.client.contactEmail,
        notes: `Upgraded from standalone brand ${row.client.slug}.`,
        activatedAt: new Date(),
      },
    });
    await tx.tenant.update({
      where: { id: row.clientId },
      data: { agencyId: agency.id },
    });
    await tx.membership.upsert({
      where: { userId_tenantId: { userId: row.applicantUserId, tenantId: agency.id } },
      update: { role: "AGENCY_ADMIN", status: "ACTIVE" },
      create: {
        userId: row.applicantUserId,
        tenantId: agency.id,
        role: "AGENCY_ADMIN",
        status: "ACTIVE",
      },
    });
    await tx.agencyUpgradeRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedByUserId: session.userId,
        reviewedAt: new Date(),
        agencyId: agency.id,
      },
    });
    return agency;
  });

  await writeAudit({
    tenantId: result.id,
    actorId: session.userId,
    action: "AGENCY_UPGRADE_APPROVE",
    objectType: "tenant",
    objectId: result.id,
    meta: { brandId: row.clientId },
  });
  return NextResponse.json({ ok: true, status: "APPROVED", agencyId: result.id });
}
