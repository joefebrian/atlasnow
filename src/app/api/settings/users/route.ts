import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canResetUserPassword, readSession } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/roles";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      memberships: {
        where: { status: "ACTIVE" },
        select: {
          role: true,
          tenantId: true,
          status: true,
          tenant: { select: { name: true, type: true } },
        },
      },
    },
  });

  const visible = users.filter((u) => canResetUserPassword(session, u));
  const canManage =
    session.role === "SUPER_ADMIN" ||
    session.role === "ANALYST" ||
    session.role === "CLIENT_ADMIN";
  return NextResponse.json({
    canManage,
    users: visible.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      roles: u.memberships.map((m) => ({
        role: m.role,
        roleLabel: ROLE_LABELS[m.role as Role] || m.role,
        tenant: m.tenant.name,
        tenantType: m.tenant.type,
      })),
    })),
  });
}
