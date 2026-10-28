import type { EsVersion } from "@/lib/conversations/es-launch";

/** Platform gate. Unset means coexistence launch stays off. Not a per-workspace flag. */
export function coexistenceLaunchEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.WHATSAPP_COEXISTENCE_ENABLED === "true";
}

/** v2/v3 are served as v4. v5 only when META_ES_VERSION is exactly v5. */
export function embeddedSignupVersion(env: Record<string, string | undefined> = process.env): EsVersion {
  return env.META_ES_VERSION === "v5" ? "v5" : "v4";
}
