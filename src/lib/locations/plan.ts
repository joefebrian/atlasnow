import { ATLAS_PRICE_IDR } from "@/lib/marketing/pricing";

export const TENANT_PLANS = ["free", "silver", "gold", "platinum", "diamond"] as const;
export type TenantPlan = (typeof TENANT_PLANS)[number];

export function isTenantPlan(value: string): value is TenantPlan {
  return (TENANT_PLANS as readonly string[]).includes(value);
}

export function isFreePlan(plan: string | null | undefined): boolean {
  return !plan || plan === "free";
}

export function freeStoreOutletCap(): number {
  return ATLAS_PRICE_IDR.freeIncluded;
}

/** Free hard-stops at 2 store outlets (not HQ). Paid plans do not hard-stop here. */
export function freeOutletCapReached(plan: string | null | undefined, storeCount: number): boolean {
  return isFreePlan(plan) && storeCount >= freeStoreOutletCap();
}

export function freeOutletCapMessage(): string {
  return `Free includes ${ATLAS_PRICE_IDR.freeIncluded} outlets. Stop at ${ATLAS_PRICE_IDR.freeIncluded} — upgrade to add outlet #3.`;
}

export class LocationCapError extends Error {
  readonly code = "FREE_OUTLET_CAP";
  constructor(message?: string) {
    super(message || freeOutletCapMessage());
    this.name = "LocationCapError";
  }
}

export function isLocationCapError(e: unknown): e is LocationCapError {
  return (
    e instanceof LocationCapError ||
    (typeof e === "object" &&
      e !== null &&
      (e as { code?: string }).code === "FREE_OUTLET_CAP")
  );
}
