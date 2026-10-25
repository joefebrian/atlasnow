/**
 * Deterministic in-memory commerce persistence.
 * Snapshot rehydration is JSON. This file does not open a database connection.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Actor, CommerceAction } from "./auth";
import { authorize } from "./auth";
import { bookingOccupiesCapacity, transitionBooking } from "./booking-state";
import { buildTouchpoint } from "./attribution";
import { classifyOutcome } from "./attribution";
import { phoneCorrelation, refFromMaterial, stableHash } from "./ids";
import {
  aggregateAttemptLedgers,
  applyPaymentNotice,
  emptyLedger,
  type PaymentEffect,
  type PaymentLedger,
  type VerifiedPaymentEvent,
} from "./payment";
import { approvalIsVerified, evaluateEligibility } from "./policy";
import type {
  CommercePersistence,
  ConcurrentConflict,
  ConnectionKind,
  EvidenceSubmission,
  PersistenceSnapshot,
  PortCode,
  PortFailure,
  PortResult,
  ReservationDraft,
  StoredAttempt,
  StoredBooking,
  StoredConnection,
  StoredCredential,
  StoredExternalRef,
  StoredAggregate,
  StoredEvent,
  StoredInflight,
  StoredIntent,
  StoredPolicyEvidence,
  StoredTouchpoint,
  StoredTransaction,
  StoredWebhook,
} from "./ports";
import { transitionTransaction } from "./transaction-state";
import type { BookingState, CommerceIntent, PaymentState, TransactionState } from "./types";

export type MemoryStoreOptions = {
  snapshot?: PersistenceSnapshot;
  /** Fixture or future validator key. Absent means VERIFIED evidence cannot be written. */
  policyValidatorKey?: string;
};

export function signPolicyAttestation(
  key: string,
  fields: {
    tenantId: string;
    offeringCategory: string;
    experience: string;
    processId: string;
    reference: string;
    outcome: "VERIFIED" | "UNVERIFIED";
  },
): string {
  return createHmac("sha256", key)
    .update(
      [fields.tenantId, fields.offeringCategory, fields.experience, fields.processId, fields.reference, fields.outcome].join("|"),
    )
    .digest("hex");
}

