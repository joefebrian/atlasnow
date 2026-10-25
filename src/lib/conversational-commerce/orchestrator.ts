import { authorize, type Actor } from "./auth";
import {
  aggregateAttemptLedgers,
  applyPaymentNotice,
  emptyLedger,
  verifyPaymentNotice,
  type PaymentLedger,
  type PaymentProof,
  type RawPaymentNotice,
} from "./payment";
import { phoneCorrelation, refFromMaterial, stableHash } from "./ids";
import { evaluateEligibility, type ApprovalEvidence, type MerchantEligibility, type OfferingCategory } from "./policy";
import type { ProviderErrorCode } from "./provider";
import type { ProviderRegistry } from "./registry";
import type { Booking, BookingState, CommerceTransaction, CustomerExperience, PaymentState, TransactionEvent } from "./types";

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
  approvalEvidence: ApprovalEvidence;
  merchantConfirmed: boolean;
};

export type ReserveResult = {
  ok: boolean;
  replay: boolean;
  code:
    | "OK"
    | ProviderErrorCode
    | "CROSS_TENANT"
    | "LOCATION_FORBIDDEN"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "RECONCILIATION_REQUIRED"
    | "SCOPE_MISMATCH"
    | "TERMINAL";
  retryable: boolean;
  resolutionRequired: boolean;
  message: string;
  transaction: CommerceTransaction | null;
  booking: Booking | null;
  handoffUrl: string | null;
  handoffReference: string | null;
};

type InflightReservation = {
  hash: string;
  transactionRef: string;
  result: ReserveResult;
  /** Set only after an authoritative lookup reported no reservation. */
  absenceVerified: boolean;
  hold: boolean;
  request: {
    tenantId: string;
    locationId: string;
    providerId: string;
    offeringId: string;
    startsAt: string;
    idempotencyKey: string;
    merchantConfirmed: boolean;
  };
};

export type StoredPaymentAttempt = {
  tenantId: string;
  transactionRef: string;
  attemptRef: string;
  providerId: string;
  expectedAmountIdr: number;
  currency: "IDR";
};

export type OrchestratorState = {
  idempotency: Map<string, { hash: string; result: ReserveResult }>;
  inflight: Map<string, InflightReservation>;
  bookings: Map<string, Booking>;
  transactions: Map<string, CommerceTransaction>;
  ledgers: Map<string, PaymentLedger>;
  paymentAttempts: Map<string, StoredPaymentAttempt>;
  events: TransactionEvent[];
};

export function createOrchestratorState(): OrchestratorState {
  return {
    idempotency: new Map(),
    inflight: new Map(),
    bookings: new Map(),
    transactions: new Map(),
    ledgers: new Map(),
    paymentAttempts: new Map(),
    events: [],
  };
}

