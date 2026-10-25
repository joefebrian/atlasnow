/**
 * Port-backed reservation orchestrator.
 *
 * CommercePersistence is the source of truth. The maps on OrchestratorState are a
 * read-only compatibility view for existing tests. They are rebuilt from the snapshot.
 * Nothing in this file writes those maps.
 *
 * Provider calls run outside runAtomic. A timeout stays PENDING_RESOLUTION.
 * This module does not claim exactly-once delivery to a provider.
 *
 * createOrchestratorState() does not seed merchant approval. Tests that need the
 * old harness call seedOrchestratorPolicyFixture. That fixture is not Meta approval.
 * The orchestrator does not copy command.approvalEvidence. A snapshot cannot grant
 * VERIFIED approval without the validator seal. Real offer-specific Meta exceptions
 * need a per-offering row. YOLA FUN is not approved.
 */

import { authorize, type Actor } from "./auth";
import { refFromMaterial, phoneCorrelation, stableHash } from "./ids";
import { createMemoryCommerceStore, signPolicyAttestation } from "./memory-store";
import { trustPaymentNotice, type PaymentLedger, type PaymentProof, type RawPaymentNotice } from "./payment";
import { evaluateEligibility, type ApprovalEvidence, type MerchantEligibility, type OfferingCategory } from "./policy";
import type { OutcomeCertainty, ProviderErrorCode } from "./provider";
import type {
  CommercePersistence,
  ConnectionCapabilities,
  PortCode,
  PortResult,
  ReservationDraft,
  StoredBooking,
  StoredInflight,
  StoredTransaction,
} from "./ports";
import type { ProviderRegistry } from "./registry";
import type { Booking, BookingProviderMode, BookingState, CommerceTransaction, CustomerExperience } from "./types";

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
    | "POLICY_DENIED"
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

export type StoredPaymentAttempt = {
  tenantId: string;
  transactionRef: string;
  attemptRef: string;
  providerId: string;
  expectedAmountIdr: number;
  currency: "IDR";
};

/** Same string persistence tests use. It is an in-process fixture key, not a Meta secret. */
export const ORCHESTRATOR_POLICY_KEY = "test-policy-validator";

/** Test-only crash points. Production callers omit this. Hooks throw outside runAtomic. */
export type OrchestratorCrash = {
  afterClaim?: () => void;
  beforePersist?: () => void;
  afterTimeout?: () => void;
  beforeAdopt?: () => void;
};
const FIXTURE_PROCESS = "orchestrator-compat-fixture";
const FIXTURE_REFERENCE = "orchestrator-compat-goods-catalog";
const MOCK_ABSENCE = "mock-absence-v1";

export type OrchestratorState = {
  /** Source of truth. Callers may read a snapshot. Writes go through the functions below. */
  readonly persistence: CommercePersistence;
  /** Compatibility reads. Rebuilt on each access. Not a second writer. */
  readonly bookings: Map<string, Booking>;
  readonly transactions: Map<string, CommerceTransaction>;
  readonly ledgers: Map<string, PaymentLedger>;
  readonly paymentAttempts: Map<string, StoredPaymentAttempt>;
};

export function createOrchestratorState(options?: { persistence?: CommercePersistence }): OrchestratorState {
  const persistence = options?.persistence ?? createMemoryCommerceStore();
  return {
    persistence,
    get bookings() {
      return bookingView(persistence);
    },
    get transactions() {
      return transactionView(persistence);
    },
    get ledgers() {
      return ledgerView(persistence);
    },
    get paymentAttempts() {
      return attemptView(persistence);
    },
  };
}

