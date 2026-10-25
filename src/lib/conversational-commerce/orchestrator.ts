import { authorize, type Actor } from "./auth";
import { applyPaymentNotice, emptyLedger, type PaymentLedger, type PaymentNotice } from "./payment";
import { phoneCorrelation, refFromMaterial, stableHash } from "./ids";
import { evaluateEligibility, type MerchantEligibility, type OfferingCategory } from "./policy";
import type { ProviderErrorCode } from "./provider";
import type { ProviderRegistry } from "./registry";
import type { Booking, CommerceTransaction, CustomerExperience, PaymentState, TransactionEvent } from "./types";

export type ReserveCommand = {
  actor: Actor;
  tenantId: string;
  locationId: string;
  providerId: string;
  offeringId: string;
  startsAt: string;
  idempotencyKey: string;
  experience: CustomerExperience;
  category: OfferingCategory;
  merchantEligibility: MerchantEligibility;
  approvalEvidenceRef: string | null;
  merchantConfirmed: boolean;
};

export type ReserveResult = {
  ok: boolean;
  replay: boolean;
  code: "OK" | ProviderErrorCode | "CROSS_TENANT" | "LOCATION_FORBIDDEN" | "NOT_FOUND";
  retryable: boolean;
  resolutionRequired: boolean;
  message: string;
  transaction: CommerceTransaction | null;
  booking: Booking | null;
  handoffUrl: string | null;
  handoffReference: string | null;
};

export type OrchestratorState = {
  idempotency: Map<string, { hash: string; result: ReserveResult }>;
  inflight: Map<string, { hash: string; transactionRef: string; result: ReserveResult }>;
  bookings: Map<string, Booking>;
  transactions: Map<string, CommerceTransaction>;
  ledgers: Map<string, PaymentLedger>;
  events: TransactionEvent[];
};

export function createOrchestratorState(): OrchestratorState {
  return {
    idempotency: new Map(),
    inflight: new Map(),
    bookings: new Map(),
    transactions: new Map(),
    ledgers: new Map(),
    events: [],
  };
}

