import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, requireAgencySession, writeAudit } from "@/lib/auth";
import { CLIENT_ROLES, isClientRole, ROLE_LABELS } from "@/lib/roles";
import { randomPassword } from "@/lib/slug";

type Ctx = { params: Promise<{ id: string; membershipId: string }> };

const patchSchema = z.object({
  role: z.string().optional(),
  locationId: z.string().min(1).optional().nullable(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  resetPassword: z.boolean().optional(),
  password: z.string().min(8).max(80).optional(),
});

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  const { id, membershipId } = await ctx.params;
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId: id, tenant: { type: "CLIENT" } },
    include: { user: true, tenant: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.role && !isClientRole(parsed.data.role)) {
    return NextResponse.json(
      { error: `Invalid role. Use: ${CLIENT_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  let temporaryPassword: string | null = null;
  if (parsed.data.resetPassword || parsed.data.password) {
    temporaryPassword = parsed.data.password || randomPassword(12);
    await prisma.user.update({
      where: { id: membership.userId },
      data: {
        passwordHash: await hashPassword(temporaryPassword),
        isActive: true,
      },
    });
  }

  const nextRole = parsed.data.role || membership.role;
  let locationId = membership.locationId;
  if (nextRole === "BRANCH") {
    const requested = parsed.data.locationId === undefined ? membership.locationId : parsed.data.locationId;
    const loc = requested
      ? await prisma.location.findFirst({
          where: { id: requested, tenantId: id, status: { not: "ARCHIVED" }, kind: { not: "HQ" } },
          select: { id: true },
        })
      : null;
    if (!loc) {
      return NextResponse.json({ error: "Branch PIC needs an outlet (not HQ)." }, { status: 400 });
    }
    locationId = loc.id;
  } else {
    locationId = null;
  }

  const updated = await prisma.membership.update({
    where: { id: membershipId },
    data: {
      role: parsed.data.role,
      locationId,
      status: parsed.data.status,
    },
    include: {
      user: { select: { id: true, email: true, name: true, isActive: true } },
    },
  });

  await writeAudit({
    tenantId: id,
    actorId: session.userId,
    action: "CLIENT_USER_UPDATE",
    objectType: "membership",
    objectId: membershipId,
    meta: { ...parsed.data, email: membership.user.email },
  });

  return NextResponse.json({
    membership: updated,
    login: temporaryPassword
      ? {
          email: membership.user.email,
          temporaryPassword,
          role: updated.role,
          roleLabel: ROLE_LABELS[updated.role as keyof typeof ROLE_LABELS] || updated.role,
        }
      : null,
  });
}

/** Remove user from this client only (does not delete the User account globally). */
export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  const { id, membershipId } = await ctx.params;
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId: id, tenant: { type: "CLIENT" } },
    include: { user: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  await prisma.membership.delete({ where: { id: membershipId } });

  const remaining = await prisma.membership.count({
    where: { tenantId: id, status: "ACTIVE" },
  });
  if (remaining === 0) {
    await prisma.tenant.update({
      where: { id },
      data: { loginEnabled: false },
    });
  }

  await writeAudit({
    tenantId: id,
    actorId: session.userId,
    action: "CLIENT_USER_REMOVE",
    objectType: "membership",
    objectId: membershipId,
    meta: { email: membership.user.email },
  });

  return NextResponse.json({ ok: true, remainingUsers: remaining });
}