export async function reserve(
  command: ReserveCommand,
  deps: { registry: ProviderRegistry; state: OrchestratorState; now: string; crash?: OrchestratorCrash },
): Promise<ReserveResult> {
  const allowed = authorize(command.actor, { tenantId: command.tenantId, locationId: command.locationId }, "write");
  if (!allowed.ok) return failure(allowed.code, authMessage(allowed.code), false);
  if (phoneCorrelation(command.idempotencyKey) || phoneCorrelation(command.offeringId)) {
    return failure("NOT_AUTHORITATIVE", "A phone number cannot correlate a booking or a payment.", false);
  }

  const hash = requestHash(command);
  const ports = deps.state.persistence;
  const replayed = replayReserve(ports.exportSnapshot(), command, hash);
  if (replayed) return replayed;

  const policy = evaluateEligibility({
    merchantEligibility: command.merchantEligibility,
    offeringCategory: command.category,
    experience: command.experience,
    approvalEvidence: command.approvalEvidence,
  });
  if (policy.transactional !== "ALLOW") {
    return deny(ports, command, hash, "POLICY_BLOCKED", policy.reasons[0] ?? "Transactional commerce is blocked.");
  }

  const resolved = deps.registry.resolve({ tenantId: command.tenantId, locationId: command.locationId }, command.providerId);
  if (!resolved.ok) return deny(ports, command, hash, "NOT_FOUND", "No provider connection is registered for this tenant.");

  const capabilities = resolved.provider.getCapabilities();
  const hold = capabilities.supportsHold && capabilities.operations.holdReservation === "supported";
  const create = capabilities.operations.createBooking === "supported";
  if (!hold && !create) {
    return deny(ports, command, hash, "UNSUPPORTED", "This provider cannot hold or create a reservation.");
  }
  if (!attested(ports.exportSnapshot(), command)) {
    return deny(ports, command, hash, "POLICY_DENIED", "Stored policy evidence does not approve this merchant, category, and surface.");
  }

  const registered = ensureBookingConnection(ports, command, resolved.provider.getCapabilities(), resolved.mode);
  if (!registered.ok) return failure(asReserveCode(registered.code), registered.message, false);

  const transactionRef = refFromMaterial("CTX", `${command.tenantId}:${command.idempotencyKey}`);
  const claimed = await Promise.resolve(
    ports.idempotency.claim(command.actor, {
      tenantId: command.tenantId,
      locationId: command.locationId,
      providerId: command.providerId,
      idempotencyKey: command.idempotencyKey,
      requestHash: hash,
      slotKey: slotKeyOf(command),
      transactionRef,
      offeringId: command.offeringId,
      startsAt: command.startsAt,
      merchantConfirmed: command.merchantConfirmed,
      experience: command.experience,
      category: command.category,
    }),
  );
  if (!claimed.ok) return failure(asReserveCode(claimed.code), claimed.message, false);
  if (claimed.replay) {
    const reread = replayReserve(ports.exportSnapshot(), command, hash);
    if (reread) return reread;
    return { ...unresolved("TIMEOUT", "The reservation was claimed and has no authoritative outcome.", null), replay: true };
  }
  deps.crash?.afterClaim?.();

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

  if (!response.ok && mayHaveCommitted(response)) {
    return holdUnresolved(ports, command, hash, transactionRef, response.code, response.message, deps);
  }

  if (!response.ok) return deny(ports, command, hash, response.code, response.message);

  const external = resolved.mode === "EXTERNAL_API" || resolved.mode === "EXTERNAL_CHECKOUT";
  const referenceMissing =
    !response.data.bookingRef.trim() ||
    ((response.data.state === "CONFIRMED" || response.data.state === "HELD") && external && !response.data.providerReference?.trim());
  if (referenceMissing) {
    return holdUnresolved(
      ports,
      command,
      hash,
      transactionRef,
      "MISSING_REFERENCE",
      "The provider result did not include a usable booking reference.",
      deps,
    );
  }
  deps.crash?.beforePersist?.();

  const persisted = ports.runAtomic((draft): PortResult<{ transaction: StoredTransaction; booking: StoredBooking }> => {
    const inflight = findInflight(draft.exportSnapshot(), command.tenantId, command.idempotencyKey);
    if (inflight && !inflight.absenceVerified) {
      const noted = draft.idempotency.noteFound(command.actor, command.tenantId, command.idempotencyKey, {
        providerId: command.providerId,
        locationId: command.locationId,
        bookingRef: response.data.bookingRef,
      });
      if (!noted.ok) return noted;
    }
    const opened = draft.bookings.openReservation(
      reservationDraft({
        command,
        requestHash: hash,
        transactionRef,
        mode: resolved.mode,
        bookingRef: response.data.bookingRef,
        providerReference: response.data.providerReference,
        referenceAuthoritative: response.data.referenceAuthoritative,
        now: deps.now,
      }),
    );
    if (!opened.ok) return opened;
    const intent = saveIntent(draft, command);
    if (!intent.ok) return intent;
    const appended = appendEvent(draft, command.actor, command.tenantId, transactionRef, "booking.updated", deps.now, {
      state: opened.value.booking.state,
    });
    if (!appended.ok) return appended;
    return opened;
  });
  if (!persisted.ok) return failure(asReserveCode(persisted.code), persisted.message, false);
  return successResult(persisted.value.transaction, persisted.value.booking, response.replay, false);
}

/**
 * A person acknowledging a timeout does not authorize another booking create.
 * The inflight record stays until reconcileTimedOut.
 */
export function releaseTimedOut(
  state: OrchestratorState,
  actor: Actor,
  idempotencyKey: string,
): { ok: false; code: "NOT_FOUND" | "CROSS_TENANT" | "LOCATION_FORBIDDEN" | "FORBIDDEN" | "RECONCILIATION_REQUIRED" } {
  const pending = findInflight(state.persistence.exportSnapshot(), actor.tenantId, idempotencyKey);
  if (!pending) return { ok: false, code: "NOT_FOUND" };
  const allowed = authorize(actor, { tenantId: pending.tenantId, locationId: pending.locationId }, "write");
  if (!allowed.ok) return allowed;
  return { ok: false, code: "RECONCILIATION_REQUIRED" };
}

/**
 * Resolves a timed-out reserve through the original provider only.
 * Lookup, a terminal provider state, or a documented idempotency guarantee is required.
 * This function does not create a second reservation when the first one already exists.
 */
