import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, requireAgencySession, writeAudit } from "@/lib/auth";
import { CLIENT_ROLES, isClientRole, ROLE_LABELS } from "@/lib/roles";
import { randomPassword } from "@/lib/slug";

type Ctx = { params: Promise<{ id: string }> };

const addUserSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional().nullable(),
  role: z.string().default("CLIENT_ADMIN"),
  locationId: z.string().min(1).optional().nullable(),
  password: z.string().min(8).max(80).optional(),
  /** If true, reset password even when user already exists */
  resetPassword: z.boolean().optional(),
});

/**
 * Add (or attach) a login user to this client with a role.
 * One client can have many users; same email can exist on multiple clients via membership.
 */
export async function POST(request: Request, ctx: Ctx) {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const client = await prisma.tenant.findFirst({ where: { id, type: "CLIENT" } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = addUserSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const role = parsed.data.role;
  if (!isClientRole(role)) {
    return NextResponse.json(
      {
        error: `Invalid role. Use: ${CLIENT_ROLES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  let locationId: string | null = null;
  if (role === "BRANCH") {
    const locId = parsed.data.locationId || "";
    const loc = locId
      ? await prisma.location.findFirst({
          where: { id: locId, tenantId: client.id, status: { not: "ARCHIVED" }, kind: { not: "HQ" } },
          select: { id: true },
        })
      : null;
    if (!loc) {
      return NextResponse.json({ error: "Branch PIC needs an outlet (not HQ)." }, { status: 400 });
    }
    locationId = loc.id;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const displayName = parsed.data.name?.trim() || email.split("@")[0];
  const existingUser = await prisma.user.findUnique({ where: { email } });

  const shouldSetPassword =
    !existingUser || parsed.data.resetPassword || Boolean(parsed.data.password);
  const plainPassword = shouldSetPassword
    ? parsed.data.password || randomPassword(12)
    : null;
  const passwordHash = plainPassword
    ? await hashPassword(plainPassword)
    : existingUser!.passwordHash;

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: displayName,
      isActive: true,
      ...(plainPassword ? { passwordHash } : {}),
    },
    create: {
      email,
      name: displayName,
      passwordHash: passwordHash!,
      isActive: true,
    },
  });

  const membership = await prisma.membership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: client.id } },
    update: { role, status: "ACTIVE", locationId },
    create: {
      userId: user.id,
      tenantId: client.id,
      role,
      status: "ACTIVE",
      locationId,
    },
  });

  // Enable workspace login when at least one user is attached
  const updatedClient = await prisma.tenant.update({
    where: { id: client.id },
    data: {
      loginEnabled: true,
      activatedAt: client.activatedAt || new Date(),
      status: "ACTIVE",
    },
  });

  await writeAudit({
    tenantId: client.id,
    actorId: session.userId,
    action: "CLIENT_USER_ADD",
    objectType: "membership",
    objectId: membership.id,
    meta: { email, role, userId: user.id },
  });

  return NextResponse.json({
    client: updatedClient,
    membership: {
      id: membership.id,
      role: membership.role,
      status: membership.status,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
      },
    },
    login: plainPassword
      ? {
          email,
          temporaryPassword: plainPassword,
          role,
          roleLabel: ROLE_LABELS[role],
          note: "Share credentials securely. User can sign in to this client workspace.",
        }
      : {
          email,
          role,
          roleLabel: ROLE_LABELS[role],
          note: "User already had a password; membership added/updated without reset.",
        },
  });
}
