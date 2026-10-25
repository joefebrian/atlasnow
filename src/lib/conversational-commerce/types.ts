/**
 * Canonical vocabulary for conversational commerce.
 * These types are not Prisma models and do not create tables.
 */

export const CUSTOMER_EXPERIENCES = ["WHATSAPP_CATALOG", "WHATSAPP_FLOW", "WHATSAPP_CHAT"] as const;
export type CustomerExperience = (typeof CUSTOMER_EXPERIENCES)[number];

export const BOOKING_PROVIDER_MODES = ["NATIVE", "EXTERNAL_API", "EXTERNAL_CHECKOUT", "MANUAL"] as const;
export type BookingProviderMode = (typeof BOOKING_PROVIDER_MODES)[number];

export const PAYMENT_PROVIDER_MODES = [
  "MERCHANT_PAYMENT_GATEWAY",
  "EXTERNAL_BOOKING_PROVIDER",
  "OFFLINE_RECONCILIATION",
] as const;
export type PaymentProviderMode = (typeof PAYMENT_PROVIDER_MODES)[number];

export const BOOKING_STATES = [
  "REQUESTED",
  "HELD",
  "CONFIRMED",
  "COMPLETED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type BookingState = (typeof BOOKING_STATES)[number];

export const TRANSACTION_STATES = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING_RESOLUTION",
  "COMMITTED",
  "CLOSED",
  "FAILED",
] as const;
export type TransactionState = (typeof TRANSACTION_STATES)[number];

export const PAYMENT_STATES = [
  "NOT_STARTED",
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "CHARGEBACK",
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const INTENT_TYPES = [
  "PRODUCT_ORDER",
  "STRUCTURED_RESPONSE",
  "BOOKING_REQUEST",
  "QUALIFIED_INQUIRY",
  "ENGAGEMENT",
] as const;
export type IntentType = (typeof INTENT_TYPES)[number];

export const EVIDENCE_LEVELS = ["A", "B", "C", "D"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export type TenantScope = {
  tenantId: string;
  locationId: string | null;
};

/** Customer demand before a provider reservation exists. Phone is not an identity. */
export type CommerceIntent = {
  intentRef: string;
  tenantId: string;
  locationId: string | null;
  experience: CustomerExperience;
  intentType: IntentType;
  qualified: boolean;
  /** Masked label supplied by the caller. Not a phone number and not a join key. */
  customerRef: string | null;
  /** Existing CommerceOrder.reference when the source is a catalog order. Not a write. */
  commerceOrderRef: string | null;
};

/**
 * Immutable orchestration record.
 * Payment status and booking status are separate fields on purpose.
 */
export type CommerceTransaction = {
  transactionRef: string;
  tenantId: string;
  locationId: string | null;
  intentRef: string | null;
  providerId: string;
  state: TransactionState;
  bookingRef: string | null;
  /** Points at CommerceOrder.reference or a later order record. This module does not write it. */
  orderRef: string | null;
  paymentStatus: PaymentState;
  verifiedPaid: boolean;
};

/**
 * Reservation lifecycle. Capacity for an external provider stays with that provider.
 * A native booking in this milestone exists only inside the mock.
 */
export type Booking = {
  bookingRef: string;
  tenantId: string;
  locationId: string;
  transactionRef: string;
  providerId: string;
  providerMode: BookingProviderMode;
  slotKey: string;
  state: BookingState;
  providerReference: string | null;
  /** True only when the provider issued a reference for this reservation. */
  referenceAuthoritative: boolean;
  idempotencyKey: string;
};

/**
 * Link to an order. Catalog orders remain CommerceOrder.
 * This alias is not a new table and is not payment.
 */
export type OrderLink = {
  kind: "COMMERCE_ORDER" | "PROVIDER_ORDER";
  tenantId: string;
  locationId: string | null;
  orderRef: string;
  paymentStatus: PaymentState;
};

/** Future booking or payment connection. Not CommerceConnection, which is Meta Catalog only. */
export type ProviderConnection = {
  tenantId: string;
  locationId: string | null;
  providerId: string;
  mode: BookingProviderMode | PaymentProviderMode;
  /** Server-side credential reference. Never a raw token and never a card number. */
  credentialRef: string | null;
};

/** Merchant-specific external id. Never a customer phone number. */
export type ProviderReference = {
  tenantId: string;
  locationId: string | null;
  owner: "BOOKING" | "PAYMENT" | "CHECKOUT";
  ownerRef: string;
  providerId: string;
  externalId: string;
};

export type PaymentAttempt = {
  attemptRef: string;
  tenantId: string;
  locationId: string | null;
  transactionRef: string;
  providerMode: PaymentProviderMode;
  /** Gateway id or merchant reference. Separate from the booking reference. */
  externalId: string | null;
  status: PaymentState;
  amountIdr: number | null;
  currency: "IDR";
};

export type TransactionEvent = {
  eventId: string;
  tenantId: string;
  transactionRef: string;
  type: string;
  at: string;
  /** Scalar payload only. No card data and no access tokens. */
  payload: Record<string, string | number | boolean | null>;
};

export type AttributionChannel =
  | "META_CTWA"
  | "GOOGLE_ADS"
  | "GOOGLE_SEARCH"
  | "GOOGLE_MAPS"
  | "WEBSITE_UTM"
  | "QR"
  | "DIRECT_WHATSAPP"
  | "UNKNOWN";

export type AttributionConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export type AttributionTouchpoint = {
  tenantId: string;
  locationId: string | null;
  transactionRef: string | null;
  channel: AttributionChannel;
  confidence: AttributionConfidence;
  /** False for aggregated Search Console or Business Profile metrics. */
  userLevel: boolean;
  ctwaClid: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  qrCampaignId: string | null;
  warnings: string[];
};

export function isPaymentState(value: string): value is PaymentState {
  return (PAYMENT_STATES as readonly string[]).includes(value);
}

export function isBookingState(value: string): value is BookingState {
  return (BOOKING_STATES as readonly string[]).includes(value);
}