export async function reserve(
  command: ReserveCommand,
  deps: { registry: ProviderRegistry; state: OrchestratorState; now: string },
): Promise<ReserveResult> {
  const scope = { tenantId: command.tenantId, locationId: command.locationId };
  const allowed = authorize(command.actor, scope, "write");
  if (!allowed.ok) return failure(allowed.code, authMessage(allowed.code), false);

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
    approvalStatus: command.approvalEvidence?.status ?? "",
    approvalReference: command.approvalEvidence?.reference ?? "",
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
    if (!pending.absenceVerified) return { ...clone(pending.result), replay: true };
    pending.absenceVerified = false;
  }

  const policy = evaluateEligibility({
    merchantEligibility: command.merchantEligibility,
    offeringCategory: command.category,
    experience: command.experience,
    approvalEvidence: command.approvalEvidence,
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
    deps.state.inflight.set(storageKey, {
      hash,
      transactionRef,
      result: clone(result),
      absenceVerified: false,
      hold,
      request: requestSnapshot(command),
    });
    pushEvent(deps.state, command.tenantId, transactionRef, "provider.timeout", deps.now, { providerId: command.providerId });
    return clone(result);
  }

  if (!response.ok) {
    const result = failure(response.code, response.message, false);
    const failed = openTransaction(command, transactionRef, "FAILED");
    deps.state.transactions.set(transactionRef, failed);
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
    remember(deps.state, storageKey, hash, result);
    return clone(result);
  }

  const booking = bookingFrom(command, transactionRef, resolved.mode, response.data);
  const transaction = settleTransaction(deps.state, command, transactionRef, booking.state);
  transaction.bookingRef = booking.bookingRef;
  deps.state.bookings.set(booking.bookingRef, booking);
  deps.state.transactions.set(transactionRef, transaction);
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

/**
 * A person acknowledging a timeout does not authorize another booking create.
 * The inflight record stays in PENDING_RESOLUTION until reconcileTimedOut.
 */
export function releaseTimedOut(
  state: OrchestratorState,
  actor: Actor,
  idempotencyKey: string,
): { ok: false; code: "NOT_FOUND" | "CROSS_TENANT" | "LOCATION_FORBIDDEN" | "FORBIDDEN" | "RECONCILIATION_REQUIRED" } {
  const pending = state.inflight.get(`${actor.tenantId}:${idempotencyKey}`);
  if (!pending) return { ok: false, code: "NOT_FOUND" };
  const transaction = state.transactions.get(pending.transactionRef);
  if (!transaction || transaction.tenantId !== actor.tenantId) return { ok: false, code: "NOT_FOUND" };
  const allowed = authorize(actor, transaction, "write");
  if (!allowed.ok) return allowed;
  return { ok: false, code: "RECONCILIATION_REQUIRED" };
}

/**
 * Resolves a timed-out reserve without treating the timeout as proof of absence.
 * Lookup, a terminal provider state, or a documented idempotency guarantee is required.
 * This function does not create a second reservation when the first one already exists.
 */
export async function reconcileTimedOut(
  command: { actor: Actor; tenantId: string; locationId: string; providerId: string; idempotencyKey: string },
  deps: { registry: ProviderRegistry; state: OrchestratorState; now: string },
): Promise<ReserveResult> {
  const storageKey = `${command.tenantId}:${command.idempotencyKey}`;
  const pending = deps.state.inflight.get(storageKey);
  if (!pending) return failure("NOT_FOUND", "No timed-out reservation is waiting for this key.", false);
  if (command.tenantId !== pending.request.tenantId || command.idempotencyKey !== pending.request.idempotencyKey) {
    return failure("NOT_FOUND", "No timed-out reservation is waiting for this key.", false);
  }
  const transaction = deps.state.transactions.get(pending.transactionRef);
  if (!transaction || transaction.tenantId !== pending.request.tenantId) {
    return failure("NOT_FOUND", "No timed-out reservation is waiting for this key.", false);
  }
  const allowed = authorize(
    command.actor,
    { tenantId: pending.request.tenantId, locationId: pending.request.locationId },
    "write",
  );
  if (!allowed.ok) return failure(allowed.code, authMessage(allowed.code), false);
  if (command.providerId !== pending.request.providerId || command.locationId !== pending.request.locationId) {
    return stayPending(
      deps.state,
      pending,
      "SCOPE_MISMATCH",
      "Reconciliation must use the original provider and location. No lookup was sent.",
    );
  }
  if (transaction.state !== "PENDING_RESOLUTION") {
    return { ...clone(pending.result), replay: true };
  }
  const resolved = deps.registry.resolve(
    { tenantId: pending.request.tenantId, locationId: pending.request.locationId },
    pending.request.providerId,
  );
  if (!resolved.ok) return stayPending(deps.state, pending, "RECONCILIATION_REQUIRED", "No provider connection is registered for the original reservation.");
  const capabilities = resolved.provider.getCapabilities();
  if (capabilities.providerId !== pending.request.providerId) {
    return stayPending(deps.state, pending, "RECONCILIATION_REQUIRED", "The resolved provider is not the original connection.");
  }
  const sameRequest = {
    ...pending.request,
    requestHash: pending.hash,
  };
  if (capabilities.guaranteesIdempotency) {
    const response = pending.hold
      ? await resolved.provider.holdReservation(sameRequest)
      : await resolved.provider.createBooking(sameRequest);
    if (!response.ok) {
      const again = clone(pending.result);
      again.resolutionRequired = true;
      again.message = "The provider still has not returned an authoritative result. No second booking was authorized.";
      return again;
    }
    return adoptResolved(deps.state, pending, resolved.mode, response.data, deps.now);
  }
  const lookup = await resolved.provider.findByIdempotencyKey({
    tenantId: pending.request.tenantId,
    locationId: pending.request.locationId,
    idempotencyKey: pending.request.idempotencyKey,
  });
  if (!lookup.ok) {
    const again = stayPending(
      deps.state,
      pending,
      lookup.code === "UNSUPPORTED" ? "RECONCILIATION_REQUIRED" : lookup.code,
      "Provider lookup did not produce an authoritative result. The create was not retried.",
    );
    return again;
  }
  if (lookup.data.found) {
    if (lookup.data.found.slotKey !== expectedSlot(pending)) {
      return stayPending(
        deps.state,
        pending,
        "RECONCILIATION_REQUIRED",
        "The recovered booking does not match the original request. No second booking was authorized.",
      );
    }
    const terminal = terminalFailure(lookup.data.found.state);
    if (terminal) {
      transaction.state = "FAILED";
      const result = failure("TERMINAL", "The provider reported a terminal reservation. The idempotency key stays closed.", false);
      result.transaction = { ...transaction };
      remember(deps.state, storageKey, pending.hash, result);
      deps.state.inflight.delete(storageKey);
      return clone(result);
    }
    return adoptResolved(deps.state, pending, resolved.mode, lookup.data.found, deps.now);
  }
  if (lookup.data.authoritative) {
    pending.absenceVerified = true;
    const again = clone(pending.result);
    again.resolutionRequired = true;
    again.message = "Authoritative lookup found no reservation. One retry may use the same idempotency key.";
    return again;
  }
  const blocked = clone(pending.result);
  blocked.code = "RECONCILIATION_REQUIRED";
  blocked.resolutionRequired = true;
  blocked.message = "Absence is not authoritative. No retry was authorized.";
  return blocked;
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

export function openPaymentAttempt(
  state: OrchestratorState,
  actor: Actor,
  input: { transactionRef: string; attemptRef: string; providerId: string; expectedAmountIdr: number },
):
  | { ok: true; replay: boolean }
  | { ok: false; code: "NOT_FOUND" | "CROSS_TENANT" | "LOCATION_FORBIDDEN" | "FORBIDDEN" | "MISMATCH" | "ATTEMPT_CONFLICT" } {
  const transaction = state.transactions.get(input.transactionRef);
  if (!transaction) return { ok: false, code: "NOT_FOUND" };
  const allowed = authorize(actor, transaction, "write");
  if (!allowed.ok) return { ok: false, code: allowed.code };
  if (!input.attemptRef.trim() || !input.providerId.trim()) return { ok: false, code: "MISMATCH" };
  if (!Number.isSafeInteger(input.expectedAmountIdr) || input.expectedAmountIdr < 1) return { ok: false, code: "MISMATCH" };
  const key = attemptKey(transaction.tenantId, input.attemptRef);
  const existing = state.paymentAttempts.get(key);
  if (existing) {
    const same =
      existing.tenantId === transaction.tenantId &&
      existing.transactionRef === transaction.transactionRef &&
      existing.providerId === input.providerId &&
      existing.expectedAmountIdr === input.expectedAmountIdr &&
      existing.currency === "IDR";
    if (!same) return { ok: false, code: "ATTEMPT_CONFLICT" };
    return { ok: true, replay: true };
  }
  state.paymentAttempts.set(key, {
    tenantId: transaction.tenantId,
    transactionRef: transaction.transactionRef,
    attemptRef: input.attemptRef,
    providerId: input.providerId,
    expectedAmountIdr: input.expectedAmountIdr,
    currency: "IDR",
  });
  if (!state.ledgers.has(key)) state.ledgers.set(key, emptyLedger());
  return { ok: true, replay: false };
}

export function recordPayment(
  state: OrchestratorState,
  actor: Actor,
  input: {
    transactionRef: string;
    notice: RawPaymentNotice;
    proof: PaymentProof | null;
    connection: { tenantId: string; providerId: string; secret: string };
  },
  now: string,
):
  | { ok: true; effect: string; ledger: PaymentLedger; transaction: CommerceTransaction; booking: Booking | null }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "CROSS_TENANT"
        | "LOCATION_FORBIDDEN"
        | "FORBIDDEN"
        | "NO_ATTEMPT"
        | "UNVERIFIED"
        | "MISMATCH"
        | "REJECTED_EVIDENCE"
        | "ATTEMPT_CONFLICT";
    } {
  const transaction = state.transactions.get(input.transactionRef);
  if (!transaction) return { ok: false, code: "NOT_FOUND" };
  const allowed = authorize(actor, transaction, "write");
  if (!allowed.ok) return { ok: false, code: allowed.code };
  const attempt = state.paymentAttempts.get(attemptKey(transaction.tenantId, input.notice.attemptRef));
  if (!attempt) return { ok: false, code: "NO_ATTEMPT" };
  if (attempt.transactionRef !== transaction.transactionRef || attempt.tenantId !== transaction.tenantId) {
    return { ok: false, code: "MISMATCH" };
  }
  if (input.connection.tenantId !== transaction.tenantId || input.connection.providerId !== attempt.providerId) {
    return { ok: false, code: "MISMATCH" };
  }
  const verified = verifyPaymentNotice({
    notice: input.notice,
    proof: input.proof,
    secret: input.connection.secret,
    expectation: {
      tenantId: attempt.tenantId,
      providerId: attempt.providerId,
      attemptRef: attempt.attemptRef,
      transactionRef: attempt.transactionRef,
      currency: "IDR",
      amountIdr: attempt.expectedAmountIdr,
    },
  });
  if (!verified.ok) return { ok: false, code: verified.code };
  const key = attemptKey(attempt.tenantId, attempt.attemptRef);
  const current = state.ledgers.get(key) ?? emptyLedger();
  if (current.providerReference && current.providerReference !== verified.event.providerReference) {
    return { ok: false, code: "MISMATCH" };
  }
  if (refundBelongsToAnotherAttempt(state, transaction, attempt.attemptRef, verified.event)) {
    return { ok: false, code: "MISMATCH" };
  }
  if (verified.event.type === "payment.paid" && anotherAttemptIsCapturing(state, transaction, attempt.attemptRef)) {
    return { ok: false, code: "ATTEMPT_CONFLICT" };
  }
  const applied = applyPaymentNotice(current, verified.event);
  state.ledgers.set(key, applied.ledger);
  const aggregate = aggregateAttemptLedgers(attemptLedgers(state, transaction));
  transaction.paymentStatus = aggregate.status;
  transaction.verifiedPaid = aggregate.verifiedPaid;
  pushEvent(state, transaction.tenantId, input.transactionRef, input.notice.type, now, {
    effect: applied.effect,
    paymentStatus: aggregate.status,
    attemptRef: attempt.attemptRef,
  });
  const booking = transaction.bookingRef ? state.bookings.get(transaction.bookingRef) ?? null : null;
  return { ok: true, effect: applied.effect, ledger: applied.ledger, transaction: { ...transaction }, booking: booking ? { ...booking } : null };
}

export function readBooking(
  state: OrchestratorState,
  actor: Actor,
  bookingRef: string,
): { ok: true; booking: Booking } | { ok: false; code: "NOT_FOUND" | "CROSS_TENANT" | "LOCATION_FORBIDDEN" | "FORBIDDEN" } {
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

function requestSnapshot(command: ReserveCommand): InflightReservation["request"] {
  return {
    tenantId: command.tenantId,
    locationId: command.locationId,
    providerId: command.providerId,
    offeringId: command.offeringId,
    startsAt: command.startsAt,
    idempotencyKey: command.idempotencyKey,
    merchantConfirmed: command.merchantConfirmed,
  };
}

function settleTransaction(
  state: OrchestratorState,
  command: ReserveCommand,
  transactionRef: string,
  bookingState: BookingState,
): CommerceTransaction {
  const nextState = bookingState === "CONFIRMED" || bookingState === "COMPLETED" ? "COMMITTED" : "IN_PROGRESS";
  const existing = state.transactions.get(transactionRef);
  if (existing && existing.state === "PENDING_RESOLUTION") {
    existing.state = nextState;
    return existing;
  }
  return openTransaction(command, transactionRef, nextState);
}

function adoptResolved(
  state: OrchestratorState,
  pending: InflightReservation,
  mode: Booking["providerMode"],
  data: { bookingRef: string; state: BookingState; slotKey: string; providerReference: string | null; referenceAuthoritative: boolean },
  now: string,
): ReserveResult {
  if (data.slotKey !== expectedSlot(pending)) {
    return stayPending(
      state,
      pending,
      "RECONCILIATION_REQUIRED",
      "The recovered booking does not match the original request. No second booking was authorized.",
    );
  }
  const external = mode === "EXTERNAL_API" || mode === "EXTERNAL_CHECKOUT";
  if ((data.state === "CONFIRMED" || data.state === "HELD") && external && !data.providerReference) {
    const result = failure("MISSING_REFERENCE", "The external provider did not return a booking reference.", false);
    result.resolutionRequired = true;
    result.transaction = state.transactions.get(pending.transactionRef) ?? null;
    return result;
  }
  const transaction = state.transactions.get(pending.transactionRef);
  if (!transaction) return failure("NOT_FOUND", "No timed-out reservation is waiting for this key.", false);
  const booking: Booking = {
    bookingRef: data.bookingRef,
    tenantId: pending.request.tenantId,
    locationId: pending.request.locationId,
    transactionRef: pending.transactionRef,
    providerId: pending.request.providerId,
    providerMode: mode,
    slotKey: data.slotKey,
    state: data.state,
    providerReference: data.providerReference,
    referenceAuthoritative: data.referenceAuthoritative,
    idempotencyKey: pending.request.idempotencyKey,
  };
  transaction.bookingRef = booking.bookingRef;
  transaction.state = data.state === "CONFIRMED" || data.state === "COMPLETED" ? "COMMITTED" : "IN_PROGRESS";
  state.bookings.set(booking.bookingRef, booking);
  const result: ReserveResult = {
    ok: true,
    replay: false,
    code: "OK",
    retryable: false,
    resolutionRequired: false,
    message: "Recovered the original provider reservation. No second booking was created.",
    transaction,
    booking,
    handoffUrl: null,
    handoffReference: null,
  };
  remember(state, `${pending.request.tenantId}:${pending.request.idempotencyKey}`, pending.hash, result);
  state.inflight.delete(`${pending.request.tenantId}:${pending.request.idempotencyKey}`);
  pushEvent(state, pending.request.tenantId, pending.transactionRef, "booking.recovered", now, { state: booking.state });
  return clone(result);
}

function expectedSlot(pending: InflightReservation): string {
  return `${pending.request.tenantId}:${pending.request.locationId}:${pending.request.offeringId}:${pending.request.startsAt}`;
}

function stayPending(
  state: OrchestratorState,
  pending: InflightReservation,
  code: ReserveResult["code"],
  message: string,
): ReserveResult {
  const again = clone(pending.result);
  again.ok = false;
  again.replay = false;
  again.code = code;
  again.resolutionRequired = true;
  again.booking = null;
  again.transaction = state.transactions.get(pending.transactionRef) ?? again.transaction;
  again.message = message;
  return again;
}

function attemptKey(tenantId: string, attemptRef: string): string {
  return `${tenantId}:${attemptRef}`;
}

function attemptLedgers(
  state: OrchestratorState,
  transaction: CommerceTransaction,
): PaymentLedger[] {
  const ledgers: PaymentLedger[] = [];
  for (const attempt of state.paymentAttempts.values()) {
    if (attempt.tenantId !== transaction.tenantId || attempt.transactionRef !== transaction.transactionRef) continue;
    const ledger = state.ledgers.get(attemptKey(attempt.tenantId, attempt.attemptRef));
    if (ledger) ledgers.push(ledger);
  }
  return ledgers;
}

function anotherAttemptIsCapturing(
  state: OrchestratorState,
  transaction: CommerceTransaction,
  attemptRef: string,
): boolean {
  for (const attempt of state.paymentAttempts.values()) {
    if (attempt.tenantId !== transaction.tenantId || attempt.transactionRef !== transaction.transactionRef) continue;
    if (attempt.attemptRef === attemptRef) continue;
    const ledger = state.ledgers.get(attemptKey(attempt.tenantId, attempt.attemptRef));
    if (ledger?.status === "PAID" || ledger?.status === "PARTIALLY_REFUNDED") return true;
  }
  return false;
}

function refundBelongsToAnotherAttempt(
  state: OrchestratorState,
  transaction: CommerceTransaction,
  attemptRef: string,
  event: { type: string; providerReference: string },
): boolean {
  if (event.type !== "payment.refunded" && event.type !== "payment.partially_refunded" && event.type !== "payment.chargeback") {
    return false;
  }
  for (const attempt of state.paymentAttempts.values()) {
    if (attempt.tenantId !== transaction.tenantId || attempt.transactionRef !== transaction.transactionRef) continue;
    if (attempt.attemptRef === attemptRef) continue;
    const ledger = state.ledgers.get(attemptKey(attempt.tenantId, attempt.attemptRef));
    if (ledger?.providerReference && ledger.providerReference === event.providerReference) return true;
  }
  return false;
}

function terminalFailure(state: BookingState): boolean {
  return state === "CANCELLED" || state === "REJECTED" || state === "EXPIRED" || state === "NO_SHOW";
}

function authMessage(code: "CROSS_TENANT" | "LOCATION_FORBIDDEN" | "FORBIDDEN"): string {
  if (code === "CROSS_TENANT") return "Tenant mismatch.";
  if (code === "FORBIDDEN") return "This action is not allowed.";
  return "Location is outside this actor.";
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
