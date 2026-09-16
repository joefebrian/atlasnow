import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { isAgencyStaff, isPlatformAdmin, type Role } from "@/lib/roles";
import type { WorkspaceMode } from "@/lib/tenancy";

const COOKIE = "atlasnow_session";
const SESSION_DAYS = 14;

export type SessionPayload = {
  userId: string;
  email: string;
  name: string | null;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantType: "AGENCY" | "CLIENT";
  role: Role;
  isAgencyStaff: boolean;
  isPlatformAdmin: boolean;
  mode: WorkspaceMode;
  /** Parent agency when the current tenant is a brand. */
  agencyId: string | null;
  /** Branch PIC: the one outlet they may operate. */
  locationId: string | null;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET || "atlasnow-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const p = payload as unknown as SessionPayload;
    p.isPlatformAdmin = isPlatformAdmin(p.role);
    if (!p.tenantType) {
      p.tenantType = p.role === "SUPER_ADMIN" || p.role === "AGENCY_ADMIN" || p.role === "ANALYST"
        ? "AGENCY"
        : "CLIENT";
    }
    if (!p.mode) {
      p.mode = p.tenantType === "CLIENT" ? "brand" : "agency";
    }
    if (p.mode === "platform" && p.isPlatformAdmin) {
      p.isAgencyStaff = false;
    } else if (p.tenantType === "AGENCY") {
      p.mode = "agency";
      p.isAgencyStaff = true;
    } else {
      p.mode = "brand";
      p.isAgencyStaff = false;
    }
    if (p.agencyId === undefined) p.agencyId = null;
    if (p.locationId === undefined) p.locationId = null;
    return p;
  } catch {
    return null;
  }
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const jar = await cookies();
  jar.set(COOKIE, token, sessionCookieOptions());
}

/** Attach the session cookie to a redirect (OAuth callbacks). */
export async function attachSessionCookie(response: NextResponse, payload: SessionPayload) {
  const token = await createSessionToken(payload);
  response.cookies.set(COOKIE, token, sessionCookieOptions());
  return response;
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export type LoginFailure = "invalid" | "pending" | "disabled";

export type LoginResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; error: LoginFailure };

function sessionFromMembership(
  user: { id: string; email: string; name: string | null },
  membership: {
    tenantId: string;
    role: string;
    locationId?: string | null;
    tenant: { slug: string; name: string; type: string; agencyId?: string | null };
  },
  mode: WorkspaceMode = "agency"
): SessionPayload {
  const tenant = membership.tenant;
  const role = membership.role as Role;
  const tenantType: "AGENCY" | "CLIENT" = tenant.type === "AGENCY" ? "AGENCY" : "CLIENT";
  const platform = isPlatformAdmin(role);
  const resolvedMode: WorkspaceMode =
    mode === "platform" && platform ? "platform" : tenantType === "CLIENT" ? "brand" : "agency";
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    tenantId: membership.tenantId,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    tenantType,
    role,
    isPlatformAdmin: platform,
    mode: resolvedMode,
    isAgencyStaff: resolvedMode === "agency" && tenantType === "AGENCY",
    agencyId: tenantType === "CLIENT" ? tenant.agencyId ?? null : null,
    locationId: role === "BRANCH" ? membership.locationId ?? null : null,
  };
}

function usableMemberships<
  T extends { role: string; tenant: { status: string; type: string; loginEnabled: boolean } },
>(memberships: T[]): T[] {
  return memberships.filter((m) => {
    if (m.tenant.status === "ARCHIVED") return false;
    if (m.tenant.type === "AGENCY") {
      if (m.role === "SUPER_ADMIN") return true;
      return m.tenant.loginEnabled === true;
    }
    if (isAgencyStaff(m.role)) return true;
    return m.tenant.loginEnabled === true;
  });
}

export async function authenticateUser(email: string, password: string) {
  const result = await authenticateUserDetailed(email, password);
  return result.ok ? result.session : null;
}