export async function reconcileTimedOut(
  command: { actor: Actor; tenantId: string; locationId: string; providerId: string; idempotencyKey: string },
  deps: { registry: ProviderRegistry; state: OrchestratorState; now: string; crash?: OrchestratorCrash },
): Promise<ReserveResult> {
  const ports = deps.state.persistence;
  const snap = ports.exportSnapshot();
  const pending = findInflight(snap, command.tenantId, command.idempotencyKey);
  if (!pending) return failure("NOT_FOUND", "No timed-out reservation is waiting for this key.", false);
  const transaction = findTransaction(snap, pending.tenantId, pending.transactionRef);
  if (!transaction) return failure("NOT_FOUND", "No timed-out reservation is waiting for this key.", false);
  const allowed = authorize(command.actor, { tenantId: pending.tenantId, locationId: pending.locationId }, "write");
  if (!allowed.ok) return failure(allowed.code, authMessage(allowed.code), false);
  if (command.providerId !== pending.providerId || command.locationId !== pending.locationId) {
    return unresolved("SCOPE_MISMATCH", "Reconciliation must use the original provider and location. No lookup was sent.", publicTransaction(transaction));
  }
  const booking = findBookingForTransaction(snap, transaction);
  if (transaction.state === "FAILED") return terminalReplay(transaction);
  if (transaction.state !== "PENDING_RESOLUTION" && booking) return successResult(transaction, booking, true, true);

  const resolved = deps.registry.resolve({ tenantId: pending.tenantId, locationId: pending.locationId }, pending.providerId);
  if (!resolved.ok) {
    return unresolved("RECONCILIATION_REQUIRED", "No provider connection is registered for the original reservation.", publicTransaction(transaction));
  }
  const capabilities = resolved.provider.getCapabilities();
  if (capabilities.providerId !== pending.providerId) {
    return unresolved("RECONCILIATION_REQUIRED", "The resolved provider is not the original connection.", publicTransaction(transaction));
  }

  const request = requestFromInflight(pending);
  if (capabilities.guaranteesIdempotency) {
    const hold = capabilities.supportsHold && capabilities.operations.holdReservation === "supported";
    const response = hold ? await resolved.provider.holdReservation(request) : await resolved.provider.createBooking(request);
    if (!response.ok) {
      return unresolved("TIMEOUT", "The provider still has not returned an authoritative result. No second booking was authorized.", publicTransaction(transaction));
    }
    return adoptProviderBooking(ports, command.actor, pending, resolved.mode, response.data, deps.now, deps.crash);
  }

  const lookup = await resolved.provider.findByIdempotencyKey({
    tenantId: pending.tenantId,
    locationId: pending.locationId,
    idempotencyKey: pending.idempotencyKey,
  });
  if (!lookup.ok) {
    const code = lookup.code === "UNSUPPORTED" ? "RECONCILIATION_REQUIRED" : asReserveCode(lookup.code);
    return unresolved(code, "Provider lookup did not produce an authoritative result. The create was not retried.", publicTransaction(transaction));
  }
  if (lookup.data.found) {
    if (lookup.data.found.slotKey !== pending.slotKey) {
      return unresolved(
        "RECONCILIATION_REQUIRED",
        "The recovered booking does not match the original request. No second booking was authorized.",
        publicTransaction(transaction),
      );
    }
    if (terminalBooking(lookup.data.found.state)) {
      const failed = failTransaction(ports, command.actor, pending.tenantId, pending.transactionRef);
      if (!failed.ok) return failure(asReserveCode(failed.code), failed.message, false);
      return terminalReplay(failed.value);
    }
    return adoptProviderBooking(ports, command.actor, pending, resolved.mode, lookup.data.found, deps.now, deps.crash);
  }
  if (lookup.data.authoritative) {
    const noted = ports.idempotency.noteAbsence(command.actor, pending.tenantId, pending.idempotencyKey, {
      providerId: pending.providerId,
      locationId: pending.locationId,
      requirementId: MOCK_ABSENCE,
      satisfied: true,
      observedEmpty: true,
    });
    if (!noted.ok) return unresolved(asReserveCode(noted.code), noted.message, publicTransaction(transaction));
    return unresolved("TIMEOUT", "Authoritative lookup found no reservation. One retry may use the same idempotency key.", publicTransaction(transaction));
  }
  return unresolved("RECONCILIATION_REQUIRED", "Absence is not authoritative. No retry was authorized.", publicTransaction(transaction));
}