export function createMemoryCommerceStore(options: MemoryStoreOptions = {}): CommercePersistence {
  let state = options.snapshot ? cloneSnapshot(options.snapshot) : emptySnapshot();
  const policyValidatorKey = options.policyValidatorKey ?? "";
  const ports = {} as CommercePersistence;

  ports.intents = {
    save(actor, intent) {
      const denied = requireActor(actor, intent.tenantId, intent.locationId, "write");
      if (denied) return denied;
      if (!intent.intentRef.trim() || phoneCorrelation(intent.intentRef) || phoneCorrelation(intent.customerRef ?? "")) {
        return fail("INVALID", "An intent key cannot be blank or a phone number.");
      }
      const existing = state.intents.find((row) => row.tenantId === intent.tenantId && row.intentRef === intent.intentRef);
      if (existing) {
        if (stableHash(publicIntent(existing)) === stableHash(intent)) return ok(existing, true);
        return fail("IDEMPOTENCY_CONFLICT", "This intent id is already stored with different fields.");
      }
      const row: StoredIntent = { ...intent, commerceOrderRef: intent.commerceOrderRef, version: 1 };
      state.intents.push(row);
      return ok(row, false);
    },
    read(actor, tenantId, intentRef) {
      const denied = requireActor(actor, tenantId, null, "read");
      if (denied && denied.code === "CROSS_TENANT") return denied;
      if (denied && denied.code === "FORBIDDEN") return denied;
      const row = state.intents.find((item) => item.tenantId === tenantId && item.intentRef === intentRef);
      if (!row) return fail("NOT_FOUND", "Intent not found.");
      const scoped = requireActor(actor, tenantId, row.locationId, "read");
      if (scoped) return scoped;
      return ok(row, false);
    },
  };

  ports.transactions = {
    read(actor, tenantId, transactionRef) {
      const row = findTransaction(state, tenantId, transactionRef);
      if (!row) return tenantMiss(actor, tenantId, "read", "Transaction not found.");
      const denied = requireActor(actor, tenantId, row.locationId, "read");
      if (denied) return denied;
      return ok(row, false);
    },
    compareAndSwap(actor, input) {
      const row = findTransaction(state, input.tenantId, input.transactionRef);
      if (!row) return tenantMiss(actor, input.tenantId, "write", "Transaction not found.");
      const denied = requireActor(actor, input.tenantId, row.locationId, "write");
      if (denied) return denied;
      if (row.version !== input.expectedVersion) return fail("VERSION_CONFLICT", "The transaction version changed.");
      if (input.state && input.state !== row.state) {
        const moved = transitionTransaction(row.state, input.state);
        if (!moved.ok) return fail(moved.code === "TERMINAL" ? "TERMINAL" : "INVALID", "That transaction transition is not allowed.");
        row.state = input.state;
      }
      row.version += 1;
      return ok(row, false);
    },
  };

  ports.bookings = {
    read(actor, tenantId, bookingRef) {
      const row = state.bookings.find((item) => item.tenantId === tenantId && item.bookingRef === bookingRef);
      if (!row) return tenantMiss(actor, tenantId, "read", "Booking not found.");
      const denied = requireActor(actor, tenantId, row.locationId, "read");
      if (denied) return denied;
      return ok(row, false);
    },
    list(actor, tenantId, locationId) {
      const denied = requireActor(actor, tenantId, locationId, "read");
      if (denied) return denied;
      const rows = state.bookings.filter((item) => {
        if (item.tenantId !== tenantId) return false;
        if (locationId != null) return item.locationId === locationId;
        if (actor.locationIds == null) return true;
        return actor.locationIds.includes(item.locationId);
      });
      return ok(rows, false);
    },
    openReservation(draft) {
      return openReservation(state, draft);
    },
    transition(actor, input) {
      const row = state.bookings.find((item) => item.tenantId === input.tenantId && item.bookingRef === input.bookingRef);
      if (!row) return tenantMiss(actor, input.tenantId, "write", "Booking not found.");
      const denied = requireActor(actor, input.tenantId, row.locationId, "write");
      if (denied) return denied;
      if (row.version !== input.expectedVersion) return fail("VERSION_CONFLICT", "The booking version changed.");
      const connection = findConnection(state, row.tenantId, row.locationId, row.providerId, "BOOKING");
      const moved = transitionBooking(row.state, input.to, { supportsHold: connection?.capabilities.supportsHold ?? false });
      if (!moved.ok) return fail(moved.code === "TERMINAL" ? "TERMINAL" : "INVALID", "That booking transition is not allowed.");
      row.state = input.to;
      row.version += 1;
      touchTransaction(state, row.tenantId, row.transactionRef, input.to === "CANCELLED" ? "CLOSED" : undefined);
      return ok(row, false);
    },
    requestReschedule(actor, input) {
      const row = state.bookings.find((item) => item.tenantId === input.tenantId && item.bookingRef === input.bookingRef);
      if (!row) return tenantMiss(actor, input.tenantId, "write", "Booking not found.");
      const denied = requireActor(actor, input.tenantId, row.locationId, "write");
      if (denied) return denied;
      if (row.version !== input.expectedVersion) return fail("VERSION_CONFLICT", "The booking version changed.");
      if (!bookingOccupiesCapacity(row.state) && row.state !== "REQUESTED") return fail("TERMINAL", "A finished booking cannot move.");
      if (!input.nextSlotKey.trim() || input.nextSlotKey === row.slotKey) return fail("INVALID", "A reschedule needs a different slot.");
      row.pendingSlotKey = input.nextSlotKey;
      row.version += 1;
      return ok(row, false);
    },
    commitReschedule(actor, input) {
      const row = state.bookings.find((item) => item.tenantId === input.tenantId && item.bookingRef === input.bookingRef);
      if (!row) return tenantMiss(actor, input.tenantId, "write", "Booking not found.");
      const denied = requireActor(actor, input.tenantId, row.locationId, "write");
      if (denied) return denied;
      if (row.version !== input.expectedVersion) return fail("VERSION_CONFLICT", "The booking version changed.");
      if (!row.pendingSlotKey) return fail("INVALID", "There is no pending reschedule.");
      const next = row.pendingSlotKey;
      if (slotTaken(state, { ...row, slotKey: next }, row.bookingRef)) return fail("SLOT_CONFLICT", "That slot is already reserved.");
      row.slotKey = next;
      row.pendingSlotKey = null;
      row.version += 1;
      return ok(row, false);
    },
    expireDue(actor, tenantId, locationId, nowIso) {
      const denied = requireActor(actor, tenantId, locationId, "write");
      if (denied) return denied;
      const now = Date.parse(nowIso);
      if (!Number.isFinite(now)) return fail("INVALID", "Expiry needs a timestamp.");
      let expired = 0;
      let leftUnset = 0;
      for (const row of state.bookings) {
        if (row.tenantId !== tenantId || row.locationId !== locationId) continue;
        if (row.state !== "HELD" && row.state !== "REQUESTED") continue;
        if (row.holdExpiryOwner === "NONE" || row.holdExpiresAt == null) {
          leftUnset += 1;
          continue;
        }
        if (row.holdExpiryOwner === "NATIVE_POLICY" && !row.nativeExpiryPolicyId) {
          leftUnset += 1;
          continue;
        }
        if (Date.parse(row.holdExpiresAt) > now) continue;
        const moved = transitionBooking(row.state, "EXPIRED", { supportsHold: true });
        if (!moved.ok) continue;
        row.state = "EXPIRED";
        row.version += 1;
        expired += 1;
      }
      return ok({ expired, leftUnset }, false);
    },
    findByExternalRef(actor, tenantId, providerId, externalId) {
      const denied = requireActor(actor, tenantId, null, "read");
      if (denied && denied.code !== "LOCATION_FORBIDDEN") return denied;
      const row = state.bookings.find(
        (item) => item.tenantId === tenantId && item.providerId === providerId && item.providerReference === externalId,
      );
      if (!row) return fail("NOT_FOUND", "Booking reference not found.");
      const scoped = requireActor(actor, tenantId, row.locationId, "read");
      if (scoped) return scoped;
      return ok(row, false);
    },
  };

  ports.connections = {
    register(actor, input) {
      const denied = requireActor(actor, input.tenantId, input.locationId, "write");
      if (denied) return denied;
      if (input.capabilities.providerId !== input.providerId) return fail("INVALID", "The capability id must match the provider.");
      const inconsistent = connectionModeConflict(input.kind, input.mode, input.capabilities);
      if (inconsistent) return inconsistent;
      const existing = state.connections.find(
        (row) =>
          row.tenantId === input.tenantId &&
          row.locationId === input.locationId &&
          row.providerId === input.providerId &&
          row.kind === input.kind,
      );
      if (existing) {
        if (existing.mode !== input.mode) return fail("SCOPE_MISMATCH", "This connection is already registered with another mode.");
        return ok(existing, true);
      }
      const row: StoredConnection = {
        connectionId: refFromMaterial("CON", `${input.tenantId}:${input.locationId ?? ""}:${input.providerId}:${input.kind}`),
        tenantId: input.tenantId,
        locationId: input.locationId,
        providerId: input.providerId,
        kind: input.kind,
        mode: input.mode,
        capabilities: structuredClone(input.capabilities),
        status: "ACTIVE",
        health: "UNKNOWN",
        lastCheckedAt: null,
        credentialRef: null,
        webhookSecretRef: null,
        version: 1,
      };
      state.connections.push(row);
      return ok(row, false);
    },
    resolve(actor, tenantId, locationId, providerId, kind) {
      const row = findConnection(state, tenantId, locationId, providerId, kind);
      if (!row) return tenantMiss(actor, tenantId, "read", "Connection not found.");
      const denied = requireActor(actor, tenantId, row.locationId, "read");
      if (denied) return denied;
      return ok(row, false);
    },
    registerCredential(actor, input) {
      const secret = rejectSecret(input);
      if (secret) return secret;
      const connection = state.connections.find((row) => row.connectionId === input.connectionId && row.tenantId === input.tenantId);
      if (!connection) return tenantMiss(actor, input.tenantId, "write", "Connection not found.");
      const denied = requireActor(actor, input.tenantId, connection.locationId, "write");
      if (denied) return denied;
      const active = state.credentials.find(
        (row) => row.connectionId === connection.connectionId && row.purpose === input.purpose && row.status === "ACTIVE",
      );
      if (active) return fail("DUPLICATE", "Rotate the active credential instead of registering a second one.");
      const row: StoredCredential = {
        credentialRef: input.credentialRef,
        tenantId: input.tenantId,
        connectionId: connection.connectionId,
        purpose: input.purpose,
        keyVersion: 1,
        status: "ACTIVE",
        rotatedFromRef: null,
        revokedAt: null,
      };
      state.credentials.push(row);
      if (input.purpose === "API") connection.credentialRef = row.credentialRef;
      else connection.webhookSecretRef = row.credentialRef;
      connection.version += 1;
      return ok(row, false);
    },
    rotateCredential(actor, input) {
      const secret = rejectSecret(input);
      if (secret) return secret;
      const connection = state.connections.find((row) => row.connectionId === input.connectionId && row.tenantId === input.tenantId);
      if (!connection) return tenantMiss(actor, input.tenantId, "write", "Connection not found.");
      const denied = requireActor(actor, input.tenantId, connection.locationId, "write");
      if (denied) return denied;
      const current = state.credentials.find(
        (row) => row.connectionId === connection.connectionId && row.purpose === input.purpose && row.status === "ACTIVE",
      );
      if (!current) return fail("NOT_FOUND", "There is no active credential to rotate.");
      current.status = "ROTATING";
      const row: StoredCredential = {
        credentialRef: input.credentialRef,
        tenantId: input.tenantId,
        connectionId: connection.connectionId,
        purpose: input.purpose,
        keyVersion: current.keyVersion + 1,
        status: "ACTIVE",
        rotatedFromRef: current.credentialRef,
        revokedAt: null,
      };
      state.credentials.push(row);
      if (input.purpose === "API") connection.credentialRef = row.credentialRef;
      else connection.webhookSecretRef = row.credentialRef;
      connection.version += 1;
      return ok(row, false);
    },
    revokeCredential(actor, tenantId, credentialRef, revokedAt) {
      const row = state.credentials.find((item) => item.tenantId === tenantId && item.credentialRef === credentialRef);
      if (!row) return tenantMiss(actor, tenantId, "write", "Credential not found.");
      const connection = state.connections.find((item) => item.connectionId === row.connectionId);
      const denied = requireActor(actor, tenantId, connection?.locationId ?? null, "write");
      if (denied) return denied;
      if (row.status === "REVOKED") return ok(row, true);
      row.status = "REVOKED";
      row.revokedAt = revokedAt;
      return ok(row, false);
    },
    reportHealth(actor, input) {
      const row = state.connections.find((item) => item.tenantId === input.tenantId && item.connectionId === input.connectionId);
      if (!row) return tenantMiss(actor, input.tenantId, "write", "Connection not found.");
      const denied = requireActor(actor, input.tenantId, row.locationId, "write");
      if (denied) return denied;
      if (row.version !== input.expectedVersion) return fail("VERSION_CONFLICT", "The connection version changed.");
      row.health = input.health;
      row.lastCheckedAt = input.at;
      row.version += 1;
      return ok(row, false);
    },
  };

  ports.payments = {
    openAttempt(actor, input) {
      const transaction = findTransaction(state, input.tenantId, input.transactionRef);
      if (!transaction) return tenantMiss(actor, input.tenantId, "write", "Transaction not found.");
      const denied = requireActor(actor, input.tenantId, transaction.locationId, "write");
      if (denied) return denied;
      if (input.locationId !== transaction.locationId) return fail("SCOPE_MISMATCH", "The attempt location must match the transaction.");
      if (!input.attemptRef.trim() || !input.providerId.trim()) return fail("MISMATCH", "Attempt and provider are required.");
      if (!Number.isSafeInteger(input.expectedAmountIdr) || input.expectedAmountIdr < 1) return fail("INVALID", "Amount must be a whole rupiah.");
      const existing = state.attempts.find((row) => row.tenantId === input.tenantId && row.attemptRef === input.attemptRef);
      if (existing) {
        const same =
          existing.transactionRef === input.transactionRef &&
          existing.providerId === input.providerId &&
          existing.expectedAmountIdr === input.expectedAmountIdr &&
          existing.providerMode === input.providerMode;
        if (!same) return fail("ATTEMPT_CONFLICT", "This attempt id is already bound to a different payment.");
        return ok(existing, true);
      }
      const connection = findConnection(state, input.tenantId, input.locationId, input.providerId, "PAYMENT");
      if (!connection) return fail("NOT_FOUND", "Payment connection not found.");
      if (connection.mode !== input.providerMode) return fail("SCOPE_MISMATCH", "The attempt mode must match the payment connection.");
      const blocked = connectionBlock(connection, state);
      if (blocked) return fail(blocked, "The payment connection cannot take a new attempt.");
      const row: StoredAttempt = {
        attemptRef: input.attemptRef,
        tenantId: input.tenantId,
        locationId: input.locationId,
        transactionRef: input.transactionRef,
        providerId: input.providerId,
        providerMode: input.providerMode,
        expectedAmountIdr: input.expectedAmountIdr,
        currency: "IDR",
        version: 1,
      };
      state.attempts.push(row);
      state.ledgers.push({
        tenantId: input.tenantId,
        attemptRef: input.attemptRef,
        providerId: input.providerId,
        transactionRef: input.transactionRef,
        version: 1,
        ledger: emptyLedger(),
      });
      return ok(row, false);
    },
    applyEvent(actor, event) {
      return applyAttemptEvent(state, actor, event);
    },
    reconcileTerminal(actor, input) {
      return reconcileTerminal(state, actor, input);
    },
    net(actor, tenantId, transactionRef) {
      const transaction = findTransaction(state, tenantId, transactionRef);
      if (!transaction) return tenantMiss(actor, tenantId, "read", "Transaction not found.");
      const denied = requireActor(actor, tenantId, transaction.locationId, "read");
      if (denied) return denied;
      return ok(netFor(state, tenantId, transactionRef), false);
    },
  };

  ports.idempotency = {
    read(actor, tenantId, scope, idempotencyKey) {
      const denied = requireActor(actor, tenantId, null, "read");
      if (denied && denied.code !== "LOCATION_FORBIDDEN") return denied;
      const row = state.idempotency.find((item) => item.tenantId === tenantId && item.scope === scope && item.idempotencyKey === idempotencyKey);
      if (!row) return fail("NOT_FOUND", "Idempotency key not found.");
      if (actor.locationIds != null) {
        const inflight = findInflight(state, tenantId, idempotencyKey);
        if (inflight) {
          const scoped = requireActor(actor, tenantId, inflight.locationId, "read");
          if (scoped) return scoped;
        }
      }
      return ok(row, false);
    },
    recordTimeout(actor, input) {
      const denied = requireActor(actor, input.tenantId, input.locationId, "write");
      if (denied) return denied;
      const existing = findInflight(state, input.tenantId, input.idempotencyKey);
      if (existing) {
        if (existing.providerId !== input.providerId || existing.locationId !== input.locationId) {
          return fail("SCOPE_MISMATCH", "Timeout recovery stays on the original provider and location.");
        }
        if (existing.requestHash !== input.requestHash) return fail("IDEMPOTENCY_CONFLICT", "The timeout request hash does not match.");
        return ok(existing, true);
      }
      const idem = state.idempotency.find((item) => item.tenantId === input.tenantId && item.scope === "RESERVE" && item.idempotencyKey === input.idempotencyKey);
      if (idem && idem.requestHash !== input.requestHash) return fail("IDEMPOTENCY_CONFLICT", "The timeout request hash does not match.");
      if (!findTransaction(state, input.tenantId, input.transactionRef)) {
        state.transactions.push({
          transactionRef: input.transactionRef,
          tenantId: input.tenantId,
          locationId: input.locationId,
          intentRef: null,
          providerId: input.providerId,
          state: "PENDING_RESOLUTION",
          bookingRef: null,
          orderRef: null,
          paymentStatus: "NOT_STARTED",
          verifiedPaid: false,
          version: 1,
        });
      } else {
        const transaction = findTransaction(state, input.tenantId, input.transactionRef);
        if (transaction && transaction.state !== "COMMITTED" && transaction.state !== "CLOSED" && transaction.state !== "FAILED") {
          transaction.state = "PENDING_RESOLUTION";
          transaction.version += 1;
        }
      }
      if (!idem) {
        state.idempotency.push({
          tenantId: input.tenantId,
          scope: "RESERVE",
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          status: "PENDING_RESOLUTION",
          transactionRef: input.transactionRef,
          version: 1,
        });
      } else {
        idem.status = "PENDING_RESOLUTION";
        idem.version += 1;
      }
      const row: StoredInflight = { ...input, absenceVerified: false, version: 1 };
      state.inflight.push(row);
      return ok(row, false);
    },
    noteAbsence(actor, tenantId, idempotencyKey, claim) {
      const row = findInflight(state, tenantId, idempotencyKey);
      if (!row) return tenantMiss(actor, tenantId, "write", "Inflight reservation not found.");
      const denied = requireActor(actor, tenantId, row.locationId, "write");
      if (denied) return denied;
      if (claim.providerId !== row.providerId || claim.locationId !== row.locationId) {
        return fail("SCOPE_MISMATCH", "Another provider cannot prove this reservation is absent.");
      }
      const connection = findConnection(state, tenantId, row.locationId, row.providerId, "BOOKING");
      const requirement = connection?.capabilities.absenceConsistencyRequirement ?? null;
      if (!claim.observedEmpty || !claim.satisfied || !requirement || claim.requirementId !== requirement) {
        return fail("RECONCILIATION_REQUIRED", "Provider absence is not authoritative for a new create.");
      }
      row.absenceVerified = true;
      row.version += 1;
      return ok(row, false);
    },
  };

  ports.webhooks = {
    accept(actor, input) {
      if (!input.connectionId.trim() || !input.eventId.trim()) return fail("INVALID", "Webhook connection and event id are required.");
      const connection = state.connections.find((row) => row.connectionId === input.connectionId);
      if (!connection) return tenantMiss(actor, input.tenantId, "write", "Webhook connection not found.");
      if (connection.tenantId !== input.tenantId) return fail("CROSS_TENANT", "This connection belongs to another tenant.");
      const denied = requireActor(actor, input.tenantId, connection.locationId, "write");
      if (denied) return denied;
      const dedupeKey = `${connection.connectionId}:${input.eventId}`;
      const existing = state.webhooks.find((row) => row.dedupeKey === dedupeKey);
      if (existing) return ok(existing, true);
      const row: StoredWebhook = {
        dedupeKey,
        connectionId: connection.connectionId,
        providerId: connection.providerId,
        eventId: input.eventId,
        tenantId: connection.tenantId,
        eventType: input.eventType,
        status: "RECEIVED",
        version: 1,
      };
      state.webhooks.push(row);
      return ok(row, false);
    },
    markApplied(actor, tenantId, dedupeKey) {
      const row = state.webhooks.find((item) => item.dedupeKey === dedupeKey && item.tenantId === tenantId);
      if (!row) return tenantMiss(actor, tenantId, "write", "Webhook event not found.");
      const denied = requireActor(actor, tenantId, null, "write");
      if (denied && denied.code !== "LOCATION_FORBIDDEN") return denied;
      if (row.status === "APPLIED") return ok(row, true);
      row.status = "APPLIED";
      row.version += 1;
      return ok(row, false);
    },
  };

  ports.events = {
    append(actor, event) {
      const transaction = findTransaction(state, event.tenantId, event.transactionRef);
      if (!transaction) return tenantMiss(actor, event.tenantId, "write", "Transaction not found.");
      const denied = requireActor(actor, event.tenantId, transaction.locationId, "write");
      if (denied) return denied;
      const existing = state.events.find((row) => row.tenantId === event.tenantId && row.eventId === event.eventId);
      if (existing) return ok(existing, true);
      const row: StoredEvent = { ...event, payload: { ...event.payload }, version: 1 };
      state.events.push(row);
      return ok(row, false);
    },
    list(actor, tenantId, transactionRef) {
      const transaction = findTransaction(state, tenantId, transactionRef);
      if (!transaction) return tenantMiss(actor, tenantId, "read", "Transaction not found.");
      const denied = requireActor(actor, tenantId, transaction.locationId, "read");
      if (denied) return denied;
      return ok(
        state.events.filter((row) => row.tenantId === tenantId && row.transactionRef === transactionRef),
        false,
      );
    },
  };

  ports.attribution = {
    saveTouchpoint(actor, input) {
      const denied = requireActor(actor, input.tenantId, input.locationId, "write");
      if (denied) return denied;
      if ((input.gscClicks ?? 0) > 0 || (input.gbpViews ?? 0) > 0) {
        return fail("INVALID", "Aggregated Search or Maps metrics cannot be stored as a transaction touchpoint.");
      }
      if (input.transactionRef) {
        const transaction = findTransaction(state, input.tenantId, input.transactionRef);
        if (!transaction) return fail("NOT_FOUND", "Transaction not found.");
      }
      const built = buildTouchpoint(input);
      if (built.channel === "GOOGLE_SEARCH" || built.channel === "GOOGLE_MAPS") {
        return fail("INVALID", "Search Console and Business Profile totals stay on the aggregate port.");
      }
      const touchpointId = refFromMaterial("ATP", stableHash({ ...built, intentRef: input.intentRef, bookingRef: input.bookingRef, attemptRef: input.attemptRef }));
      const existing = state.touchpoints.find((row) => row.touchpointId === touchpointId);
      if (existing) return ok(existing, true);
      const row: StoredTouchpoint = {
        ...built,
        touchpointId,
        intentRef: input.intentRef,
        bookingRef: input.bookingRef,
        attemptRef: input.attemptRef,
        erasedAt: null,
        erasureReason: null,
        version: 1,
      };
      state.touchpoints.push(row);
      return ok(row, false);
    },
    saveAggregate(actor, input) {
      const denied = requireActor(actor, input.tenantId, input.locationId, "write");
      if (denied) return denied;
      if (!Number.isSafeInteger(input.count) || input.count < 0) return fail("INVALID", "Aggregate count must be a whole number.");
      const aggregateId = refFromMaterial("AGG", `${input.tenantId}:${input.locationId ?? ""}:${input.channel}`);
      const existing = state.aggregates.find((row) => row.aggregateId === aggregateId);
      if (existing) {
        existing.count = input.count;
        existing.version += 1;
        return ok(existing, true);
      }
      const row: StoredAggregate = { aggregateId, ...input, version: 1 };
      state.aggregates.push(row);
      return ok(row, false);
    },
    eraseIdentifiers(actor, tenantId, touchpointId, reason, erasedAt) {
      const row = state.touchpoints.find((item) => item.tenantId === tenantId && item.touchpointId === touchpointId);
      if (!row) return tenantMiss(actor, tenantId, "write", "Touchpoint not found.");
      const denied = requireActor(actor, tenantId, row.locationId, "write");
      if (denied) return denied;
      if (!reason.trim()) return fail("INVALID", "Erasure needs a reason.");
      row.ctwaClid = null;
      row.gclid = null;
      row.gbraid = null;
      row.wbraid = null;
      row.utmSource = null;
      row.utmMedium = null;
      row.utmCampaign = null;
      row.qrCampaignId = null;
      row.erasedAt = erasedAt;
      row.erasureReason = reason;
      row.version += 1;
      return ok(row, false);
    },
    readClass(actor, tenantId, transactionRef) {
      const transaction = findTransaction(state, tenantId, transactionRef);
      if (!transaction) return tenantMiss(actor, tenantId, "read", "Transaction not found.");
      const denied = requireActor(actor, tenantId, transaction.locationId, "read");
      if (denied) return denied;
      const booking = transaction.bookingRef
        ? state.bookings.find((row) => row.tenantId === tenantId && row.bookingRef === transaction.bookingRef) ?? null
        : null;
      const outcome = classifyOutcome({
        paymentStatus: transaction.paymentStatus,
        paymentVerified: transaction.verifiedPaid,
        bookingState: booking?.state ?? null,
        authoritativeBookingRef: booking?.referenceAuthoritative ? booking.providerReference : null,
        qualifiedLead: false,
        engaged: false,
      });
      const touch = state.touchpoints.find((row) => row.tenantId === tenantId && row.transactionRef === transactionRef && row.userLevel);
      return ok({ level: outcome.level, countsAsRevenue: outcome.countsAsRevenue, channel: touch?.channel ?? null, confidence: touch?.confidence ?? null }, false);
    },
  };

  ports.policy = {
    submit(actor, tenantId, scope, submission) {
      const denied = requireActor(actor, tenantId, null, "write");
      if (denied) return denied;
      const current = findEvidence(state, tenantId, scope.offeringCategory, scope.experience);
      if (submission.kind === "CALLER_ENUM") {
        if (current?.status === "VERIFIED" && current.validatedBy) return ok(current, true);
        const row: StoredPolicyEvidence = {
          tenantId,
          offeringCategory: scope.offeringCategory,
          experience: scope.experience,
          source: "META_COMMERCE_POLICY",
          status: "UNVERIFIED",
          reference: submission.reference.trim(),
          validatedBy: null,
          version: (current?.version ?? 0) + 1,
        };
        replaceEvidence(state, row);
        return ok(row, false);
      }
      if (!policyValidatorKey || !attestationMatches(policyValidatorKey, tenantId, scope, submission)) {
        return fail("POLICY_DENIED", "VERIFIED approval requires an authorized evidence process.");
      }
      const row: StoredPolicyEvidence = {
        tenantId,
        offeringCategory: scope.offeringCategory,
        experience: scope.experience,
        source: "META_COMMERCE_POLICY",
        status: submission.outcome,
        reference: submission.reference.trim(),
        validatedBy: submission.processId.trim(),
        version: (current?.version ?? 0) + 1,
      };
      replaceEvidence(state, row);
      return ok(row, false);
    },
    read(actor, tenantId, scope) {
      const denied = requireActor(actor, tenantId, null, "read");
      if (denied) return denied;
      const row = findEvidence(state, tenantId, scope.offeringCategory, scope.experience);
      if (!row) return fail("NOT_FOUND", "Policy evidence not found.");
      return ok(row, false);
    },
  };

  ports.runAtomic = (work) => {
    const backup = cloneSnapshot(state);
    try {
      const result = work(ports);
      if (!result.ok) state = backup;
      return result;
    } catch (error) {
      state = backup;
      throw error;
    }
  };

  ports.exportSnapshot = () => sortSnapshot(cloneSnapshot(state));
  return ports;
}

