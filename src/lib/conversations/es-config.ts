import type { EsVersion } from "@/lib/conversations/es-launch";

/**
 * Coexistence stays off unless the platform flag is exactly true and the
 * workspace id is listed in WHATSAPP_COEXISTENCE_TENANT_IDS. An empty list
 * launches nobody, including when the flag is true.
 */
export function coexistenceLaunchEnabled(
  env: Record<string, string | undefined> = process.env,
  tenantId?: string | null
): boolean {
  if (env.WHATSAPP_COEXISTENCE_ENABLED !== "true") return false;
  const allow = (env.WHATSAPP_COEXISTENCE_TENANT_IDS || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const tenant = (tenantId || "").trim();
  if (!tenant || allow.length === 0) return false;
  return allow.includes(tenant);
}

/** v2/v3 are served as v4. v5 only when META_ES_VERSION is exactly v5. */
export function embeddedSignupVersion(env: Record<string, string | undefined> = process.env): EsVersion {
  return env.META_ES_VERSION === "v5" ? "v5" : "v4";
}