export async function authenticateUserDetailed(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: { tenant: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user) return { ok: false, error: "invalid" };
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return { ok: false, error: "invalid" };
  if (!user.isActive) return { ok: false, error: "disabled" };

  const memberships = usableMemberships(user.memberships);
  const membership =
    memberships.find((m) => m.tenant.type === "AGENCY") || memberships[0];
  if (!membership) {
    const waiting = user.memberships.some(
      (m) =>
        m.tenant.status !== "ARCHIVED" &&
        m.tenant.loginEnabled === false &&
        (m.tenant.type === "CLIENT" || m.tenant.type === "AGENCY")
    );
    return { ok: false, error: waiting ? "pending" : "invalid" };
  }

  return { ok: true, session: sessionFromMembership(user, membership) };
}

export async function createSessionForUserId(userId: string): Promise<SessionPayload | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: { tenant: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user || !user.isActive) return null;
  const memberships = usableMemberships(user.memberships);
  const membership =
    memberships.find((m) => m.tenant.type === "AGENCY") || memberships[0];
  if (!membership) return null;
  return sessionFromMembership(user, membership);
}

export async function switchWorkspace(
  opts: { mode: "platform" } | { mode: "agency"; agencyId: string }
): Promise<SessionPayload | null> {
  const current = await readSession();
  if (!current?.isPlatformAdmin) return null;
  const user = await prisma.user.findUnique({
    where: { id: current.userId },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: { tenant: true },
      },
    },
  });
  if (!user) return null;
  const home =
    user.memberships.find((m) => m.role === "SUPER_ADMIN" && m.tenant.type === "AGENCY") ||
    user.memberships[0];
  if (!home) return null;
  if (opts.mode === "platform") {
    const session = sessionFromMembership(user, home, "platform");
    await setSessionCookie(session);
    return session;
  }
  const agency = await prisma.tenant.findFirst({
    where: { id: opts.agencyId, type: "AGENCY", status: { not: "ARCHIVED" } },
  });
  if (!agency) return null;
  const session: SessionPayload = {
    ...sessionFromMembership(user, home, "agency"),
    tenantId: agency.id,
    tenantSlug: agency.slug,
    tenantName: agency.name,
    tenantType: "AGENCY",
    mode: "agency",
    isAgencyStaff: true,
    agencyId: null,
  };
  await setSessionCookie(session);
  return session;
}

export async function requireSession() {
  return readSession();
}

export async function requireAgencySession() {
  const session = await readSession();
  if (!session || !session.isAgencyStaff || session.mode === "platform") return null;
  return session;
}

export async function requirePlatformSession() {
  const session = await readSession();
  if (!session?.isPlatformAdmin) return null;
  return session;
}

export function passwordMeetsPolicy(password: string): boolean {
  return password.length >= 8 && password.length <= 80;
}

/** Super Admin: anyone. Analyst: client users only. Client Admin: users on their brand. */
export function canResetUserPassword(
  actor: SessionPayload,
  target: { id: string; memberships: { role: string; tenantId: string; status: string }[] }
): boolean {
  if (actor.userId === target.id) return false;
  const targetIsAgency = target.memberships.some(
    (m) => m.status === "ACTIVE" && isAgencyStaff(m.role)
  );
  if (actor.role === "SUPER_ADMIN") return true;
  if (targetIsAgency) return false;
  if (actor.role === "ANALYST") return true;
  if (actor.role === "CLIENT_ADMIN") {
    return target.memberships.some(
      (m) => m.tenantId === actor.tenantId && m.status === "ACTIVE"
    );
  }
  return false;
}

export async function writeAudit(params: {
  tenantId?: string | null;
  actorId?: string | null;
  action: string;
  objectType?: string;
  objectId?: string;
  meta?: Record<string, unknown>;
}) {
  // Never fail the main request because of audit (stale session userId after reseed, etc.)
  try {
    let actorId = params.actorId ?? null;
    if (actorId) {
      const exists = await prisma.user.findUnique({
        where: { id: actorId },
        select: { id: true },
      });
      if (!exists) actorId = null;
    }
    let tenantId = params.tenantId ?? null;
    if (tenantId) {
      const exists = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      });
      if (!exists) tenantId = null;
    }

    await prisma.auditEvent.create({
      data: {
        tenantId,
        actorId,
        action: params.action,
        objectType: params.objectType,
        objectId: params.objectId,
        metaJson: params.meta ? JSON.stringify(params.meta) : null,
      },
    });
  } catch (e) {
    console.warn("[writeAudit] skipped:", e);
  }
}
