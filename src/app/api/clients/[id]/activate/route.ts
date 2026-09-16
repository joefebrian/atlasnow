import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, readSession, writeAudit } from "@/lib/auth";
import { canManageClient } from "@/lib/tenancy";
import { randomPassword } from "@/lib/slug";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  email: z.string().email().optional(),
  name: z.string().max(120).optional(),
  password: z.string().min(8).max(80).optional(),
});

/**
 * Activate client login: enable tenant.loginEnabled + ensure a CLIENT_ADMIN user.
 * Returns one-time temporary password if generated.
 */
export async function POST(request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const client = await prisma.tenant.findFirst({ where: { id, type: "CLIENT" } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (!canManageClient(session, client)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const email = (
    parsed.data.email ||
    client.contactEmail ||
    ""
  )
    .toLowerCase()
    .trim();

  if (!email) {
    return NextResponse.json(
      { error: "Contact email required to activate login" },
      { status: 400 }
    );
  }

  const displayName = parsed.data.name?.trim() || client.contactName || client.name;
  const existingUser = await prisma.user.findUnique({ where: { email } });
  let temporaryPassword: string | null = null;
  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          isActive: true,
          name: existingUser.name || displayName,
        },
      })
    : await prisma.user.create({
        data: {
          email,
          name: displayName,
          passwordHash: await hashPassword(
            (temporaryPassword = parsed.data.password || randomPassword(12))
          ),
          isActive: true,
        },
      });

  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: client.id } },
    update: { role: "CLIENT_ADMIN", status: "ACTIVE" },
    create: {
      userId: user.id,
      tenantId: client.id,
      role: "CLIENT_ADMIN",
      status: "ACTIVE",
    },
  });

  const updated = await prisma.tenant.update({
    where: { id: client.id },
    data: {
      loginEnabled: true,
      activatedAt: client.activatedAt || new Date(),
      contactEmail: client.contactEmail || email,
      status: "ACTIVE",
    },
  });

  await writeAudit({
    tenantId: client.id,
    actorId: session.userId,
    action: "CLIENT_LOGIN_ACTIVATE",
    objectType: "tenant",
    objectId: client.id,
    meta: { email, userId: user.id },
  });

  return NextResponse.json({
    client: updated,
    login: {
      email,
      temporaryPassword,
      role: "CLIENT_ADMIN",
      note: temporaryPassword
        ? "Share credentials securely. Client can sign in after activation."
        : "Login is on. They sign in with the password they already set, or Google / Facebook.",
    },
  });
}