/**
 * Copies `first`, then inserts new reservation units and new payment units from `second`.
 * A rejected unit inserts none of its transaction, booking, idempotency, events, or references.
 * Rows that already existed in `parent` are not field-merged. This is not a database lock manager
 * and does not prove that arbitrary SQL commits atomically.
 */
export function settleConcurrent(
  parent: PersistenceSnapshot,
  first: PersistenceSnapshot,
  second: PersistenceSnapshot,
): { snapshot: PersistenceSnapshot; conflicts: ConcurrentConflict[] } {
  const committed = cloneSnapshot(first);
  const conflicts: ConcurrentConflict[] = [];
  const parentBookings = new Map(parent.bookings.map((row) => [bookingId(row), stableHash(row)]));
  for (const row of second.bookings) {
    const id = bookingId(row);
    const before = parentBookings.get(id);
    if (before != null && stableHash(row) === before) continue;
    const now = committed.bookings.find((item) => bookingId(item) === id);
    if (now) {
      if (stableHash(now) !== stableHash(row)) conflicts.push({ code: before == null ? "SLOT_CONFLICT" : "VERSION_CONFLICT", key: id });
      continue;
    }
    const unit = collectReservationUnit(second, row);
    const conflict = reservationUnitConflict(committed, unit);
    if (conflict) {
      conflicts.push(conflict);
      continue;
    }
    applyReservationUnit(committed, unit);
  }

  const seenHooks = new Set(committed.webhooks.map((row) => row.dedupeKey));
  const parentHooks = new Set(parent.webhooks.map((row) => row.dedupeKey));
  for (const row of second.webhooks) {
    if (parentHooks.has(row.dedupeKey)) continue;
    if (seenHooks.has(row.dedupeKey)) {
      conflicts.push({ code: "DUPLICATE", key: row.dedupeKey });
      continue;
    }
    committed.webhooks.push(structuredClone(row));
    seenHooks.add(row.dedupeKey);
  }

  const parentAttempts = new Set(parent.attempts.map((row) => attemptId(row)));
  const takenRefs = new Map<string, string>();
  for (const row of committed.ledgers) {
    if (row.ledger.providerReference) takenRefs.set(refKey(row.tenantId, row.providerId, row.ledger.providerReference), row.attemptRef);
  }
  for (const row of second.attempts) {
    const id = attemptId(row);
    if (parentAttempts.has(id)) continue;
    if (committed.attempts.some((item) => attemptId(item) === id)) {
      conflicts.push({ code: "ATTEMPT_CONFLICT", key: id });
      continue;
    }
    const ledger = second.ledgers.find((item) => item.tenantId === row.tenantId && item.attemptRef === row.attemptRef);
    const reference = ledger?.ledger.providerReference;
    if (reference) {
      const owner = takenRefs.get(refKey(row.tenantId, row.providerId, reference));
      if (owner && owner !== row.attemptRef) {
        conflicts.push({ code: "REFERENCE_CONFLICT", key: reference });
        continue;
      }
    }
    committed.attempts.push(structuredClone(row));
    if (ledger) {
      committed.ledgers.push(structuredClone(ledger));
      if (reference) takenRefs.set(refKey(row.tenantId, row.providerId, reference), row.attemptRef);
    }
    for (const paymentEvent of second.ledgerEvents) {
      if (paymentEvent.tenantId !== row.tenantId || paymentEvent.attemptRef !== row.attemptRef) continue;
      const seen = committed.ledgerEvents.some(
        (item) => item.tenantId === paymentEvent.tenantId && item.attemptRef === paymentEvent.attemptRef && item.eventId === paymentEvent.eventId,
      );
      if (!seen) committed.ledgerEvents.push(structuredClone(paymentEvent));
    }
  }
  return { snapshot: sortSnapshot(committed), conflicts };
}

