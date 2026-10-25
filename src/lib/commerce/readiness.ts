export const COMMERCE_NOT_CONNECTED = "NOT_CONNECTED" as const;

export type CommerceReadinessView = {
  whatsappBusiness: { status: typeof COMMERCE_NOT_CONNECTED; detail: string };
  metaCatalog: { status: typeof COMMERCE_NOT_CONNECTED; detail: string };
  paymentGateway: { status: typeof COMMERCE_NOT_CONNECTED; detail: string };
};

export type StoredReadiness = {
  whatsappStatus: string;
  catalogStatus: string;
  paymentStatus: string;
  paymentProviderLabel: string;
};

function channel(stored: string, idle: string): { status: typeof COMMERCE_NOT_CONNECTED; detail: string } {
  const flagged = stored && stored !== COMMERCE_NOT_CONNECTED;
  return {
    status: COMMERCE_NOT_CONNECTED,
    detail: flagged ? `${idle} A saved flag is not a live connection.` : idle,
  };
}

/** Read the stored flags. This slice has no live WhatsApp, catalog, or payment link, so none of them show as connected. */
export function presentStoredReadiness(row: StoredReadiness | null): CommerceReadinessView {
  return {
    whatsappBusiness: channel(
      row?.whatsappStatus || COMMERCE_NOT_CONNECTED,
      "WhatsApp Business is not connected for catalog commerce."
    ),
    metaCatalog: channel(
      row?.catalogStatus || COMMERCE_NOT_CONNECTED,
      "Meta Catalog permission is not connected. Product sync stays off."
    ),
    paymentGateway: channel(
      row?.paymentStatus || COMMERCE_NOT_CONNECTED,
      row?.paymentProviderLabel
        ? "A payment label is stored. Checkout is off. Credentials are not stored."
        : "No payment gateway is configured. Checkout is off. Credentials are not stored."
    ),
  };
}

/** Empty merchant. Same as a row that has never been connected. */
export function commerceReadiness(): CommerceReadinessView {
  return presentStoredReadiness(null);
}

export function readinessWriteData() {
  return {
    whatsappStatus: COMMERCE_NOT_CONNECTED,
    catalogStatus: COMMERCE_NOT_CONNECTED,
    paymentStatus: COMMERCE_NOT_CONNECTED,
    paymentProviderLabel: "",
  };
}
