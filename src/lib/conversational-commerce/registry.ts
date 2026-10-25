import type { BookingProviderMode } from "./types";
import type { BookingProvider } from "./provider";

export type RegisteredProvider = {
  tenantId: string;
  locationId: string | null;
  providerId: string;
  mode: BookingProviderMode;
  provider: BookingProvider;
};

export type ProviderRegistry = {
  register(row: RegisteredProvider): void;
  resolve(scope: { tenantId: string; locationId: string | null }, providerId: string):
    | { ok: true; provider: BookingProvider; mode: BookingProviderMode }
    | { ok: false; code: "NOT_FOUND" };
};

/**
 * Resolves a provider inside one tenant.
 * Another tenant's registration is not found, even when the provider id matches.
 * A location-specific row wins over a tenant-wide row.
 */
export function createRegistry(): ProviderRegistry {
  const rows: RegisteredProvider[] = [];
  return {
    register(row) {
      rows.push(row);
    },
    resolve(scope, providerId) {
      const owned = rows.filter((row) => row.tenantId === scope.tenantId && row.providerId === providerId);
      const exact = owned.find((row) => row.locationId != null && row.locationId === scope.locationId);
      const tenantWide = owned.find((row) => row.locationId == null);
      const match = exact ?? tenantWide;
      if (!match) return { ok: false, code: "NOT_FOUND" };
      if (match.locationId != null && match.locationId !== scope.locationId) {
        return { ok: false, code: "NOT_FOUND" };
      }
      return { ok: true, provider: match.provider, mode: match.mode };
    },
  };
}
