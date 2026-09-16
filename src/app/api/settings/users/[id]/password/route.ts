import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  canResetUserPassword,
  hashPassword,
  passwordMeetsPolicy,
  readSession,
  writeAudit,
} from "@/lib/auth";
import { randomPassword } from "@/lib/slug";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({
    where: { id },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        select: { role: true, tenantId: true, status: true },
      },
    },
  });
  if (!target || !target.isActive) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!canResetUserPassword(session, target)) {
    return NextResponse.json({ error: "You cannot change this user’s password" }, { status: 403 });
  }

  let body: { password?: string; generate?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const plain =
    body.generate || !body.password ? randomPassword(12) : body.password;
  if (!passwordMeetsPolicy(plain)) {
    return NextResponse.json(
      { error: "Password must be 8–80 characters" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash: await hashPassword(plain) },
  });
  await writeAudit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "PASSWORD_RESET",
    objectType: "user",
    objectId: target.id,
    meta: { email: target.email },
  });

  return NextResponse.json({
    ok: true,
    email: target.email,
    temporaryPassword: plain,
  });
}