function openReservation(state: PersistenceSnapshot, draft: ReservationDraft): PortResult<{ transaction: StoredTransaction; booking: StoredBooking }> {
  const denied = requireActor(draft.actor, draft.tenantId, draft.locationId, "write");
  if (denied) return denied;
  if (phoneCorrelation(draft.idempotencyKey) || phoneCorrelation(draft.offeringId)) {
    return fail("INVALID", "A phone number cannot correlate a booking.");
  }
  const evidence = storedApproval(state, draft.tenantId, draft.category, draft.experience);
  const policy = evaluateEligibility({
    merchantEligibility: draft.merchantEligibility,
    offeringCategory: draft.category,
    experience: draft.experience,
    approvalEvidence: evidence,
  });
  if (policy.transactional !== "ALLOW") return fail("POLICY_DENIED", policy.reasons[0] ?? "Transactional commerce is denied.");
  const connection = findConnection(state, draft.tenantId, draft.locationId, draft.providerId, "BOOKING");
  if (!connection) return fail("NOT_FOUND", "Booking connection not found.");
  const blocked = connectionBlock(connection, state);
  if (blocked) return fail(blocked, "The booking connection cannot reserve.");
  const mode = reservationMode(draft, connection);
  if (mode) return mode;
  if (connection.mode === "EXTERNAL_API") {
    const fresh = Date.parse(draft.availabilityFreshUntil ?? "");
    if (!Number.isFinite(fresh) || fresh <= Date.parse(draft.nowIso)) {
      return fail("RECONCILIATION_REQUIRED", "External availability is missing or stale.");
    }
  }
  const idem = state.idempotency.find((row) => row.tenantId === draft.tenantId && row.scope === "RESERVE" && row.idempotencyKey === draft.idempotencyKey);
  if (idem && idem.requestHash !== draft.requestHash) return fail("IDEMPOTENCY_CONFLICT", "This idempotency key was used for a different request.");
  const inflight = findInflight(state, draft.tenantId, draft.idempotencyKey);
  if (inflight) {
    if (inflight.providerId !== draft.providerId || inflight.locationId !== draft.locationId) {
      return fail("SCOPE_MISMATCH", "Retry stays on the original provider and location.");
    }
    if (!inflight.absenceVerified && idem?.status === "PENDING_RESOLUTION") {
      return fail("RECONCILIATION_REQUIRED", "The original reservation is still unresolved.");
    }
  }
  if (idem?.status === "COMPLETED" && idem.transactionRef) {
    const transaction = findTransaction(state, draft.tenantId, idem.transactionRef);
    const booking = state.bookings.find((row) => row.tenantId === draft.tenantId && row.transactionRef === idem.transactionRef);
    if (transaction && booking) return ok({ transaction, booking }, true);
  }
  const bookingState = initialBookingState(draft, connection);
  const candidate: StoredBooking = {
    bookingRef: draft.bookingRef,
    tenantId: draft.tenantId,
    locationId: draft.locationId,
    transactionRef: draft.transactionRef,
    providerId: draft.providerId,
    providerMode: draft.providerMode,
    slotKey: `${draft.tenantId}:${draft.locationId}:${draft.offeringId}:${draft.startsAt}`,
    state: bookingState,
    providerReference: draft.providerReference,
    referenceAuthoritative: draft.referenceAuthoritative,
    idempotencyKey: draft.idempotencyKey,
    version: 1,
    holdExpiresAt: draft.holdExpiresAt,
    holdExpiryOwner: connection.capabilities.holdExpiryOwner,
    nativeExpiryPolicyId: connection.capabilities.holdExpiryOwner === "NATIVE_POLICY" ? draft.nativeExpiryPolicyId : null,
    pendingSlotKey: null,
  };
  if (bookingOccupiesCapacity(candidate.state) && slotTaken(state, candidate, "")) {
    return fail("SLOT_CONFLICT", "That slot is already reserved.");
  }
  if (draft.providerReference && externalTaken(state, draft.tenantId, draft.providerId, "BOOKING", draft.providerReference, draft.bookingRef)) {
    return fail("REFERENCE_CONFLICT", "That booking reference is already claimed.");
  }
  const transaction: StoredTransaction = {
    transactionRef: draft.transactionRef,
    tenantId: draft.tenantId,
    locationId: draft.locationId,
    intentRef: draft.intentRef,
    providerId: draft.providerId,
    state: bookingState === "CONFIRMED" ? "COMMITTED" : "IN_PROGRESS",
    bookingRef: draft.bookingRef,
    orderRef: null,
    paymentStatus: "NOT_STARTED",
    verifiedPaid: false,
    version: 1,
  };
  const prior = findTransaction(state, draft.tenantId, draft.transactionRef);
  if (prior) {
    if (prior.state !== transaction.state) {
      const moved = transitionTransaction(prior.state, transaction.state);
      if (!moved.ok) return fail("TERMINAL", "The unresolved transaction cannot accept a booking.");
      prior.state = transaction.state;
    }
    prior.bookingRef = draft.bookingRef;
    prior.providerId = draft.providerId;
    prior.version += 1;
  } else {
    state.transactions.push(transaction);
  }
  state.bookings.push(candidate);
  if (draft.providerReference) claimExternal(state, candidate, "BOOKING", draft.providerReference);
  if (idem) {
    idem.status = "COMPLETED";
    idem.transactionRef = draft.transactionRef;
    idem.version += 1;
  } else {
    state.idempotency.push({
      tenantId: draft.tenantId,
      scope: "RESERVE",
      idempotencyKey: draft.idempotencyKey,
      requestHash: draft.requestHash,
      status: "COMPLETED",
      transactionRef: draft.transactionRef,
      version: 1,
    });
  }
  const saved = findTransaction(state, draft.tenantId, draft.transactionRef);
  if (!saved) return fail("INVALID", "Transaction was not stored.");
  return ok({ transaction: saved, booking: candidate }, false);
}

