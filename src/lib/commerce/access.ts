import type { SessionPayload } from "@/lib/auth";

type AccessSession = Pick<SessionPayload, "role" | "isAgencyStaff" | "mode">;

export function canReadCommerce(session: AccessSession): boolean {
  if (session.mode === "platform") return false;
  if (session.isAgencyStaff) return true;
  return (
    session.role === "CLIENT_ADMIN" ||
    session.role === "HQ_MARKETING" ||
    session.role === "HQ_OPS" ||
    session.role === "REGIONAL"
  );
}

export function canWriteCommerce(session: AccessSession): boolean {
  if (session.mode === "platform") return false;
  if (session.isAgencyStaff) return true;
  return session.role === "CLIENT_ADMIN";
}

/** Product rows are always filtered by the merchant tenant. */
export function productListWhere(tenantId: string, status: "ACTIVE" | "ARCHIVED" | "ALL") {
  if (!tenantId) {
    throw new Error("tenant required");
  }
  return {
    tenantId,
    ...(status === "ALL" ? {} : { status }),
  };
}

export function sameTenant(resourceTenantId: string, tenantId: string): boolean {
  return Boolean(tenantId) && resourceTenantId === tenantId;
}