export async function reserve(
  command: ReserveCommand,
  deps: { registry: ProviderRegistry; state: OrchestratorState; now: string },
): Promise<ReserveResult> {
  const scope = { tenantId: command.tenantId, locationId: command.locationId };
  const allowed = authorize(command.actor, scope, "write");
  if (!allowed.ok) return failure(allowed.code, allowed.code === "CROSS_TENANT" ? "Tenant mismatch." : "Location is outside this actor.", false);

  if (phoneCorrelation(command.idempotencyKey) || phoneCorrelation(command.offeringId)) {
    return failure("NOT_AUTHORITATIVE", "A phone number cannot correlate a booking or a payment.", false);
  }

  const hash = stableHash({
    tenantId: command.tenantId,
    locationId: command.locationId,
    providerId: command.providerId,
    offeringId: command.offeringId,
    startsAt: command.startsAt,
    experience: command.experience,
    category: command.category,
    merchantConfirmed: command.merchantConfirmed,
  });
  const storageKey = `${command.tenantId}:${command.idempotencyKey}`;
  const stored = deps.state.idempotency.get(storageKey);
  if (stored) {
    if (stored.hash !== hash) return failure("IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different request.", false);
    return { ...clone(stored.result), replay: true };
  }
  const pending = deps.state.inflight.get(storageKey);
  if (pending) {
    if (pending.hash !== hash) return failure("IDEMPOTENCY_CONFLICT", "This idempotency key is waiting on a different request.", false);
    return { ...clone(pending.result), replay: true };
  }

  const policy = evaluateEligibility({
    merchantEligibility: command.merchantEligibility,
    offeringCategory: command.category,
    experience: command.experience,
    approvalEvidenceRef: command.approvalEvidenceRef,
  });
  if (policy.transactional !== "ALLOW") {
    const result = failure("POLICY_BLOCKED", policy.reasons[0] ?? "Transactional commerce is blocked.", false);
    remember(deps.state, storageKey, hash, result);
    return result;
  }

  const resolved = deps.registry.resolve(scope, command.providerId);
  if (!resolved.ok) {
    const result = failure("NOT_FOUND", "No provider connection is registered for this tenant.", false);
    remember(deps.state, storageKey, hash, result);
    return result;
  }

  const capabilities = resolved.provider.getCapabilities();
  const hold = capabilities.supportsHold && capabilities.operations.holdReservation === "supported";
  const create = capabilities.operations.createBooking === "supported";
  if (!hold && !create) {
    const result = failure("UNSUPPORTED", "This provider cannot hold or create a reservation.", false);
    remember(deps.state, storageKey, hash, result);
    return result;
  }

  const transactionRef = refFromMaterial("CTX", storageKey);
  const request = {
    tenantId: command.tenantId,
    locationId: command.locationId,
    idempotencyKey: command.idempotencyKey,
    requestHash: hash,
    offeringId: command.offeringId,
    startsAt: command.startsAt,
    merchantConfirmed: command.merchantConfirmed,
  };
  const response = hold ? await resolved.provider.holdReservation(request) : await resolved.provider.createBooking(request);

  if (!response.ok && response.code === "TIMEOUT") {
    const result = failure("TIMEOUT", response.message, false);
    result.resolutionRequired = true;
    result.transaction = openTransaction(command, transactionRef, "PENDING_RESOLUTION");
    deps.state.transactions.set(transactionRef, result.transaction);
    deps.state.ledgers.set(transactionRef, emptyLedger());
    deps.state.inflight.set(storageKey, { hash, transactionRef, result: clone(result) });
    pushEvent(deps.state, command.tenantId, transactionRef, "provider.timeout", deps.now, { providerId: command.providerId });
    return clone(result);
  }

  if (!response.ok) {
    const result = failure(response.code, response.message, false);
    const failed = openTransaction(command, transactionRef, "FAILED");
    deps.state.transactions.set(transactionRef, failed);
    deps.state.ledgers.set(transactionRef, emptyLedger());
    result.transaction = failed;
    remember(deps.state, storageKey, hash, result);
    pushEvent(deps.state, command.tenantId, transactionRef, "provider.rejected", deps.now, { code: response.code });
    return clone(result);
  }

  const external = resolved.mode === "EXTERNAL_API" || resolved.mode === "EXTERNAL_CHECKOUT";
  if ((response.data.state === "CONFIRMED" || response.data.state === "HELD") && external && !response.data.providerReference) {
    const result = failure("MISSING_REFERENCE", "The external provider did not return a booking reference.", false);
    result.transaction = openTransaction(command, transactionRef, "FAILED");
    deps.state.transactions.set(transactionRef, result.transaction);
    deps.state.ledgers.set(transactionRef, emptyLedger());
    remember(deps.state, storageKey, hash, result);
    return clone(result);
  }

  const booking = bookingFrom(command, transactionRef, resolved.mode, response.data);
  const transaction = openTransaction(command, transactionRef, booking.state === "CONFIRMED" ? "COMMITTED" : "IN_PROGRESS");
  transaction.bookingRef = booking.bookingRef;
  deps.state.bookings.set(booking.bookingRef, booking);
  deps.state.transactions.set(transactionRef, transaction);
  deps.state.ledgers.set(transactionRef, emptyLedger());
  const result: ReserveResult = {
    ok: true,
    replay: response.replay,
    code: "OK",
    retryable: false,
    resolutionRequired: false,
    message: booking.state === "CONFIRMED" ? "Booking confirmed. Payment has not started." : "Reservation recorded. Payment has not started.",
    transaction,
    booking,
    handoffUrl: null,
    handoffReference: null,
  };
  remember(deps.state, storageKey, hash, result);
  pushEvent(deps.state, command.tenantId, transactionRef, "booking.updated", deps.now, { state: booking.state });
  return clone(result);
}

export function releaseTimedOut(
  state: OrchestratorState,
  actor: Actor,
  idempotencyKey: string,
): { ok: true } | { ok: false; code: "NOT_FOUND" | "CROSS_TENANT" | "LOCATION_FORBIDDEN" } {
  const pending = state.inflight.get(`${actor.tenantId}:${idempotencyKey}`);
  if (!pending) return { ok: false, code: "NOT_FOUND" };
  const transaction = state.transactions.get(pending.transactionRef);
  if (!transaction || transaction.tenantId !== actor.tenantId) return { ok: false, code: "NOT_FOUND" };
  const allowed = authorize(actor, transaction, "write");
  if (!allowed.ok) return allowed;
  state.inflight.delete(`${actor.tenantId}:${idempotencyKey}`);
  return { ok: true };
}

export async function cancelReservation(
  command: { actor: Actor; bookingRef: string; idempotencyKey: string },
  deps: { registry: ProviderRegistry; state: OrchestratorState; now: string },
): Promise<ReserveResult> {
  const booking = deps.state.bookings.get(command.bookingRef);
  if (!booking) return failure("NOT_FOUND", "Booking was not found.", false);
  const allowed = authorize(command.actor, booking, "write");
  if (!allowed.ok) return failure(allowed.code, "Booking is outside this actor.", false);

  const resolved = deps.registry.resolve(booking, booking.providerId);
  if (!resolved.ok) return failure("NOT_FOUND", "No provider connection is registered for this tenant.", false);
  const response = await resolved.provider.cancelBooking({
    tenantId: booking.tenantId,
    locationId: booking.locationId,
    bookingRef: booking.bookingRef,
    idempotencyKey: command.idempotencyKey,
  });
  if (!response.ok) return failure(response.code, response.message, response.retryable);

  booking.state = response.data.state;
  const transaction = deps.state.transactions.get(booking.transactionRef);
  if (transaction) transaction.state = "CLOSED";
  pushEvent(deps.state, booking.tenantId, booking.transactionRef, "booking.cancelled", deps.now, { state: booking.state });
  return {
    ok: true,
    replay: false,
    code: "OK",
    retryable: false,
    resolutionRequired: false,
    message: "Booking cancelled. Payment status was not changed.",
    transaction: transaction ?? null,
    booking: { ...booking },
    handoffUrl: null,
    handoffReference: null,
  };
}