function applyAttemptEvent(state: PersistenceSnapshot, actor: Actor, event: VerifiedPaymentEvent): PortResult<{ ledger: PaymentLedger; effect: PaymentEffect; netRevenueIdr: number }> {
  const attempt = state.attempts.find((row) => row.tenantId === event.tenantId && row.attemptRef === event.attemptRef);
  if (!attempt) return tenantMiss(actor, event.tenantId, "write", "Payment attempt not found.");
  const denied = requireActor(actor, event.tenantId, attempt.locationId, "write");
  if (denied) return denied;
  if (
    event.providerId !== attempt.providerId ||
    event.transactionRef !== attempt.transactionRef ||
    event.currency !== "IDR" ||
    !amountMatches(event, attempt.expectedAmountIdr)
  ) {
    return fail("MISMATCH", "The payment event does not match the stored attempt.");
  }
  const ledgerRow = state.ledgers.find((row) => row.tenantId === attempt.tenantId && row.attemptRef === attempt.attemptRef);
  if (!ledgerRow) return fail("NOT_FOUND", "Payment ledger not found.");
  if (event.providerReference.trim()) {
    const owner = referenceOwner(state, attempt.tenantId, attempt.providerId, event.providerReference);
    if (owner && owner !== attempt.attemptRef) return fail("REFERENCE_CONFLICT", "That provider reference belongs to another attempt.");
  }
  if (event.type === "payment.paid" && siblingCapturing(state, attempt)) {
    return fail("ATTEMPT_CONFLICT", "This transaction already has a live capture.");
  }
  if (refundOwnedElsewhere(state, attempt, event)) return fail("REFERENCE_CONFLICT", "That refund belongs to another attempt.");
  const applied = applyPaymentNotice(ledgerRow.ledger, event);
  if (applied.effect === "duplicate") {
    if (applied.ledger !== ledgerRow.ledger) {
      ledgerRow.ledger = applied.ledger;
      ledgerRow.version += 1;
    }
    return ok({ ledger: ledgerRow.ledger, effect: "duplicate", netRevenueIdr: netFor(state, attempt.tenantId, attempt.transactionRef).netRevenueIdr }, true);
  }
  ledgerRow.ledger = applied.ledger;
  ledgerRow.version += 1;
  if (applied.effect === "applied") {
    const already = state.ledgerEvents.some((row) => row.tenantId === attempt.tenantId && row.attemptRef === attempt.attemptRef && row.eventId === event.eventId);
    if (!already) {
      state.ledgerEvents.push({
        tenantId: attempt.tenantId,
        attemptRef: attempt.attemptRef,
        eventId: event.eventId,
        type: event.type,
        amountIdr: event.amountIdr,
        providerReference: event.providerReference,
        occurredAt: event.occurredAt,
        sequence: event.sequence,
      });
    }
    if (applied.ledger.providerReference) claimPaymentRef(state, attempt, applied.ledger.providerReference);
  }
  syncPaymentCache(state, attempt.tenantId, attempt.transactionRef);
  const net = netFor(state, attempt.tenantId, attempt.transactionRef);
  return ok({ ledger: ledgerRow.ledger, effect: applied.effect, netRevenueIdr: net.netRevenueIdr }, false);
}