export async function cancelReservation(
  command: { actor: Actor; bookingRef: string; idempotencyKey: string },
  deps: { registry: ProviderRegistry; state: OrchestratorState; now: string },
): Promise<ReserveResult> {
  const bookingSnap = deps.state.persistence.exportSnapshot();
  const booking = bookingForTenant(bookingSnap, command.actor.tenantId, command.bookingRef);
  if (!booking) return failure(foreignBookingCode(bookingSnap, command.actor.tenantId, command.bookingRef), "Booking was not found.", false);
  const allowed = authorize(command.actor, booking, "write");
  if (!allowed.ok) return failure(allowed.code, "Booking is outside this actor.", false);
  const resolved = deps.registry.resolve(booking, booking.providerId);
  if (!resolved.ok) return failure("NOT_FOUND", "No provider connection is registered for this tenant.", false);
  const expectedVersion = booking.version;
  const response = await resolved.provider.cancelBooking({
    tenantId: booking.tenantId,
    locationId: booking.locationId,
    bookingRef: booking.bookingRef,
    idempotencyKey: command.idempotencyKey,
  });
  if (!response.ok) return failure(response.code, response.message, response.retryable);
  if (response.data.state !== "CANCELLED") {
    return failure("RECONCILIATION_REQUIRED", "The provider did not cancel the booking.", false);
  }
  const persisted = deps.state.persistence.runAtomic((draft): PortResult<unknown> => {
    const moved = draft.bookings.transition(command.actor, {
      tenantId: booking.tenantId,
      bookingRef: booking.bookingRef,
      expectedVersion,
      to: "CANCELLED",
      nowIso: deps.now,
    });
    if (!moved.ok) return moved;
    return appendEvent(draft, command.actor, booking.tenantId, booking.transactionRef, "booking.cancelled", deps.now, {
      state: "CANCELLED",
    });
  });
  if (!persisted.ok) return failure(asReserveCode(persisted.code), persisted.message, false);
  const after = deps.state.persistence.exportSnapshot();
  const saved = after.bookings.find((row) => row.tenantId === booking.tenantId && row.bookingRef === booking.bookingRef);
  const transaction = findTransaction(after, booking.tenantId, booking.transactionRef);
  if (!saved || !transaction) return failure("NOT_FOUND", "Booking was not found.", false);
  return {
    ok: true,
    replay: false,
    code: "OK",
    retryable: false,
    resolutionRequired: false,
    message: "Booking cancelled. Payment status was not changed.",
    transaction: publicTransaction(transaction),
    booking: publicBooking(saved),
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
  const paymentSnap = state.persistence.exportSnapshot();
  const transaction = transactionForTenant(paymentSnap, actor.tenantId, input.transactionRef);
  if (!transaction) return { ok: false, code: foreignTransactionCode(paymentSnap, actor.tenantId, input.transactionRef) };
  const allowed = authorize(actor, transaction, "write");
  if (!allowed.ok) return { ok: false, code: allowed.code };
  if (!input.attemptRef.trim() || !input.providerId.trim()) return { ok: false, code: "MISMATCH" };
  if (!Number.isSafeInteger(input.expectedAmountIdr) || input.expectedAmountIdr < 1) return { ok: false, code: "MISMATCH" };
  const registered = state.persistence.connections.register(actor, {
    tenantId: transaction.tenantId,
    locationId: transaction.locationId,
    providerId: input.providerId,
    kind: "PAYMENT",
    mode: "MERCHANT_PAYMENT_GATEWAY",
    capabilities: paymentCapabilities(input.providerId),
  });
  if (!registered.ok) return paymentFailure(registered.code);
  const opened = state.persistence.payments.openAttempt(actor, {
    tenantId: transaction.tenantId,
    locationId: transaction.locationId,
    transactionRef: transaction.transactionRef,
    attemptRef: input.attemptRef,
    providerId: input.providerId,
    providerMode: "MERCHANT_PAYMENT_GATEWAY",
    expectedAmountIdr: input.expectedAmountIdr,
  });
  if (!opened.ok) return paymentFailure(opened.code);
  return { ok: true, replay: opened.replay };
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
  _now: string,
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
  const snap = state.persistence.exportSnapshot();
  const transaction = transactionForTenant(snap, actor.tenantId, input.transactionRef);
  if (!transaction) return { ok: false, code: foreignTransactionCode(snap, actor.tenantId, input.transactionRef) };
  const allowed = authorize(actor, transaction, "write");
  if (!allowed.ok) return { ok: false, code: allowed.code };
  const attempt = snap.attempts.find((row) => row.tenantId === transaction.tenantId && row.attemptRef === input.notice.attemptRef);
  if (!attempt) return { ok: false, code: "NO_ATTEMPT" };
  if (attempt.transactionRef !== transaction.transactionRef || attempt.tenantId !== transaction.tenantId) {
    return { ok: false, code: "MISMATCH" };
  }
  if (input.connection.tenantId !== transaction.tenantId || input.connection.providerId !== attempt.providerId) {
    return { ok: false, code: "MISMATCH" };
  }
  const verified = trustPaymentNotice({
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
  const ledger = snap.ledgers.find((row) => row.tenantId === attempt.tenantId && row.attemptRef === attempt.attemptRef);
  if (ledger?.ledger.providerReference && ledger.ledger.providerReference !== verified.evidence.event.providerReference) {
    return { ok: false, code: "MISMATCH" };
  }
  const applied = state.persistence.payments.applyEvent(actor, verified.evidence);
  if (!applied.ok) {
    if (applied.code === "REFERENCE_CONFLICT") return { ok: false, code: "MISMATCH" };
    return paymentFailure(applied.code);
  }
  const after = state.persistence.exportSnapshot();
  const saved = findTransaction(after, transaction.tenantId, transaction.transactionRef);
  if (!saved) return { ok: false, code: "NOT_FOUND" };
  const savedBooking = findBookingForTransaction(after, saved);
  return {
    ok: true,
    effect: applied.value.effect,
    ledger: applied.value.ledger,
    transaction: publicTransaction(saved),
    booking: savedBooking ? publicBooking(savedBooking) : null,
  };
}

export function readBooking(
  state: OrchestratorState,
  actor: Actor,
  bookingRef: string,
): { ok: true; booking: Booking } | { ok: false; code: "NOT_FOUND" | "CROSS_TENANT" | "LOCATION_FORBIDDEN" | "FORBIDDEN" } {
  const bookingSnap = state.persistence.exportSnapshot();
  const booking = bookingForTenant(bookingSnap, actor.tenantId, bookingRef);
  if (!booking) return { ok: false, code: foreignBookingCode(bookingSnap, actor.tenantId, bookingRef) };
  const allowed = authorize(actor, booking, "read");
  if (!allowed.ok) return { ok: false, code: allowed.code };
  return { ok: true, booking: publicBooking(booking) };
}

export function acceptWebhook(
  state: OrchestratorState,
  actor: Actor,
  input: { tenantId: string; connectionId: string; eventId: string; eventType: string },
) {
  return state.persistence.webhooks.accept(actor, input);
}

export function markWebhookApplied(state: OrchestratorState, actor: Actor, tenantId: string, dedupeKey: string) {
  return state.persistence.webhooks.markApplied(actor, tenantId, dedupeKey);
}

export function recordTouchpoint(
  state: OrchestratorState,
  actor: Actor,
  input: Parameters<CommercePersistence["attribution"]["saveTouchpoint"]>[1],
) {
  return state.persistence.attribution.saveTouchpoint(actor, input);
}

/**
 * Test-only goods/catalog attestation for tenant-a.
 * The normal orchestrator constructor does not call this.
 * The HMAC is not Meta approval and does not approve YOLA FUN.
 */
export function seedOrchestratorPolicyFixture(persistence: CommercePersistence): void {
  const actor = { tenantId: "tenant-a", locationIds: null };
  const saved = persistence.policy.submit(
    actor,
    "tenant-a",
    { offeringCategory: "GENERAL_GOODS", experience: "WHATSAPP_CATALOG" },
    {
      kind: "AUTHORIZED_PROCESS",
      processId: FIXTURE_PROCESS,
      reference: FIXTURE_REFERENCE,
      outcome: "VERIFIED",
      attestation: signPolicyAttestation(ORCHESTRATOR_POLICY_KEY, {
        tenantId: "tenant-a",
        offeringCategory: "GENERAL_GOODS",
        experience: "WHATSAPP_CATALOG",
        processId: FIXTURE_PROCESS,
        reference: FIXTURE_REFERENCE,
        outcome: "VERIFIED",
      }),
    },
  );
  if (!saved.ok) throw new Error(`Compatibility policy fixture was rejected: ${saved.code}`);
}

function replayReserve(
  snap: ReturnType<CommercePersistence["exportSnapshot"]>,
  command: ReserveCommand,
  hash: string,
): ReserveResult | null {
  const idem = snap.idempotency.find(
    (row) => row.tenantId === command.tenantId && row.scope === "RESERVE" && row.idempotencyKey === command.idempotencyKey,
  );
  if (!idem) return null;
  if (idem.requestHash !== hash) return failure("IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different request.", false);
  const inflight = findInflight(snap, command.tenantId, command.idempotencyKey);
  const transaction = idem.transactionRef ? findTransaction(snap, command.tenantId, idem.transactionRef) : null;
  const booking = transaction ? findBookingForTransaction(snap, transaction) : null;
  if (idem.status === "COMPLETED" && transaction && booking) return successResult(transaction, booking, true, false);
  if (transaction?.state === "FAILED") return terminalReplay(transaction);
  if (idem.status === "COMPLETED" && idem.outcomeCode && !booking) {
    return { ...failure(asReserveCode(idem.outcomeCode), "The original request is already closed.", false), replay: true };
  }
  if (inflight && !inflight.absenceVerified && !inflight.adoptBookingRef) {
    if (inflight.requestHash !== hash) return failure("IDEMPOTENCY_CONFLICT", "This idempotency key is waiting on a different request.", false);
    return { ...unresolved("TIMEOUT", "The original reservation is still unresolved.", transaction ? publicTransaction(transaction) : null), replay: true };
  }
  if (idem.status === "IN_PROGRESS" && !inflight?.absenceVerified) {
    return { ...unresolved("TIMEOUT", "The reservation was claimed and has no authoritative outcome.", transaction ? publicTransaction(transaction) : null), replay: true };
  }
  return null;
}

/**
 * Keeps the claim envelope when the provider may already have a reservation.
 * Does not call finishDenied and does not call the provider.
 */
function holdUnresolved(
  ports: CommercePersistence,
  command: ReserveCommand,
  hash: string,
  transactionRef: string,
  code: ReserveResult["code"],
  message: string,
  deps: { now: string; crash?: OrchestratorCrash },
): ReserveResult {
  const persisted = ports.runAtomic((draft): PortResult<unknown> => {
    const timeout = draft.idempotency.recordTimeout(command.actor, {
      tenantId: command.tenantId,
      locationId: command.locationId,
      providerId: command.providerId,
      idempotencyKey: command.idempotencyKey,
      requestHash: hash,
      slotKey: slotKeyOf(command),
      transactionRef,
      merchantConfirmed: command.merchantConfirmed,
      experience: command.experience,
      category: command.category,
      offeringId: command.offeringId,
      startsAt: command.startsAt,
    });
    if (!timeout.ok) return timeout;
    if (timeout.value.absenceVerified) {
      const cleared = draft.idempotency.clearAbsence(command.actor, command.tenantId, command.idempotencyKey);
      if (!cleared.ok) return cleared;
    }
    const intent = saveIntent(draft, command);
    if (!intent.ok) return intent;
    const eventType = code === "TIMEOUT" ? "provider.timeout" : "provider.uncertain";
    return appendEvent(draft, command.actor, command.tenantId, transactionRef, eventType, deps.now, {
      providerId: command.providerId,
      code,
    });
  });
  if (!persisted.ok) return failure(asReserveCode(persisted.code), persisted.message, false);
  deps.crash?.afterTimeout?.();
  const transaction = findTransaction(ports.exportSnapshot(), command.tenantId, transactionRef);
  if (!transaction) return unresolved(code, message, null);
  return unresolved(code, message, publicTransaction(transaction));
}

function mayHaveCommitted(failure: { outcomeCertainty?: OutcomeCertainty }): boolean {
  return failure.outcomeCertainty !== "NO_COMMIT";
}

function deny(ports: CommercePersistence, command: ReserveCommand, hash: string, code: ReserveResult["code"], message: string): ReserveResult {
  const saved = ports.idempotency.finishDenied(command.actor, {
    tenantId: command.tenantId,
    locationId: command.locationId,
    idempotencyKey: command.idempotencyKey,
    requestHash: hash,
    outcomeCode: code,
  });
  if (!saved.ok) return failure(asReserveCode(saved.code), saved.message, false);
  return failure(code, message, false);
}

function adoptProviderBooking(
  ports: CommercePersistence,
  actor: Actor,
  pending: StoredInflight,
  mode: BookingProviderMode,
  data: { bookingRef: string; state: BookingState; slotKey: string; providerReference: string | null; referenceAuthoritative: boolean },
  now: string,
  crash?: OrchestratorCrash,
): ReserveResult {
  if (data.slotKey !== pending.slotKey) {
    const transaction = findTransaction(ports.exportSnapshot(), pending.tenantId, pending.transactionRef);
    return unresolved(
      "RECONCILIATION_REQUIRED",
      "The recovered booking does not match the original request. No second booking was authorized.",
      transaction ? publicTransaction(transaction) : null,
    );
  }
  const external = mode === "EXTERNAL_API" || mode === "EXTERNAL_CHECKOUT";
  if ((data.state === "CONFIRMED" || data.state === "HELD") && external && !data.providerReference) {
    const transaction = findTransaction(ports.exportSnapshot(), pending.tenantId, pending.transactionRef);
    const result = failure("MISSING_REFERENCE", "The external provider did not return a booking reference.", false);
    result.resolutionRequired = true;
    result.transaction = transaction ? publicTransaction(transaction) : null;
    return result;
  }
  const request = requestFromInflight(pending);
  crash?.beforeAdopt?.();
  const persisted = ports.runAtomic((draft): PortResult<{ transaction: StoredTransaction; booking: StoredBooking }> => {
    const noted = draft.idempotency.noteFound(actor, pending.tenantId, pending.idempotencyKey, {
      providerId: pending.providerId,
      locationId: pending.locationId,
      bookingRef: data.bookingRef,
    });
    if (!noted.ok) return noted;
    const opened = draft.bookings.openReservation(
      reservationDraft({
        command: {
          actor,
          tenantId: pending.tenantId,
          locationId: pending.locationId,
          providerId: pending.providerId,
          offeringId: request.offeringId,
          startsAt: request.startsAt,
          idempotencyKey: pending.idempotencyKey,
          experience: pending.experience,
          category: pending.category,
          merchantEligibility: "ELIGIBLE",
          approvalEvidence: null,
          merchantConfirmed: pending.merchantConfirmed,
        },
        requestHash: pending.requestHash,
        transactionRef: pending.transactionRef,
        mode,
        bookingRef: data.bookingRef,
        providerReference: data.providerReference,
        referenceAuthoritative: data.referenceAuthoritative,
        now,
      }),
    );
    if (!opened.ok) return opened;
    const intent = saveIntent(draft, {
      actor,
      tenantId: pending.tenantId,
      locationId: pending.locationId,
      idempotencyKey: pending.idempotencyKey,
      experience: pending.experience,
    });
    if (!intent.ok) return intent;
    const appended = appendEvent(draft, actor, pending.tenantId, pending.transactionRef, "booking.recovered", now, {
      state: opened.value.booking.state,
    });
    if (!appended.ok) return appended;
    return opened;
  });
  if (!persisted.ok) {
    const transaction = findTransaction(ports.exportSnapshot(), pending.tenantId, pending.transactionRef);
    const result = failure(asReserveCode(persisted.code), persisted.message, false);
    result.resolutionRequired = true;
    result.transaction = transaction ? publicTransaction(transaction) : null;
    return result;
  }
  return {
    ...successResult(persisted.value.transaction, persisted.value.booking, false, true),
    message: "Recovered the original provider reservation. No second booking was created.",
  };
}

function failTransaction(
  ports: CommercePersistence,
  actor: Actor,
  tenantId: string,
  transactionRef: string,
): PortResult<StoredTransaction> {
  return ports.runAtomic((draft) => {
    const current = findTransaction(draft.exportSnapshot(), tenantId, transactionRef);
    if (!current) return { ok: false, code: "NOT_FOUND", message: "Transaction not found." };
    if (current.state === "FAILED") return { ok: true, replay: true, value: current };
    return draft.transactions.compareAndSwap(actor, {
      tenantId,
      transactionRef,
      expectedVersion: current.version,
      state: "FAILED",
    });
  });
}

function reservationDraft(input: {
  command: ReserveCommand;
  requestHash: string;
  transactionRef: string;
  mode: BookingProviderMode;
  bookingRef: string;
  providerReference: string | null;
  referenceAuthoritative: boolean;
  now: string;
}): ReservationDraft {
  const command = input.command;
  return {
    actor: command.actor,
    tenantId: command.tenantId,
    locationId: command.locationId,
    providerId: command.providerId,
    offeringId: command.offeringId,
    startsAt: command.startsAt,
    idempotencyKey: command.idempotencyKey,
    requestHash: input.requestHash,
    experience: command.experience,
    category: command.category,
    merchantEligibility: command.merchantEligibility,
    intentRef: refFromMaterial("CIN", `${command.tenantId}:${command.idempotencyKey}`),
    bookingRef: input.bookingRef,
    transactionRef: input.transactionRef,
    providerMode: input.mode,
    providerReference: input.providerReference,
    referenceAuthoritative: input.referenceAuthoritative,
    holdExpiresAt: null,
    nativeExpiryPolicyId: null,
    availabilityFreshUntil: input.mode === "EXTERNAL_API" ? new Date(Date.parse(input.now) + 1000).toISOString() : null,
    nowIso: input.now,
  };
}

function ensureBookingConnection(
  ports: CommercePersistence,
  command: ReserveCommand,
  capabilities: { providerId: string; supportsHold: boolean; guaranteesIdempotency: boolean },
  mode: BookingProviderMode,
): PortResult<unknown> {
  const issues = mode === "NATIVE" || mode === "EXTERNAL_API";
  const connection: ConnectionCapabilities = {
    providerId: capabilities.providerId,
    supportsHold: capabilities.supportsHold,
    mock: true,
    guaranteesIdempotency: capabilities.guaranteesIdempotency,
    absenceConsistencyRequirement: MOCK_ABSENCE,
    holdExpiryOwner: capabilities.supportsHold ? "PROVIDER" : "NONE",
    issuesAuthoritativeReference: issues,
  };
  return ports.connections.register(command.actor, {
    tenantId: command.tenantId,
    locationId: command.locationId,
    providerId: command.providerId,
    kind: "BOOKING",
    mode,
    capabilities: connection,
  });
}

function paymentCapabilities(providerId: string): ConnectionCapabilities {
  return {
    providerId,
    supportsHold: false,
    mock: true,
    guaranteesIdempotency: false,
    absenceConsistencyRequirement: null,
    holdExpiryOwner: "NONE",
    issuesAuthoritativeReference: false,
  };
}

function saveIntent(
  ports: CommercePersistence,
  command: { actor: Actor; tenantId: string; locationId: string; idempotencyKey: string; experience: CustomerExperience },
) {
  return ports.intents.save(command.actor, {
    intentRef: refFromMaterial("CIN", `${command.tenantId}:${command.idempotencyKey}`),
    tenantId: command.tenantId,
    locationId: command.locationId,
    experience: command.experience,
    intentType: "BOOKING_REQUEST",
    qualified: false,
    customerRef: null,
    commerceOrderRef: null,
  });
}

function appendEvent(
  ports: CommercePersistence,
  actor: Actor,
  tenantId: string,
  transactionRef: string,
  type: string,
  at: string,
  payload: Record<string, string | number | boolean | null>,
) {
  const count = ports.exportSnapshot().events.filter((row) => row.tenantId === tenantId && row.transactionRef === transactionRef).length;
  return ports.events.append(actor, {
    eventId: refFromMaterial("CEV", `${transactionRef}:${type}:${count}`),
    tenantId,
    transactionRef,
    type,
    at,
    payload,
  });
}

function attested(snap: ReturnType<CommercePersistence["exportSnapshot"]>, command: ReserveCommand): boolean {
  const row = snap.policyEvidence.find(
    (item) => item.tenantId === command.tenantId && item.offeringCategory === command.category && item.experience === command.experience,
  );
  return Boolean(row?.validatedBy && row.status === "VERIFIED");
}

function requestHash(command: ReserveCommand): string {
  return stableHash({
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
}

function slotKeyOf(command: Pick<ReserveCommand, "tenantId" | "locationId" | "offeringId" | "startsAt">): string {
  return `${command.tenantId}:${command.locationId}:${command.offeringId}:${command.startsAt}`;
}

function requestFromInflight(pending: StoredInflight) {
  const prefix = `${pending.tenantId}:${pending.locationId}:`;
  const rest = pending.slotKey.startsWith(prefix) ? pending.slotKey.slice(prefix.length) : "";
  const split = rest.indexOf(":");
  return {
    tenantId: pending.tenantId,
    locationId: pending.locationId,
    idempotencyKey: pending.idempotencyKey,
    requestHash: pending.requestHash,
    offeringId: pending.offeringId || (split >= 0 ? rest.slice(0, split) : rest),
    startsAt: pending.startsAt || (split >= 0 ? rest.slice(split + 1) : ""),
    merchantConfirmed: pending.merchantConfirmed,
  };
}

function bookingForTenant(snap: ReturnType<CommercePersistence["exportSnapshot"]>, tenantId: string, bookingRef: string) {
  return snap.bookings.find((row) => row.tenantId === tenantId && row.bookingRef === bookingRef);
}

function transactionForTenant(snap: ReturnType<CommercePersistence["exportSnapshot"]>, tenantId: string, transactionRef: string) {
  return snap.transactions.find((row) => row.tenantId === tenantId && row.transactionRef === transactionRef);
}

function foreignBookingCode(
  snap: ReturnType<CommercePersistence["exportSnapshot"]>,
  tenantId: string,
  bookingRef: string,
): "NOT_FOUND" | "CROSS_TENANT" {
  return snap.bookings.some((row) => row.bookingRef === bookingRef && row.tenantId !== tenantId) ? "CROSS_TENANT" : "NOT_FOUND";
}

function foreignTransactionCode(
  snap: ReturnType<CommercePersistence["exportSnapshot"]>,
  tenantId: string,
  transactionRef: string,
): "NOT_FOUND" | "CROSS_TENANT" {
  return snap.transactions.some((row) => row.transactionRef === transactionRef && row.tenantId !== tenantId) ? "CROSS_TENANT" : "NOT_FOUND";
}

function findInflight(snap: ReturnType<CommercePersistence["exportSnapshot"]>, tenantId: string, idempotencyKey: string) {
  return snap.inflight.find((row) => row.tenantId === tenantId && row.idempotencyKey === idempotencyKey);
}

function findTransaction(snap: ReturnType<CommercePersistence["exportSnapshot"]>, tenantId: string, transactionRef: string) {
  return snap.transactions.find((row) => row.tenantId === tenantId && row.transactionRef === transactionRef);
}

function findBookingForTransaction(snap: ReturnType<CommercePersistence["exportSnapshot"]>, transaction: StoredTransaction) {
  return snap.bookings.find((row) => row.tenantId === transaction.tenantId && row.transactionRef === transaction.transactionRef);
}

function publicTransaction(row: StoredTransaction): CommerceTransaction {
  return {
    transactionRef: row.transactionRef,
    tenantId: row.tenantId,
    locationId: row.locationId,
    intentRef: row.intentRef,
    providerId: row.providerId,
    state: row.state,
    bookingRef: row.bookingRef,
    orderRef: row.orderRef,
    paymentStatus: row.paymentStatus,
    verifiedPaid: row.verifiedPaid,
  };
}

function publicBooking(row: StoredBooking): Booking {
  return {
    bookingRef: row.bookingRef,
    tenantId: row.tenantId,
    locationId: row.locationId,
    transactionRef: row.transactionRef,
    providerId: row.providerId,
    providerMode: row.providerMode,
    slotKey: row.slotKey,
    state: row.state,
    providerReference: row.providerReference,
    referenceAuthoritative: row.referenceAuthoritative,
    idempotencyKey: row.idempotencyKey,
  };
}

function successResult(transaction: StoredTransaction, booking: StoredBooking, replay: boolean, recovered: boolean): ReserveResult {
  return {
    ok: true,
    replay,
    code: "OK",
    retryable: false,
    resolutionRequired: false,
    message: recovered
      ? "Recovered the original provider reservation. No second booking was created."
      : booking.state === "CONFIRMED"
        ? "Booking confirmed. Payment has not started."
        : "Reservation recorded. Payment has not started.",
    transaction: publicTransaction(transaction),
    booking: publicBooking(booking),
    handoffUrl: null,
    handoffReference: null,
  };
}

function terminalReplay(transaction: StoredTransaction): ReserveResult {
  return {
    ...failure("TERMINAL", "The provider reported a terminal reservation. The idempotency key stays closed.", false),
    replay: true,
    transaction: publicTransaction(transaction),
  };
}

function unresolved(code: ReserveResult["code"], message: string, transaction: CommerceTransaction | null): ReserveResult {
  return {
    ok: false,
    replay: false,
    code,
    retryable: false,
    resolutionRequired: true,
    message,
    transaction,
    booking: null,
    handoffUrl: null,
    handoffReference: null,
  };
}

function paymentFailure(code: PortCode): { ok: false; code: "NOT_FOUND" | "CROSS_TENANT" | "LOCATION_FORBIDDEN" | "FORBIDDEN" | "MISMATCH" | "ATTEMPT_CONFLICT" } {
  if (code === "NOT_FOUND" || code === "CROSS_TENANT" || code === "LOCATION_FORBIDDEN" || code === "FORBIDDEN" || code === "MISMATCH" || code === "ATTEMPT_CONFLICT") {
    return { ok: false, code };
  }
  return { ok: false, code: "MISMATCH" };
}

function terminalBooking(state: BookingState): boolean {
  return state === "CANCELLED" || state === "REJECTED" || state === "EXPIRED" || state === "NO_SHOW";
}

function asReserveCode(code: string): ReserveResult["code"] {
  if (code === "SLOT_CONFLICT") return "CONFLICT";
  if (code === "REFERENCE_CONFLICT" || code === "INVALID" || code === "VERSION_CONFLICT" || code === "DUPLICATE") return "RECONCILIATION_REQUIRED";
  const known: ReserveResult["code"][] = [
    "OK",
    "UNSUPPORTED",
    "UNAVAILABLE",
    "TIMEOUT",
    "RETRYABLE",
    "CONFLICT",
    "MISSING_REFERENCE",
    "NOT_AUTHORITATIVE",
    "IDEMPOTENCY_CONFLICT",
    "POLICY_BLOCKED",
    "POLICY_DENIED",
    "CROSS_TENANT",
    "LOCATION_FORBIDDEN",
    "FORBIDDEN",
    "NOT_FOUND",
    "RECONCILIATION_REQUIRED",
    "SCOPE_MISMATCH",
    "TERMINAL",
  ];
  return known.includes(code as ReserveResult["code"]) ? (code as ReserveResult["code"]) : "RECONCILIATION_REQUIRED";
}

function authMessage(code: "CROSS_TENANT" | "LOCATION_FORBIDDEN" | "FORBIDDEN"): string {
  if (code === "CROSS_TENANT") return "Tenant mismatch.";
  if (code === "FORBIDDEN") return "This action is not allowed.";
  return "Location is outside this actor.";
}

function failure(code: ReserveResult["code"], message: string, retryable: boolean): ReserveResult {
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

function bookingView(persistence: CommercePersistence): Map<string, Booking> {
  const map = new Map<string, Booking>();
  for (const row of persistence.exportSnapshot().bookings) map.set(row.bookingRef, publicBooking(row));
  return map;
}

function transactionView(persistence: CommercePersistence): Map<string, CommerceTransaction> {
  const map = new Map<string, CommerceTransaction>();
  for (const row of persistence.exportSnapshot().transactions) map.set(row.transactionRef, publicTransaction(row));
  return map;
}

function ledgerView(persistence: CommercePersistence): Map<string, PaymentLedger> {
  const map = new Map<string, PaymentLedger>();
  for (const row of persistence.exportSnapshot().ledgers) map.set(`${row.tenantId}:${row.attemptRef}`, row.ledger);
  return map;
}

function attemptView(persistence: CommercePersistence): Map<string, StoredPaymentAttempt> {
  const map = new Map<string, StoredPaymentAttempt>();
  for (const row of persistence.exportSnapshot().attempts) {
    map.set(`${row.tenantId}:${row.attemptRef}`, {
      tenantId: row.tenantId,
      transactionRef: row.transactionRef,
      attemptRef: row.attemptRef,
      providerId: row.providerId,
      expectedAmountIdr: row.expectedAmountIdr,
      currency: "IDR",
    });
  }
  return map;
}
