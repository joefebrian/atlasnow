import type { Actor, CommerceAction } from "./auth";
import type { Role } from "@/lib/roles";

/**
 * Maps an AtlasNow session onto the orchestrator actor.
 * Read and write match canReadCommerce and canWriteCommerce.
 * BRANCH location scope is Membership.locationId. This file does not grant BRANCH commerce access.
 */
export type CommerceSessionView = {
  tenantId: string;
  role: Role;
  mode: "platform" | "brand" | "agency";
  isAgencyStaff: boolean;
  locationId: string | null;
};

const READ_ROLES = new Set<Role>(["CLIENT_ADMIN", "HQ_MARKETING", "HQ_OPS", "REGIONAL"]);

export function actorFromCommerceSession(session: CommerceSessionView): Actor {
  const blocked = session.mode === "platform";
  const read = !blocked && (session.isAgencyStaff || READ_ROLES.has(session.role));
  const write = !blocked && (session.isAgencyStaff || session.role === "CLIENT_ADMIN");
  const permissions: CommerceAction[] = [];
  if (read) permissions.push("read");
  if (write) permissions.push("write");
  const locationIds = session.role === "BRANCH" ? (session.locationId ? [session.locationId] : []) : null;
  return { tenantId: session.tenantId, locationIds, permissions };
}