function reconcileTerminal(
  state: PersistenceSnapshot,
  actor: Actor,
  input: {
    tenantId: string;
    attemptRef: string;
    to: "EXPIRED" | "FAILED";
    providerId: string;
    requirementId: string;
    satisfied: boolean;
    authoritativeRead: boolean;
  },
): PortResult<{ ledger: PaymentLedger; netRevenueIdr: number }> {
  const attempt = state.attempts.find((row) => row.tenantId === input.tenantId && row.attemptRef === input.attemptRef);
  if (!attempt) return tenantMiss(actor, input.tenantId, "write", "Payment attempt not found.");
  const denied = requireActor(actor, input.tenantId, attempt.locationId, "write");
  if (denied) return denied;
  if (input.providerId !== attempt.providerId) return fail("SCOPE_MISMATCH", "Reconcile against the attempt provider.");
  const ledgerRow = state.ledgers.find((row) => row.tenantId === attempt.tenantId && row.attemptRef === attempt.attemptRef);
  if (!ledgerRow) return fail("NOT_FOUND", "Payment ledger not found.");
  if (ledgerRow.ledger.status === input.to) {
    return ok({ ledger: ledgerRow.ledger, netRevenueIdr: netFor(state, attempt.tenantId, attempt.transactionRef).netRevenueIdr }, true);
  }
  if (ledgerRow.ledger.status !== "NOT_STARTED" && ledgerRow.ledger.status !== "PENDING") {
    return fail("TERMINAL", "A settled or closed attempt cannot be marked expired or failed.");
  }
  const connection = findConnection(state, attempt.tenantId, attempt.locationId, attempt.providerId, "PAYMENT");
  const requirement = connection?.capabilities.absenceConsistencyRequirement ?? null;
  if (!input.authoritativeRead || !input.satisfied || !requirement || input.requirementId !== requirement) {
    return fail("RECONCILIATION_REQUIRED", "EXPIRED and FAILED require an authoritative provider read.");
  }
  ledgerRow.ledger = { ...ledgerRow.ledger, status: input.to, currency: "IDR", amountIdr: ledgerRow.ledger.amountIdr ?? attempt.expectedAmountIdr };
  ledgerRow.version += 1;
  syncPaymentCache(state, attempt.tenantId, attempt.transactionRef);
  return ok({ ledger: ledgerRow.ledger, netRevenueIdr: netFor(state, attempt.tenantId, attempt.transactionRef).netRevenueIdr }, false);
}

function amountMatches(event: VerifiedPaymentEvent, expected: number): boolean {
  if (!Number.isSafeInteger(event.amountIdr) || !Number.isSafeInteger(expected) || expected < 1) return false;
  if (event.type === "payment.partially_refunded") return event.amountIdr > 0 && event.amountIdr < expected;
  if (event.type === "payment.pending") return event.amountIdr === expected;
  return event.amountIdr === expected;
}

function siblingCapturing(state: PersistenceSnapshot, attempt: StoredAttempt): boolean {
  return state.ledgers.some((row) => {
    if (row.tenantId !== attempt.tenantId || row.transactionRef !== attempt.transactionRef) return false;
    if (row.attemptRef === attempt.attemptRef) return false;
    return row.ledger.status === "PAID" || row.ledger.status === "PARTIALLY_REFUNDED";
  });
}

function refundOwnedElsewhere(state: PersistenceSnapshot, attempt: StoredAttempt, event: VerifiedPaymentEvent): boolean {
  if (event.type !== "payment.refunded" && event.type !== "payment.partially_refunded" && event.type !== "payment.chargeback") return false;
  const owner = referenceOwner(state, attempt.tenantId, attempt.providerId, event.providerReference);
  return Boolean(owner && owner !== attempt.attemptRef);
}

function referenceOwner(state: PersistenceSnapshot, tenantId: string, providerId: string, reference: string): string | null {
  if (!reference.trim()) return null;
  const ledger = state.ledgers.find((row) => row.tenantId === tenantId && row.providerId === providerId && row.ledger.providerReference === reference);
  return ledger?.attemptRef ?? null;
}

function syncPaymentCache(state: PersistenceSnapshot, tenantId: string, transactionRef: string): void {
  const transaction = findTransaction(state, tenantId, transactionRef);
  if (!transaction) return;
  const net = netFor(state, tenantId, transactionRef);
  transaction.paymentStatus = net.status;
  transaction.verifiedPaid = net.verifiedPaid;
  transaction.version += 1;
}

function netFor(state: PersistenceSnapshot, tenantId: string, transactionRef: string): {
  status: PaymentState;
  verifiedPaid: boolean;
  netRevenueIdr: number;
  refundedIdr: number;
  chargebackIdr: number;
} {
  const rows = state.ledgers.filter((row) => row.tenantId === tenantId && row.transactionRef === transactionRef);
  const aggregate = aggregateAttemptLedgers(rows.map((row) => row.ledger));
  let refundedIdr = 0;
  let chargebackIdr = 0;
  for (const row of rows) {
    if (row.ledger.status === "PAID" || row.ledger.status === "PARTIALLY_REFUNDED") refundedIdr += row.ledger.refundedIdr;
    if (row.ledger.status === "CHARGEBACK") chargebackIdr += row.ledger.amountIdr ?? 0;
  }
  return { ...aggregate, refundedIdr, chargebackIdr };
}

const BOOKING_MODES = ["NATIVE", "EXTERNAL_API", "EXTERNAL_CHECKOUT", "MANUAL"] as const;
const PAYMENT_MODES = ["MERCHANT_PAYMENT_GATEWAY", "EXTERNAL_BOOKING_PROVIDER", "OFFLINE_RECONCILIATION"] as const;

