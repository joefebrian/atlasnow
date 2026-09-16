import { prisma } from "@/lib/db";
import { CLIENT_ROLES } from "@/lib/roles";
import { defaultHrefsForRole, sanitizeMenuHrefs, type NavCtx } from "@/lib/nav-access";
import type { SessionPayload } from "@/lib/auth";

export async function loadRoleMenuHrefs(tenantId: string, role: string): Promise<string[] | null> {
  const row = await prisma.roleMenuConfig.findUnique({
    where: { tenantId_role: { tenantId, role } },
  });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.hrefsJson) as unknown;
    if (!Array.isArray(parsed)) return null;
    const hrefs = sanitizeMenuHrefs(parsed.filter((x): x is string => typeof x === "string"));
    return hrefs.length ? hrefs : null;
  } catch {
    return null;
  }
}

export async function saveRoleMenuHrefs(tenantId: string, role: string, hrefs: string[]): Promise<string[]> {
  const clean = sanitizeMenuHrefs(hrefs);
  const stored = clean.length ? clean : defaultHrefsForRole(role);
  await prisma.roleMenuConfig.upsert({
    where: { tenantId_role: { tenantId, role } },
    create: { tenantId, role, hrefsJson: JSON.stringify(stored) },
    update: { hrefsJson: JSON.stringify(stored) },
  });
  return stored;
}

export function canEditRoleMenus(session: SessionPayload): boolean {
  if (session.isPlatformAdmin || session.isAgencyStaff) return true;
  return session.role === "CLIENT_ADMIN";
}

export const CONFIGURABLE_ROLES = CLIENT_ROLES;

export async function navCtxForSession(session: SessionPayload): Promise<NavCtx> {
  const hrefs =
    !session.isAgencyStaff && session.tenantType === "CLIENT"
      ? await loadRoleMenuHrefs(session.tenantId, session.role)
      : null;
  return {
    role: session.role,
    mode: session.mode,
    isAgencyStaff: session.isAgencyStaff,
    isPlatformAdmin: session.isPlatformAdmin,
    hrefs,
  };
}
