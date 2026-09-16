import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canResetUserPassword, readSession, writeAudit } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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
    return NextResponse.json({ error: "You cannot change this user’s email" }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = normalizeEmail(body.email || "");
  if (!isEmail(email)) {
    return NextResponse.json({ error: "That email does not look valid" }, { status: 400 });
  }
  if (email === target.email.toLowerCase()) {
    return NextResponse.json({ error: "That is already their email" }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: target.id },
      data: { email },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "That email is already used" }, { status: 409 });
    }
    throw e;
  }

  await writeAudit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "EMAIL_CHANGE",
    objectType: "user",
    objectId: target.id,
    meta: { from: target.email, to: email },
  });

  return NextResponse.json({ ok: true, email });
}
