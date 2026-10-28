export type ConnectionMode = "COEXISTENCE" | "CLOUD_API_ONLY";
export type EsVersion = "v4" | "v5";

export type ConnectionDecision =
  | { mode: ConnectionMode }
  | { error: "coexistence_disabled" | "not_business_app" | "use_coexistence_option" };

/** Official Embedded Signup extras for the active configuration version. */
export function embeddedSignupExtras(mode: ConnectionMode, version: EsVersion): Record<string, unknown> {
  if (version === "v5") {
    if (mode === "COEXISTENCE") return { version: "v5" };
    return {
      version: "v5",
      features: [{ name: "whatsapp_business_app_onboarding", enabled: false }],
    };
  }
  if (mode === "COEXISTENCE") {
    return {
      version: "v4",
      setup: {},
      featureType: "whatsapp_business_app_onboarding",
      sessionInfoVersion: "3",
    };
  }
  return { version: "v4" };
}

export function parseConnectionMode(value: unknown): ConnectionMode | null {
  return value === "COEXISTENCE" || value === "CLOUD_API_ONLY" ? value : null;
}

/**
 * Decide the stored mode after Meta returns the session and phone fields.
 * Call this only once Graph has answered. A pre-check for a disabled launch
 * belongs before the code exchange.
 */
export function decideConnection(input: {
  sessionCoexistence: boolean;
  graphOnBizApp: boolean;
  requestedMode: ConnectionMode | null;
  launchEnabled: boolean;
}): ConnectionDecision {
  const actual = input.sessionCoexistence || input.graphOnBizApp;
  if ((actual || input.requestedMode === "COEXISTENCE") && !input.launchEnabled) {
    return { error: "coexistence_disabled" };
  }
  if (input.requestedMode === "COEXISTENCE" && !actual) return { error: "not_business_app" };
  if (input.requestedMode === "CLOUD_API_ONLY" && actual) return { error: "use_coexistence_option" };
  if (actual) return { mode: "COEXISTENCE" };
  return { mode: "CLOUD_API_ONLY" };
}

/**
 * A Coexistence finish must add a different phone. An already connected
 * Cloud API number is left untouched, including when the session omits a phone id.
 */
export function pickCoexistencePhone(input: {
  sessionPhoneId: string;
  listedIds: string[];
  connectedIds: string[];
}): { phoneNumberId: string } | { error: "existing_cloud_number" | "phone_not_in_session" } {
  const connected = new Set(input.connectedIds.map((id) => id.trim()).filter(Boolean));
  const sessionPhoneId = input.sessionPhoneId.trim();
  if (sessionPhoneId) {
    if (connected.has(sessionPhoneId)) return { error: "existing_cloud_number" };
    return { phoneNumberId: sessionPhoneId };
  }
  const listed = input.listedIds.map((id) => id.trim()).filter(Boolean);
  const fresh = listed.filter((id) => !connected.has(id));
  if (fresh.length === 1) return { phoneNumberId: fresh[0] };
  if (listed.length > 0 && fresh.length === 0) return { error: "existing_cloud_number" };
  return { error: "phone_not_in_session" };
}

/** Webhook progress must not downgrade a finished or declined sync. */
export function keepSyncStatus(previous: string, incoming: string): string {
  if (incoming === "declined" || incoming === "error") return incoming;
  if (previous === "declined" || previous === "error") return previous;
  if (incoming === "complete") return "complete";
  if (previous === "complete") return previous;
  return incoming || previous;
}