export function recordPayment(
  state: OrchestratorState,
  actor: Actor,
  transactionRef: string,
  notice: PaymentNotice,
  now: string,
):
  | { ok: true; effect: string; ledger: PaymentLedger; transaction: CommerceTransaction; booking: Booking | null }
  | { ok: false; code: "NOT_FOUND" | "CROSS_TENANT" | "LOCATION_FORBIDDEN" } {
  const transaction = state.transactions.get(transactionRef);
  if (!transaction) return { ok: false, code: "NOT_FOUND" };
  const allowed = authorize(actor, transaction, "write");
  if (!allowed.ok) return { ok: false, code: allowed.code };
  const current = state.ledgers.get(transactionRef) ?? emptyLedger();
  const applied = applyPaymentNotice(current, notice);
  state.ledgers.set(transactionRef, applied.ledger);
  transaction.paymentStatus = applied.ledger.status;
  transaction.verifiedPaid = applied.ledger.verifiedPaid;
  pushEvent(state, transaction.tenantId, transactionRef, notice.type, now, {
    effect: applied.effect,
    paymentStatus: applied.ledger.status,
  });
  const booking = transaction.bookingRef ? state.bookings.get(transaction.bookingRef) ?? null : null;
  return { ok: true, effect: applied.effect, ledger: applied.ledger, transaction: { ...transaction }, booking: booking ? { ...booking } : null };
}

export function readBooking(
  state: OrchestratorState,
  actor: Actor,
  bookingRef: string,
): { ok: true; booking: Booking } | { ok: false; code: "NOT_FOUND" | "CROSS_TENANT" | "LOCATION_FORBIDDEN" } {
  const booking = state.bookings.get(bookingRef);
  if (!booking) return { ok: false, code: "NOT_FOUND" };
  const allowed = authorize(actor, booking, "read");
  if (!allowed.ok) return { ok: false, code: allowed.code };
  return { ok: true, booking: { ...booking } };
}

function bookingFrom(
  command: ReserveCommand,
  transactionRef: string,
  mode: Booking["providerMode"],
  data: { bookingRef: string; state: Booking["state"]; slotKey: string; providerReference: string | null; referenceAuthoritative: boolean },
): Booking {
  return {
    bookingRef: data.bookingRef,
    tenantId: command.tenantId,
    locationId: command.locationId,
    transactionRef,
    providerId: command.providerId,
    providerMode: mode,
    slotKey: data.slotKey,
    state: data.state,
    providerReference: data.providerReference,
    referenceAuthoritative: data.referenceAuthoritative,
    idempotencyKey: command.idempotencyKey,
  };
}

function openTransaction(
  command: ReserveCommand,
  transactionRef: string,
  state: CommerceTransaction["state"],
): CommerceTransaction {
  return {
    transactionRef,
    tenantId: command.tenantId,
    locationId: command.locationId,
    intentRef: refFromMaterial("CIN", `${command.tenantId}:${command.idempotencyKey}`),
    providerId: command.providerId,
    state,
    bookingRef: null,
    orderRef: null,
    paymentStatus: "NOT_STARTED" satisfies PaymentState,
    verifiedPaid: false,
  };
}

function failure(
  code: ReserveResult["code"],
  message: string,
  retryable: boolean,
): ReserveResult {
  return {
    ok: false,
    replay: false,
    code,
    retryable,
    resolutionRequired: false,
    message,
    transaction: null,
    booking: null,
    handoffUrl: null,
    handoffReference: null,
  };
}

function remember(state: OrchestratorState, storageKey: string, hash: string, result: ReserveResult) {
  state.idempotency.set(storageKey, { hash, result: clone(result) });
}

function pushEvent(
  state: OrchestratorState,
  tenantId: string,
  transactionRef: string,
  type: string,
  at: string,
  payload: Record<string, string | number | boolean | null>,
) {
  state.events.push({
    eventId: refFromMaterial("CEV", `${transactionRef}:${type}:${state.events.length}`),
    tenantId,
    transactionRef,
    type,
    at,
    payload,
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
