import type { BookingProviderMode, BookingState, PaymentState } from "./types";

export const PROVIDER_OPERATIONS = [
  "getCapabilities",
  "getAvailability",
  "getQuote",
  "createBooking",
  "holdReservation",
  "confirmBooking",
  "getBooking",
  "cancelBooking",
  "getBookingStatus",
  "getPaymentStatus",
  "findByIdempotencyKey",
] as const;
export type ProviderOperation = (typeof PROVIDER_OPERATIONS)[number];

export const PROVIDER_ERROR_CODES = [
  "UNSUPPORTED",
  "UNAVAILABLE",
  "TIMEOUT",
  "RETRYABLE",
  "CONFLICT",
  "MISSING_REFERENCE",
  "NOT_AUTHORITATIVE",
  "IDEMPOTENCY_CONFLICT",
  "POLICY_BLOCKED",
] as const;
export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

export type ProviderFailure = {
  ok: false;
  code: ProviderErrorCode;
  retryable: boolean;
  message: string;
};

export type ProviderSuccess<T> = {
  ok: true;
  data: T;
  replay: boolean;
};

export type ProviderResult<T> = ProviderSuccess<T> | ProviderFailure;

export type OperationSupport = "supported" | "unsupported";

export type ProviderCapabilities = {
  providerId: string;
  mode: BookingProviderMode;
  operations: Record<ProviderOperation, OperationSupport>;
  supportsHold: boolean;
  /** True only when this adapter owns capacity. External systems stay authoritative. */
  authoritativeForCapacity: boolean;
  /** Booking adapters do not verify money in this milestone. */
  canVerifyPayment: boolean;
  /** The adapter will send a key. This is not a promise that the provider deduplicates. */
  acceptsIdempotencyKey: boolean;
  /**
   * True only when the provider documents that the same key returns the original
   * reservation and never creates a second one. A timeout is not this guarantee.
   */
  guaranteesIdempotency: boolean;
};

export type AvailabilitySlot = {
  offeringId: string;
  startsAt: string;
  locationId: string;
};

export type AvailabilityData = {
  slots: AvailabilitySlot[];
  authoritative: boolean;
  handoffUrl: string | null;
  handoffReference: string | null;
};

export type QuoteData = {
  currency: "IDR";
  amountIdr: number;
  /** A quote is not a hold and not a confirmed price guarantee. */
  guaranteed: false;
};

export type ProviderBooking = {
  bookingRef: string;
  state: BookingState;
  slotKey: string;
  providerReference: string | null;
  referenceAuthoritative: boolean;
  handoffUrl: string | null;
};

export type ScopedCommand = {
  tenantId: string;
  locationId: string;
  idempotencyKey: string;
  requestHash: string;
};

export type AvailabilityQuery = ScopedCommand & {
  offeringId: string;
  knownSlots: readonly AvailabilitySlot[] | null;
};

export type QuoteQuery = ScopedCommand & {
  offeringId: string;
  unitPriceIdr: number | null;
};

export type CreateBookingCommand = ScopedCommand & {
  offeringId: string;
  startsAt: string;
  merchantConfirmed: boolean;
};

export type HoldCommand = CreateBookingCommand;

export type ConfirmCommand = ScopedCommand & {
  bookingRef: string;
  merchantConfirmed: boolean;
};

export type BookingLookup = {
  tenantId: string;
  locationId: string;
  bookingRef: string;
};

export type CancelCommand = BookingLookup & {
  idempotencyKey: string;
};

export type PaymentLookup = {
  tenantId: string;
  attemptRef: string;
};

export type IdempotencyLookupQuery = {
  tenantId: string;
  locationId: string;
  idempotencyKey: string;
};

/** A null booking is authoritative only when the provider looked up this key and found nothing. */
export type IdempotencyLookup = {
  found: ProviderBooking | null;
  authoritative: boolean;
};

/**
 * Every adapter exposes the same methods.
 * Unsupported operations return UNSUPPORTED. They do not throw and they do not invent a booking.
 */
export interface BookingProvider {
  getCapabilities(): ProviderCapabilities;
  getAvailability(input: AvailabilityQuery): Promise<ProviderResult<AvailabilityData>>;
  getQuote(input: QuoteQuery): Promise<ProviderResult<QuoteData>>;
  createBooking(input: CreateBookingCommand): Promise<ProviderResult<ProviderBooking>>;
  holdReservation(input: HoldCommand): Promise<ProviderResult<ProviderBooking>>;
  confirmBooking(input: ConfirmCommand): Promise<ProviderResult<ProviderBooking>>;
  getBooking(input: BookingLookup): Promise<ProviderResult<ProviderBooking>>;
  cancelBooking(input: CancelCommand): Promise<ProviderResult<ProviderBooking>>;
  getBookingStatus(input: BookingLookup): Promise<ProviderResult<{ state: BookingState }>>;
  getPaymentStatus(input: PaymentLookup): Promise<ProviderResult<{ status: PaymentState; verified: false }>>;
  findByIdempotencyKey(input: IdempotencyLookupQuery): Promise<ProviderResult<IdempotencyLookup>>;
}

const RETRYABLE: ReadonlySet<ProviderErrorCode> = new Set(["TIMEOUT", "RETRYABLE", "UNAVAILABLE"]);

export function providerError(code: ProviderErrorCode, message: string): ProviderFailure {
  return { ok: false, code, retryable: RETRYABLE.has(code), message };
}

export function unsupported(operation: ProviderOperation): ProviderFailure {
  return providerError("UNSUPPORTED", `${operation} is not offered by this provider.`);
}
