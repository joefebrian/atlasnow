import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  passwordMeetsPolicy,
  readSession,
  verifyPassword,
  writeAudit,
} from "@/lib/auth";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currentPassword = body.currentPassword || "";
  const newPassword = body.newPassword || "";
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current and new password are required" },
      { status: 400 }
    );
  }
  if (!passwordMeetsPolicy(newPassword)) {
    return NextResponse.json(
      { error: "New password must be 8–80 characters" },
      { status: 400 }
    );
  }
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "New password must be different" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Current password is wrong" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await writeAudit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "PASSWORD_CHANGE",
    objectType: "user",
    objectId: user.id,
  });

  return NextResponse.json({ ok: true });
}