function connectionModeConflict(
  kind: ConnectionKind,
  mode: StoredConnection["mode"],
  capabilities: StoredConnection["capabilities"],
): PortFailure | null {
  const booking = (BOOKING_MODES as readonly string[]).includes(mode);
  const payment = (PAYMENT_MODES as readonly string[]).includes(mode);
  if (kind === "BOOKING" && !booking) return fail("INVALID", "A booking connection needs a booking mode.");
  if (kind === "PAYMENT" && !payment) return fail("INVALID", "A payment connection needs a payment mode.");
  if (mode === "MANUAL" || mode === "EXTERNAL_CHECKOUT") {
    if (capabilities.issuesAuthoritativeReference) return fail("INVALID", "This mode cannot issue an authoritative reservation.");
    if (capabilities.supportsHold) return fail("INVALID", "This mode cannot hold a booking.");
  }
  if (mode !== "NATIVE" && capabilities.holdExpiryOwner === "NATIVE_POLICY") {
    return fail("INVALID", "Native hold policy applies only to a native connection.");
  }
  return null;
}

function reservationMode(draft: ReservationDraft, connection: StoredConnection): PortFailure | null {
  if (connection.mode !== draft.providerMode) {
    return fail("SCOPE_MISMATCH", "The reservation mode must match the registered connection.");
  }
  if (connection.mode === "EXTERNAL_CHECKOUT") {
    return fail("INVALID", "External checkout does not create or hold a booking.");
  }
  if (connection.mode === "MANUAL" && (draft.referenceAuthoritative || Boolean(draft.providerReference?.trim()))) {
    return fail("INVALID", "A manual connection cannot invent an authoritative reservation.");
  }
  if ((draft.referenceAuthoritative || Boolean(draft.providerReference?.trim())) && !connection.capabilities.issuesAuthoritativeReference) {
    return fail("INVALID", "This provider cannot issue an authoritative reference.");
  }
  if (draft.referenceAuthoritative && !draft.providerReference?.trim()) {
    return fail("INVALID", "An authoritative reservation needs the provider reference.");
  }
  return null;
}

function initialBookingState(draft: ReservationDraft, connection: StoredConnection): BookingState {
  if (draft.providerMode === "MANUAL") return "REQUESTED";
  if (connection.capabilities.supportsHold) return "HELD";
  if (draft.referenceAuthoritative) return "CONFIRMED";
  return "REQUESTED";
}

function storedApproval(
  state: PersistenceSnapshot,
  tenantId: string,
  offeringCategory: StoredPolicyEvidence["offeringCategory"],
  experience: StoredPolicyEvidence["experience"],
) {
  const row = findEvidence(state, tenantId, offeringCategory, experience);
  if (!row?.validatedBy) return null;
  const evidence = { source: row.source, status: row.status, reference: row.reference } as const;
  return approvalIsVerified(evidence) ? evidence : null;
}

function findEvidence(
  state: PersistenceSnapshot,
  tenantId: string,
  offeringCategory: StoredPolicyEvidence["offeringCategory"],
  experience: StoredPolicyEvidence["experience"],
): StoredPolicyEvidence | undefined {
  return state.policyEvidence.find(
    (item) => item.tenantId === tenantId && item.offeringCategory === offeringCategory && item.experience === experience,
  );
}

function findConnection(
  state: PersistenceSnapshot,
  tenantId: string,
  locationId: string | null,
  providerId: string,
  kind: ConnectionKind,
): StoredConnection | null {
  const rows = state.connections.filter((row) => row.tenantId === tenantId && row.providerId === providerId && row.kind === kind);
  if (locationId) {
    const outlet = rows.find((row) => row.locationId === locationId);
    if (outlet) return outlet;
  }
  return rows.find((row) => row.locationId == null) ?? null;
}

function connectionBlock(connection: StoredConnection, state: PersistenceSnapshot): PortCode | null {
  if (connection.status !== "ACTIVE") return "UNUSABLE_CONNECTION";
  if (connection.health === "UNREACHABLE") return "UNUSABLE_CONNECTION";
  if (!connection.capabilities.mock && connection.health !== "HEALTHY") return "UNUSABLE_CONNECTION";
  for (const ref of [connection.credentialRef, connection.webhookSecretRef]) {
    if (!ref) continue;
    const credential = state.credentials.find((row) => row.credentialRef === ref);
    if (!credential || credential.status === "REVOKED") return "UNUSABLE_CONNECTION";
  }
  return null;
}

function rejectSecret(input: { credentialRef: string; plaintext?: string; ciphertext?: string }): PortFailure | null {
  if (input.plaintext != null || input.ciphertext != null) return fail("SECRET_REJECTED", "Credential bytes are not accepted by this port.");
  if (!/^cred_[a-z0-9_-]{1,64}$/.test(input.credentialRef)) return fail("SECRET_REJECTED", "Store a credential reference, not secret material.");
  return null;
}

function slotTaken(state: PersistenceSnapshot, booking: StoredBooking, exceptRef: string): boolean {
  const slot = slotOf(booking);
  return state.bookings.some((row) => row.bookingRef !== exceptRef && bookingOccupiesCapacity(row.state) && slotOf(row) === slot);
}

function slotOf(booking: Pick<StoredBooking, "tenantId" | "locationId" | "providerId" | "slotKey">): string {
  return `${booking.tenantId}:${booking.locationId}:${booking.providerId}:${booking.slotKey}`;
}

function externalTaken(state: PersistenceSnapshot, tenantId: string, providerId: string, owner: StoredExternalRef["owner"], externalId: string, ownerRef: string): boolean {
  return state.externalRefs.some(
    (row) => row.tenantId === tenantId && row.providerId === providerId && row.owner === owner && row.externalId === externalId && row.ownerRef !== ownerRef,
  );
}

function claimExternal(state: PersistenceSnapshot, booking: StoredBooking, owner: StoredExternalRef["owner"], externalId: string): void {
  state.externalRefs.push({
    tenantId: booking.tenantId,
    locationId: booking.locationId,
    owner,
    ownerRef: booking.bookingRef,
    providerId: booking.providerId,
    externalId,
  });
}

function claimPaymentRef(state: PersistenceSnapshot, attempt: StoredAttempt, externalId: string): void {
  if (externalTaken(state, attempt.tenantId, attempt.providerId, "PAYMENT", externalId, attempt.attemptRef)) return;
  if (state.externalRefs.some((row) => row.owner === "PAYMENT" && row.ownerRef === attempt.attemptRef && row.externalId === externalId)) return;
  state.externalRefs.push({
    tenantId: attempt.tenantId,
    locationId: attempt.locationId,
    owner: "PAYMENT",
    ownerRef: attempt.attemptRef,
    providerId: attempt.providerId,
    externalId,
  });
}

function findTransaction(state: PersistenceSnapshot, tenantId: string, transactionRef: string): StoredTransaction | undefined {
  return state.transactions.find((row) => row.tenantId === tenantId && row.transactionRef === transactionRef);
}

function findInflight(state: PersistenceSnapshot, tenantId: string, idempotencyKey: string): StoredInflight | undefined {
  return state.inflight.find((row) => row.tenantId === tenantId && row.idempotencyKey === idempotencyKey);
}

function touchTransaction(state: PersistenceSnapshot, tenantId: string, transactionRef: string, stateTo: TransactionState | undefined): void {
  const row = findTransaction(state, tenantId, transactionRef);
  if (!row || !stateTo || row.state === stateTo) return;
  const moved = transitionTransaction(row.state, stateTo);
  if (!moved.ok) return;
  row.state = stateTo;
  row.version += 1;
}

function replaceEvidence(state: PersistenceSnapshot, row: StoredPolicyEvidence): void {
  state.policyEvidence = state.policyEvidence.filter(
    (item) => item.tenantId !== row.tenantId || item.offeringCategory !== row.offeringCategory || item.experience !== row.experience,
  );
  state.policyEvidence.push(row);
}

