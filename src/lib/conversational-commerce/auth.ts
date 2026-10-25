export type Actor = {
  tenantId: string;
  /** Null means every location of this tenant. An empty list means none. */
  locationIds: readonly string[] | null;
};

export type AuthDecision =
  | { ok: true }
  | { ok: false; code: "CROSS_TENANT" | "LOCATION_FORBIDDEN" };

export function authorize(
  actor: Actor,
  scope: { tenantId: string; locationId: string | null },
  _action: "read" | "write",
): AuthDecision {
  if (!actor.tenantId || actor.tenantId !== scope.tenantId) {
    return { ok: false, code: "CROSS_TENANT" };
  }
  if (scope.locationId == null || actor.locationIds == null) return { ok: true };
  if (!actor.locationIds.includes(scope.locationId)) {
    return { ok: false, code: "LOCATION_FORBIDDEN" };
  }
  return { ok: true };
}
