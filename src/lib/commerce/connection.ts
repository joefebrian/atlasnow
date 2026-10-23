/** Merchant Meta connection. Pure state. No token leaves this module's public view. */

export const CONNECTION_STATES = [
  "NOT_CONNECTED",
  "SETUP_REQUIRED",
  "CONNECTED",
  "PERMISSION_ERROR",
  "DISCONNECTED",
] as const;

export type ConnectionState = (typeof CONNECTION_STATES)[number];

/** Official scopes for catalog commerce. catalog_management is not on the live Meta app until the founder adds it. */
export const COMMERCE_META_SCOPES = [
  "business_management",
  "whatsapp_business_management",
  "catalog_management",
] as const;

export const WHATSAPP_SCOPES = ["business_management", "whatsapp_business_management"] as const;
export const CATALOG_SCOPES = ["business_management", "catalog_management"] as const;

export type ConnectionChannel = {
  status: ConnectionState;
  detail: string;
};

export type CommerceConnectionView = {
  whatsapp: ConnectionChannel;
  catalog: ConnectionChannel;
  payment: { status: "NOT_CONNECTED"; detail: string };
  businessId: string;
  businessName: string;
  wabaId: string;
  phoneNumberId: string;
  phoneMasked: string;
  catalogId: string;
  catalogName: string;
  grantedScopes: string[];
  missingScopes: string[];
  lastError: string;
  liveSyncEnabled: boolean;
};

export type ConnectionRecord = {
  businessId: string;
  businessName: string;
  wabaId: string;
  phoneNumberId: string;
  phoneMasked: string;
  catalogId: string;
  catalogName: string;
  grantedScopes: string;
  tokenEnc: string | null;
  lastError: string;
  permissionError: boolean;
  disconnectedAt: Date | null;
};

const PAYMENT_DETAIL = "No payment gateway is configured. Checkout is off. Credentials are not stored.";

export function parseScopes(value: string): string[] {
  return [...new Set(value.split(/[,\s]+/).map((scope) => scope.trim()).filter(Boolean))];
}

export function missingScopes(granted: string[], required: readonly string[]): string[] {
  const owned = new Set(granted);
  return required.filter((scope) => !owned.has(scope));
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `•••• ${digits.slice(-4)}`;
}

export function channelStatus(opts: {
  hasToken: boolean;
  disconnected: boolean;
  missing: string[];
  permissionError: boolean;
  ready: boolean;
  idle: string;
  setup: string;
  ok: string;
}): ConnectionChannel {
  if (!opts.hasToken && opts.disconnected) {
    return { status: "DISCONNECTED", detail: "Disconnected. Connect again to continue. No catalog request is sent." };
  }
  if (!opts.hasToken) {
    return { status: "NOT_CONNECTED", detail: opts.idle };
  }
  if (opts.permissionError || opts.missing.length > 0) {
    const scopes = opts.missing.length ? ` Missing ${opts.missing.join(", ")}.` : "";
    return {
      status: "PERMISSION_ERROR",
      detail: `Meta did not grant the permission this connection needs.${scopes} No catalog request is sent.`,
    };
  }
  if (!opts.ready) return { status: "SETUP_REQUIRED", detail: opts.setup };
  return { status: "CONNECTED", detail: opts.ok };
}

export function presentConnection(row: ConnectionRecord | null, liveSyncEnabled: boolean): CommerceConnectionView {
  const granted = parseScopes(row?.grantedScopes || "");
  const hasToken = Boolean(row?.tokenEnc);
  const disconnected = Boolean(row?.disconnectedAt);
  const whatsappMissing = missingScopes(granted, WHATSAPP_SCOPES);
  const catalogMissing = missingScopes(granted, CATALOG_SCOPES);
  const whatsapp = channelStatus({
    hasToken,
    disconnected,
    missing: whatsappMissing,
    permissionError: Boolean(row?.permissionError) && whatsappMissing.length > 0,
    ready: Boolean(row?.wabaId && row?.phoneNumberId),
    idle: "WhatsApp Business is not connected for catalog commerce.",
    setup: "Choose the WhatsApp Business account and phone number for this merchant.",
    ok: row?.phoneMasked
      ? `WhatsApp Business is connected (${row.phoneMasked}). Checkout stays off.`
      : "WhatsApp Business is connected. Checkout stays off.",
  });
  const catalog = channelStatus({
    hasToken,
    disconnected,
    missing: catalogMissing,
    permissionError: Boolean(row?.permissionError) || catalogMissing.length > 0,
    ready: Boolean(row?.catalogId),
    idle: "Meta Catalog is not connected. Product sync stays off.",
    setup: "Choose a Meta catalog for this merchant. Live sync stays off until permission is verified.",
    ok: row?.catalogName
      ? `Catalog “${row.catalogName}” is linked. Live push stays off until the server switch is on.`
      : "A Meta catalog is linked. Live push stays off until the server switch is on.",
  });
  return {
    whatsapp,
    catalog,
    payment: { status: "NOT_CONNECTED", detail: PAYMENT_DETAIL },
    businessId: row?.businessId || "",
    businessName: row?.businessName || "",
    wabaId: row?.wabaId || "",
    phoneNumberId: row?.phoneNumberId || "",
    phoneMasked: row?.phoneMasked || "",
    catalogId: row?.catalogId || "",
    catalogName: row?.catalogName || "",
    grantedScopes: granted,
    missingScopes: missingScopes(granted, COMMERCE_META_SCOPES),
    lastError: row?.lastError || "",
    liveSyncEnabled,
  };
}

export function emptyConnection(liveSyncEnabled = false): CommerceConnectionView {
  return presentConnection(null, liveSyncEnabled);
}

/** Public JSON must not carry the encrypted token or a raw access token. */
export function connectionJson(view: CommerceConnectionView): string {
  return JSON.stringify(view);
}
