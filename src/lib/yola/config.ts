/**
 * Canonical YOLA keys. Older demo names are read as aliases.
 * Missing values stay empty. Nothing here invents a Flow id or a token.
 */

function read(name: string) {
  return (process.env[name] || "").trim();
}

export function yolaAccessToken() {
  return read("YOLA_WA_ACCESS_TOKEN");
}

export function yolaWabaId() {
  return read("YOLA_WABA_ID") || read("YOLA_WA_WABA_ID");
}

/** Configured phone-number id. No default. Unset means YOLA does not handle traffic. */
export function yolaPhoneNumberId() {
  return read("YOLA_WA_PHONE_NUMBER_ID") || read("YOLA_FLOW_PHONE_NUMBER_ID");
}

export function yolaPublishedFlowId() {
  return read("YOLA_PUBLISHED_FLOW_ID");
}

export function yolaTemplateName() {
  return read("YOLA_TEMPLATE_NAME");
}

export function yolaTenantOverride() {
  return read("YOLA_TENANT_ID");
}

export function flagEnabled(name: string) {
  return process.env[name] === "true";
}

export function flowSendEnabled() {
  return flagEnabled("YOLA_FLOW_SEND_ENABLED");
}

export function bulkMarketingEnabled() {
  return flagEnabled("YOLA_BULK_MARKETING_ENABLED");
}

export function livePaymentsEnabled() {
  return flagEnabled("YOLA_LIVE_PAYMENTS_ENABLED");
}

export function ticketLiveIssuanceEnabled() {
  return flagEnabled("YOLA_TICKET_LIVE_ISSUANCE_ENABLED");
}

/** Separate from Flow invites. Default off. An empty allowlist sends to nobody. */
export function pilotLinkSendEnabled() {
  return flagEnabled("YOLA_PILOT_LINK_SEND_ENABLED");
}

const TEST_SENDER_DIGITS = "15554362839";

/** Digits only. The Meta test sender is never a recipient. */
export function pilotAllowlist(): string[] {
  const seen = new Set<string>();
  for (const part of read("YOLA_PILOT_ALLOWLIST").split(",")) {
    const digits = part.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) continue;
    if (digits === TEST_SENDER_DIGITS) continue;
    seen.add(digits);
  }
  return [...seen];
}

export function recipientAllowed(waId: string) {
  const digits = waId.replace(/\D/g, "");
  if (!digits || digits === TEST_SENDER_DIGITS) return false;
  return pilotAllowlist().includes(digits);
}

export const YOLA_SETUP = {
  token: "Set YOLA_WA_ACCESS_TOKEN in /opt/atlasnow/.env and on the atlas service. Do not paste the token into chat. Status stays UNVERIFIED until a Graph read succeeds.",
  waba: "Set YOLA_WABA_ID to the live WABA after confirming it in WhatsApp Manager. Do not assume 1736564147618215 until that read matches.",
  phone: "Set YOLA_WA_PHONE_NUMBER_ID to the YOLA phone-number id. Events for every other phone number stay on the existing inbox path.",
  flow: "Set YOLA_PUBLISHED_FLOW_ID from the approved template button. Do not create or edit the published Flow.",
  template: "Set YOLA_TEMPLATE_NAME only when WhatsApp Manager shows one approved Marketing template. A name alone does not approve it.",
  payments: "Xendit stays sandbox until YOLA_LIVE_PAYMENTS_ENABLED=true and a merchant key exists. Do not set that flag in this release.",
  tickets: "Tickets stay TEST until YOLA_TICKET_LIVE_ISSUANCE_ENABLED=true. Leave it false.",
} as const;