function attestationMatches(
  key: string,
  tenantId: string,
  scope: { offeringCategory: string; experience: string },
  submission: Extract<EvidenceSubmission, { kind: "AUTHORIZED_PROCESS" }>,
): boolean {
  if (!submission.processId.trim() || !submission.reference.trim()) return false;
  const expected = signPolicyAttestation(key, {
    tenantId,
    offeringCategory: scope.offeringCategory,
    experience: scope.experience,
    processId: submission.processId,
    reference: submission.reference,
    outcome: submission.outcome,
  });
  const left = Buffer.from(expected);
  const right = Buffer.from(submission.attestation);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function publicIntent(row: StoredIntent): CommerceIntent {
  return {
    intentRef: row.intentRef,
    tenantId: row.tenantId,
    locationId: row.locationId,
    experience: row.experience,
    intentType: row.intentType,
    qualified: row.qualified,
    customerRef: row.customerRef,
    commerceOrderRef: row.commerceOrderRef,
  };
}

function requireActor(actor: Actor, tenantId: string, locationId: string | null, action: CommerceAction): PortFailure | null {
  const decision = authorize(actor, { tenantId, locationId }, action);
  if (!decision.ok) return fail(decision.code, "The actor cannot access this tenant or location.");
  if (locationId == null && actor.locationIds != null) return fail("LOCATION_FORBIDDEN", "An outlet actor cannot use a tenant-wide record.");
  return null;
}

function tenantMiss(actor: Actor, tenantId: string, action: CommerceAction, message: string): PortFailure {
  if (!actor.tenantId || actor.tenantId !== tenantId) return fail("CROSS_TENANT", "The actor cannot access this tenant or location.");
  if (actor.permissions != null && !actor.permissions.includes(action)) return fail("FORBIDDEN", "The actor cannot access this tenant or location.");
  return fail("NOT_FOUND", message);
}

function fail(code: PortCode, message: string): PortFailure {
  return { ok: false, code, message };
}

function ok<T>(value: T, replay: boolean): PortResult<T> {
  return { ok: true, replay, value: structuredClone(value) };
}

function emptySnapshot(): PersistenceSnapshot {
  return {
    version: 1,
    intents: [],
    transactions: [],
    bookings: [],
    connections: [],
    credentials: [],
    externalRefs: [],
    attempts: [],
    ledgers: [],
    ledgerEvents: [],
    idempotency: [],
    inflight: [],
    webhooks: [],
    events: [],
    touchpoints: [],
    aggregates: [],
    policyEvidence: [],
  };
}

function cloneSnapshot(snapshot: PersistenceSnapshot): PersistenceSnapshot {
  return structuredClone(snapshot);
}

function sortSnapshot(snapshot: PersistenceSnapshot): PersistenceSnapshot {
  const by = <T>(rows: T[], key: (row: T) => string) => rows.sort((left, right) => key(left).localeCompare(key(right)));
  by(snapshot.intents, (row) => `${row.tenantId}:${row.intentRef}`);
  by(snapshot.transactions, (row) => `${row.tenantId}:${row.transactionRef}`);
  by(snapshot.bookings, (row) => bookingId(row));
  by(snapshot.connections, (row) => row.connectionId);
  by(snapshot.credentials, (row) => row.credentialRef);
  by(snapshot.externalRefs, (row) => `${row.tenantId}:${row.providerId}:${row.owner}:${row.externalId}`);
  by(snapshot.attempts, (row) => attemptId(row));
  by(snapshot.ledgers, (row) => `${row.tenantId}:${row.attemptRef}`);
  by(snapshot.ledgerEvents, (row) => `${row.tenantId}:${row.attemptRef}:${row.eventId}`);
  by(snapshot.idempotency, (row) => `${row.tenantId}:${row.scope}:${row.idempotencyKey}`);
  by(snapshot.inflight, (row) => `${row.tenantId}:${row.idempotencyKey}`);
  by(snapshot.webhooks, (row) => row.dedupeKey);
  by(snapshot.events, (row) => `${row.tenantId}:${row.eventId}`);
  by(snapshot.touchpoints, (row) => row.touchpointId);
  by(snapshot.aggregates, (row) => row.aggregateId);
  by(snapshot.policyEvidence, (row) => `${row.tenantId}:${row.offeringCategory}:${row.experience}`);
  return snapshot;
}

function collectReservationUnit(snapshot: PersistenceSnapshot, booking: StoredBooking) {
  return {
    booking,
    transaction: snapshot.transactions.find((row) => row.tenantId === booking.tenantId && row.transactionRef === booking.transactionRef) ?? null,
    idempotency: snapshot.idempotency.filter(
      (row) => row.tenantId === booking.tenantId && (row.transactionRef === booking.transactionRef || row.idempotencyKey === booking.idempotencyKey),
    ),
    events: snapshot.events.filter((row) => row.tenantId === booking.tenantId && row.transactionRef === booking.transactionRef),
    externalRefs: snapshot.externalRefs.filter(
      (row) => row.tenantId === booking.tenantId && row.owner === "BOOKING" && row.ownerRef === booking.bookingRef,
    ),
    inflight: snapshot.inflight.filter((row) => row.tenantId === booking.tenantId && row.idempotencyKey === booking.idempotencyKey),
  };
}

function reservationUnitConflict(
  committed: PersistenceSnapshot,
  unit: ReturnType<typeof collectReservationUnit>,
): ConcurrentConflict | null {
  const booking = unit.booking;
  if (
    bookingOccupiesCapacity(booking.state) &&
    committed.bookings.some((item) => item.bookingRef !== booking.bookingRef && bookingOccupiesCapacity(item.state) && slotOf(item) === slotOf(booking))
  ) {
    return { code: "SLOT_CONFLICT", key: slotOf(booking) };
  }
  for (const row of unit.idempotency) {
    const current = committed.idempotency.find(
      (item) => item.tenantId === row.tenantId && item.scope === row.scope && item.idempotencyKey === row.idempotencyKey,
    );
    if (current && (current.requestHash !== row.requestHash || current.transactionRef !== row.transactionRef)) {
      return { code: "IDEMPOTENCY_CONFLICT", key: row.idempotencyKey };
    }
  }
  for (const row of unit.externalRefs) {
    const current = committed.externalRefs.find(
      (item) => item.tenantId === row.tenantId && item.providerId === row.providerId && item.owner === row.owner && item.externalId === row.externalId,
    );
    if (current && current.ownerRef !== row.ownerRef) return { code: "REFERENCE_CONFLICT", key: row.externalId };
  }
  if (unit.transaction) {
    const current = committed.transactions.find(
      (item) => item.tenantId === unit.transaction?.tenantId && item.transactionRef === unit.transaction.transactionRef,
    );
    if (current && stableHash(current) !== stableHash(unit.transaction)) {
      return { code: "VERSION_CONFLICT", key: unit.transaction.transactionRef };
    }
  }
  return null;
}

function applyReservationUnit(committed: PersistenceSnapshot, unit: ReturnType<typeof collectReservationUnit>): void {
  committed.bookings.push(structuredClone(unit.booking));
  if (
    unit.transaction &&
    !committed.transactions.some((row) => row.tenantId === unit.transaction?.tenantId && row.transactionRef === unit.transaction.transactionRef)
  ) {
    committed.transactions.push(structuredClone(unit.transaction));
  }
  for (const row of unit.idempotency) {
    if (!committed.idempotency.some((item) => item.tenantId === row.tenantId && item.scope === row.scope && item.idempotencyKey === row.idempotencyKey)) {
      committed.idempotency.push(structuredClone(row));
    }
  }
  for (const row of unit.events) {
    if (!committed.events.some((item) => item.tenantId === row.tenantId && item.eventId === row.eventId)) {
      committed.events.push(structuredClone(row));
    }
  }
  for (const row of unit.externalRefs) {
    if (
      !committed.externalRefs.some(
        (item) => item.tenantId === row.tenantId && item.providerId === row.providerId && item.owner === row.owner && item.externalId === row.externalId,
      )
    ) {
      committed.externalRefs.push(structuredClone(row));
    }
  }
  for (const row of unit.inflight) {
    if (!committed.inflight.some((item) => item.tenantId === row.tenantId && item.idempotencyKey === row.idempotencyKey)) {
      committed.inflight.push(structuredClone(row));
    }
  }
}

function bookingId(row: { tenantId: string; bookingRef: string }): string {
  return `${row.tenantId}:${row.bookingRef}`;
}

function attemptId(row: { tenantId: string; attemptRef: string }): string {
  return `${row.tenantId}:${row.attemptRef}`;
}

function refKey(tenantId: string, providerId: string, reference: string): string {
  return `${tenantId}:${providerId}:${reference}`;
}
