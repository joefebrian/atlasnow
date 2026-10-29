import { prisma } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { yolaPhoneNumberId, yolaTenantOverride } from "@/lib/yola/config";

const YOLA_ROLES = new Set([
  "SUPER_ADMIN",
  "AGENCY_ADMIN",
  "ANALYST",
  "CLIENT_ADMIN",
  "HQ_MARKETING",
  "HQ_OPS",
  "REGIONAL",
]);

export function yolaRoleAllowed(role: string) {
  return YOLA_ROLES.has(role);
}

/** The tenant that owns the configured phone. No row, no YOLA writes. */
export async function resolveYolaTenantId(phoneNumberId: string): Promise<string | null> {
  if (!phoneNumberId) return null;
  const phone = await prisma.wabaPhone.findUnique({
    where: { phoneNumberId },
    select: { tenantId: true, status: true },
  });
  if (!phone || phone.status === "DISABLED") return null;
  const override = yolaTenantOverride();
  if (override && override !== phone.tenantId) return null;
  return phone.tenantId;
}

export async function tenantOwnsYola(tenantId: string) {
  const phoneNumberId = yolaPhoneNumberId();
  if (!phoneNumberId || !tenantId) return false;
  const owner = await resolveYolaTenantId(phoneNumberId);
  return owner === tenantId;
}

export async function sessionCanReadYola(session: SessionPayload, tenantId: string) {
  if (!yolaRoleAllowed(session.role)) return false;
  if (!(await canAccessTenant(session, tenantId))) return false;
  return tenantOwnsYola(tenantId);
}

const PAYMENT_CONFIG_ROLES = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "CLIENT_ADMIN"]);

export async function sessionCanConfigureYolaPayment(session: SessionPayload, tenantId: string) {
  if (!PAYMENT_CONFIG_ROLES.has(session.role)) return false;
  return sessionCanReadYola(session, tenantId);
}
