import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readSession, setSessionCookie, verifyPassword, writeAudit } from "@/lib/auth";

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  let body: { currentPassword?: string; newEmail?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currentPassword = body.currentPassword || "";
  const newEmail = normalizeEmail(body.newEmail || "");
  if (!currentPassword || !newEmail) {
    return NextResponse.json(
      { error: "Current password and new email are required" },
      { status: 400 }
    );
  }
  if (!isEmail(newEmail)) {
    return NextResponse.json({ error: "That email does not look valid" }, { status: 400 });
  }
  if (newEmail === session.email.toLowerCase()) {
    return NextResponse.json({ error: "That is already your email" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Current password is wrong" }, { status: 401 });
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { email: newEmail },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "That email is already used" }, { status: 409 });
    }
    throw e;
  }

  await setSessionCookie({ ...session, email: newEmail });
  await writeAudit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "EMAIL_CHANGE",
    objectType: "user",
    objectId: user.id,
    meta: { from: user.email, to: newEmail },
  });

  return NextResponse.json({ ok: true, email: newEmail });
}
