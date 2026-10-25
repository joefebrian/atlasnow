/** Action names the orchestrator can check. This is not production RBAC. */
export type CommerceAction = "read" | "write";

export type Actor = {
  tenantId: string;
  /** Null means every location of this tenant. An empty list means none. */
  locationIds: readonly string[] | null;
  /**
   * Null or omitted means every action in this tenant.
   * A list allows only those actions. Read does not imply write.
   */
  permissions?: readonly CommerceAction[] | null;
};

export type AuthDecision =
  | { ok: true }
  | { ok: false; code: "CROSS_TENANT" | "LOCATION_FORBIDDEN" | "FORBIDDEN" };

export function authorize(
  actor: Actor,
  scope: { tenantId: string; locationId: string | null },
  action: CommerceAction,
): AuthDecision {
  if (!actor.tenantId || actor.tenantId !== scope.tenantId) {
    return { ok: false, code: "CROSS_TENANT" };
  }
  if (actor.permissions != null && !actor.permissions.includes(action)) {
    return { ok: false, code: "FORBIDDEN" };
  }
  if (scope.locationId == null || actor.locationIds == null) return { ok: true };
  if (!actor.locationIds.includes(scope.locationId)) {
    return { ok: false, code: "LOCATION_FORBIDDEN" };
  }
  return { ok: true };
}
