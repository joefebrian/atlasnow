import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canReadCommerce, canWriteCommerce } from "@/lib/commerce/access";
import { ROLES, type Role } from "@/lib/roles";
import type { Actor } from "./auth";
import { createMemoryCommerceStore, settleConcurrent, signPolicyAttestation } from "./memory-store";
import type { CommercePersistence, ConnectionCapabilities, ReservationDraft } from "./ports";
import { actorFromCommerceSession } from "./session-actor";
import type { VerifiedPaymentEvent } from "./payment";

const NOW = "2026-10-26T00:00:00.000Z";
const LATER = "2026-10-26T02:00:00.000Z";
const PAST = "2026-10-25T00:00:00.000Z";
const POLICY_KEY = "test-policy-validator";

function actor(tenantId: string, locationIds: readonly string[] | null = null, permissions?: readonly ("read" | "write")[]): Actor {
  return { tenantId, locationIds, permissions };
}

function capabilities(providerId: string, patch: Partial<ConnectionCapabilities> = {}): ConnectionCapabilities {
  return {
    providerId,
    supportsHold: true,
    mock: true,
    guaranteesIdempotency: false,
    absenceConsistencyRequirement: "mock-absence-v1",
    holdExpiryOwner: "PROVIDER",
    ...patch,
  };
}

function verified(store: CommercePersistence, tenantId: string, by = actor(tenantId)) {
  const submission = {
    kind: "AUTHORIZED_PROCESS" as const,
    processId: "policy-job",
    reference: "policy-record-1",
    outcome: "VERIFIED" as const,
    attestation: signPolicyAttestation(POLICY_KEY, {
      tenantId,
      processId: "policy-job",
      reference: "policy-record-1",
      outcome: "VERIFIED",
    }),
  };
  const saved = store.policy.submit(by, tenantId, submission);
  assert.equal(saved.ok, true);
}

function connect(store: CommercePersistence, tenantId: string, providerId: string, locationId: string | null, kind: "BOOKING" | "PAYMENT", patch?: Partial<ConnectionCapabilities>) {
  return store.connections.register(actor(tenantId), {
    tenantId,
    locationId,
    providerId,
    kind,
    mode: kind === "PAYMENT" ? "MERCHANT_PAYMENT_GATEWAY" : "NATIVE",
    capabilities: capabilities(providerId, patch),
  });
}

function draft(patch: Partial<ReservationDraft> = {}): ReservationDraft {
  return {
    actor: actor("tenant-a"),
    tenantId: "tenant-a",
    locationId: "loc-1",
    providerId: "book-1",
    offeringId: "offer-1",
    startsAt: "2026-10-27T09:00:00.000Z",
    idempotencyKey: "reserve-1",
    requestHash: "hash-1",
    experience: "WHATSAPP_CATALOG",
    category: "GENERAL_GOODS",
    merchantEligibility: "ELIGIBLE",
    intentRef: null,
    bookingRef: "BK-1",
    transactionRef: "TX-1",
    providerMode: "NATIVE",
    providerReference: "ext-book-1",
    referenceAuthoritative: true,
    holdExpiresAt: null,
    nativeExpiryPolicyId: null,
    availabilityFreshUntil: null,
    nowIso: NOW,
    callerEvidence: { source: "META_COMMERCE_POLICY", status: "VERIFIED", reference: "caller-said-so" },
    ...patch,
  };
}

function ready() {
  const store = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
  verified(store, "tenant-a");
  const connection = connect(store, "tenant-a", "book-1", "loc-1", "BOOKING");
  assert.equal(connection.ok, true);
  return store;
}

function event(patch: Partial<VerifiedPaymentEvent> = {}): VerifiedPaymentEvent {
  return {
    eventId: "pay-evt-1",
    type: "payment.paid",
    amountIdr: 10000,
    currency: "IDR",
    occurredAt: NOW,
    providerReference: "gw-1",
    sequence: 1,
    tenantId: "tenant-a",
    providerId: "pay-1",
    attemptRef: "attempt-1",
    transactionRef: "TX-1",
    ...patch,
  };
}

describe("commerce persistence ports", () => {
  it("keeps tenants and locations apart", () => {
    const store = ready();
    const opened = store.bookings.openReservation(draft());
    assert.equal(opened.ok, true);
    const foreign = store.bookings.read(actor("tenant-b"), "tenant-a", "BK-1");
    assert.equal(foreign.ok, false);
    if (foreign.ok) return;
    assert.equal(foreign.code, "CROSS_TENANT");
    const outlet = store.bookings.read(actor("tenant-a", ["loc-2"]), "tenant-a", "BK-1");
    assert.equal(outlet.ok, false);
    if (outlet.ok) return;
    assert.equal(outlet.code, "LOCATION_FORBIDDEN");
    const listed = store.bookings.list(actor("tenant-b"), "tenant-a", "loc-1");
    assert.equal(listed.ok, false);
    const own = store.bookings.list(actor("tenant-a", ["loc-1"]), "tenant-a", "loc-1");
    assert.equal(own.ok, true);
    if (!own.ok) return;
    assert.equal(own.value.length, 1);
    const elsewhere = store.bookings.list(actor("tenant-a", ["loc-1"]), "tenant-a", "loc-2");
    assert.equal(elsewhere.ok, false);
  });

  it("denies a caller-supplied VERIFIED enum and still allows an attested process", () => {
    const store = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    connect(store, "tenant-a", "book-1", "loc-1", "BOOKING");
    const caller = store.policy.submit(actor("tenant-a"), "tenant-a", {
      kind: "CALLER_ENUM",
      status: "VERIFIED",
      reference: "policy-record-1",
    });
    assert.equal(caller.ok, true);
    if (!caller.ok) return;
    assert.equal(caller.value.status, "UNVERIFIED");
    assert.equal(caller.value.validatedBy, null);
    const denied = store.bookings.openReservation(draft());
    assert.equal(denied.ok, false);
    if (denied.ok) return;
    assert.equal(denied.code, "POLICY_DENIED");
    assert.equal(store.exportSnapshot().transactions.length, 0);

    verified(store, "tenant-a");
    const service = store.bookings.openReservation(draft({ category: "SERVICE" }));
    assert.equal(service.ok, false);
    if (service.ok) return;
    assert.equal(service.code, "POLICY_DENIED");
    const chat = store.bookings.openReservation(draft({ experience: "WHATSAPP_CHAT" }));
    assert.equal(chat.ok, false);

    const allowed = store.bookings.openReservation(draft());
    assert.equal(allowed.ok, true);
    if (!allowed.ok) return;
    assert.equal(allowed.value.booking.state, "HELD");
    const again = store.bookings.openReservation(draft());
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.equal(again.replay, true);
    assert.equal(store.exportSnapshot().bookings.length, 1);
  });

  it("settles two concurrent holds on one slot as a single reservation", () => {
    const store = ready();
    const parent = store.exportSnapshot();
    const left = createMemoryCommerceStore({ snapshot: parent, policyValidatorKey: POLICY_KEY });
    const right = createMemoryCommerceStore({ snapshot: parent, policyValidatorKey: POLICY_KEY });
    assert.equal(left.bookings.openReservation(draft({ bookingRef: "BK-LEFT", transactionRef: "TX-LEFT" })).ok, true);
    assert.equal(right.bookings.openReservation(draft({ bookingRef: "BK-RIGHT", transactionRef: "TX-RIGHT", idempotencyKey: "reserve-right", requestHash: "hash-right" })).ok, true);
    const settled = settleConcurrent(parent, left.exportSnapshot(), right.exportSnapshot());
    assert.equal(settled.conflicts.some((item) => item.code === "SLOT_CONFLICT"), true);
    assert.equal(settled.snapshot.bookings.length, 1);
    assert.equal(settled.snapshot.bookings[0]?.bookingRef, "BK-LEFT");
  });

  it("rehydrates a timeout and does not create a second booking until that provider allows it", () => {
    const store = ready();
    const timeout = store.idempotency.recordTimeout(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      providerId: "book-1",
      idempotencyKey: "reserve-1",
      requestHash: "hash-1",
      slotKey: "tenant-a:loc-1:offer-1:2026-10-27T09:00:00.000Z",
      transactionRef: "TX-1",
    });
    assert.equal(timeout.ok, true);
    const raw = JSON.parse(JSON.stringify(store.exportSnapshot()));
    const restored = createMemoryCommerceStore({ snapshot: raw, policyValidatorKey: POLICY_KEY });
    assert.equal(JSON.stringify(restored.exportSnapshot()), JSON.stringify(store.exportSnapshot()));
    const blocked = restored.bookings.openReservation(draft());
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.code, "RECONCILIATION_REQUIRED");
    const otherProvider = restored.idempotency.noteAbsence(actor("tenant-a"), "tenant-a", "reserve-1", {
      providerId: "book-2",
      locationId: "loc-1",
      requirementId: "mock-absence-v1",
      satisfied: true,
      observedEmpty: true,
    });
    assert.equal(otherProvider.ok, false);
    if (otherProvider.ok) return;
    assert.equal(otherProvider.code, "SCOPE_MISMATCH");
    const unproven = restored.idempotency.noteAbsence(actor("tenant-a"), "tenant-a", "reserve-1", {
      providerId: "book-1",
      locationId: "loc-1",
      requirementId: "some-other-rule",
      satisfied: true,
      observedEmpty: true,
    });
    assert.equal(unproven.ok, false);
    if (unproven.ok) return;
    assert.equal(unproven.code, "RECONCILIATION_REQUIRED");
    const proven = restored.idempotency.noteAbsence(actor("tenant-a"), "tenant-a", "reserve-1", {
      providerId: "book-1",
      locationId: "loc-1",
      requirementId: "mock-absence-v1",
      satisfied: true,
      observedEmpty: true,
    });
    assert.equal(proven.ok, true);
    const created = restored.bookings.openReservation(draft());
    assert.equal(created.ok, true);
    const replay = restored.bookings.openReservation(draft());
    assert.equal(replay.ok, true);
    if (!replay.ok) return;
    assert.equal(replay.replay, true);
    assert.equal(restored.exportSnapshot().bookings.length, 1);
  });

  it("keeps one payment attempt identity, one provider reference, and one live capture", () => {
    const store = ready();
    assert.equal(store.bookings.openReservation(draft()).ok, true);
    assert.equal(store.bookings.openReservation(draft({
      bookingRef: "BK-2",
      transactionRef: "TX-2",
      idempotencyKey: "reserve-2",
      requestHash: "hash-2",
      offeringId: "offer-2",
      providerReference: "ext-book-2",
    })).ok, true);
    connect(store, "tenant-a", "pay-1", "loc-1", "PAYMENT");
    const first = store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-1",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    });
    assert.equal(first.ok, true);
    const replay = store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-1",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    });
    assert.equal(replay.ok, true);
    if (!replay.ok) return;
    assert.equal(replay.replay, true);
    const changed = store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-2",
      attemptRef: "attempt-1",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 5000,
    });
    assert.equal(changed.ok, false);
    if (changed.ok) return;
    assert.equal(changed.code, "ATTEMPT_CONFLICT");

    const paid = store.payments.applyEvent(actor("tenant-a"), event());
    assert.equal(paid.ok, true);
    if (!paid.ok) return;
    assert.equal(paid.value.netRevenueIdr, 10000);
    const duplicate = store.payments.applyEvent(actor("tenant-a"), event({ eventId: "pay-evt-1b" }));
    assert.equal(duplicate.ok, true);
    if (!duplicate.ok) return;
    assert.equal(duplicate.value.effect, "duplicate");
    assert.equal(duplicate.value.netRevenueIdr, 10000);
    assert.equal(store.exportSnapshot().ledgerEvents.length, 1);

    const second = store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-2",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    });
    assert.equal(second.ok, true);
    const split = store.payments.applyEvent(actor("tenant-a"), event({ eventId: "pay-evt-2", attemptRef: "attempt-2", providerReference: "gw-2" }));
    assert.equal(split.ok, false);
    if (split.ok) return;
    assert.equal(split.code, "ATTEMPT_CONFLICT");

    const other = store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-2",
      attemptRef: "attempt-3",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    });
    assert.equal(other.ok, true);
    const stolen = store.payments.applyEvent(actor("tenant-a"), event({
      eventId: "pay-evt-3",
      attemptRef: "attempt-3",
      transactionRef: "TX-2",
      providerReference: "gw-1",
    }));
    assert.equal(stolen.ok, false);
    if (stolen.ok) return;
    assert.equal(stolen.code, "REFERENCE_CONFLICT");
    const net = store.payments.net(actor("tenant-a"), "tenant-a", "TX-1");
    assert.equal(net.ok, true);
    if (!net.ok) return;
    assert.equal(net.value.netRevenueIdr, 10000);
    assert.equal(net.value.refundedIdr, 0);
  });

  it("reconciles EXPIRED only from an authoritative provider read", () => {
    const store = ready();
    assert.equal(store.bookings.openReservation(draft()).ok, true);
    connect(store, "tenant-a", "pay-1", "loc-1", "PAYMENT");
    assert.equal(store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-1",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    }).ok, true);
    const guessed = store.payments.reconcileTerminal(actor("tenant-a"), {
      tenantId: "tenant-a",
      attemptRef: "attempt-1",
      to: "EXPIRED",
      providerId: "pay-1",
      requirementId: "mock-absence-v1",
      satisfied: false,
      authoritativeRead: false,
    });
    assert.equal(guessed.ok, false);
    if (guessed.ok) return;
    assert.equal(guessed.code, "RECONCILIATION_REQUIRED");
    const expired = store.payments.reconcileTerminal(actor("tenant-a"), {
      tenantId: "tenant-a",
      attemptRef: "attempt-1",
      to: "EXPIRED",
      providerId: "pay-1",
      requirementId: "mock-absence-v1",
      satisfied: true,
      authoritativeRead: true,
    });
    assert.equal(expired.ok, true);
    if (!expired.ok) return;
    assert.equal(expired.value.ledger.status, "EXPIRED");
    assert.equal(expired.value.netRevenueIdr, 0);
    assert.equal(store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-2",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    }).ok, true);
    const paid = store.payments.applyEvent(actor("tenant-a"), event({ eventId: "pay-evt-2", attemptRef: "attempt-2", providerReference: "gw-2" }));
    assert.equal(paid.ok, true);
    if (!paid.ok) return;
    assert.equal(paid.value.netRevenueIdr, 10000);
    const back = store.payments.reconcileTerminal(actor("tenant-a"), {
      tenantId: "tenant-a",
      attemptRef: "attempt-2",
      to: "FAILED",
      providerId: "pay-1",
      requirementId: "mock-absence-v1",
      satisfied: true,
      authoritativeRead: true,
    });
    assert.equal(back.ok, false);
    if (back.ok) return;
    assert.equal(back.code, "TERMINAL");
  });

  it("cancels a booking without refunding, and refunds without changing the booking", () => {
    const store = ready();
    const opened = store.bookings.openReservation(draft());
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    connect(store, "tenant-a", "pay-1", "loc-1", "PAYMENT");
    assert.equal(store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-1",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    }).ok, true);
    assert.equal(store.payments.applyEvent(actor("tenant-a"), event()).ok, true);
    const cancelled = store.bookings.transition(actor("tenant-a"), {
      tenantId: "tenant-a",
      bookingRef: "BK-1",
      expectedVersion: opened.value.booking.version,
      to: "CANCELLED",
      nowIso: NOW,
    });
    assert.equal(cancelled.ok, true);
    const stillPaid = store.payments.net(actor("tenant-a"), "tenant-a", "TX-1");
    assert.equal(stillPaid.ok, true);
    if (!stillPaid.ok) return;
    assert.equal(stillPaid.value.status, "PAID");
    assert.equal(stillPaid.value.netRevenueIdr, 10000);
    const partial = store.payments.applyEvent(actor("tenant-a"), event({ eventId: "refund-1", type: "payment.partially_refunded", amountIdr: 4000 }));
    assert.equal(partial.ok, true);
    if (!partial.ok) return;
    assert.equal(partial.value.netRevenueIdr, 6000);
    assert.equal(store.payments.net(actor("tenant-a"), "tenant-a", "TX-1").ok, true);
    const after = store.payments.net(actor("tenant-a"), "tenant-a", "TX-1");
    assert.equal(after.ok, true);
    if (!after.ok) return;
    assert.equal(after.value.refundedIdr, 4000);
    assert.equal(after.value.chargebackIdr, 0);
    const booking = store.bookings.read(actor("tenant-a"), "tenant-a", "BK-1");
    assert.equal(booking.ok, true);
    if (!booking.ok) return;
    assert.equal(booking.value.state, "CANCELLED");
    const charge = store.payments.applyEvent(actor("tenant-a"), event({ eventId: "cb-1", type: "payment.chargeback", amountIdr: 10000 }));
    assert.equal(charge.ok, true);
    if (!charge.ok) return;
    assert.equal(charge.value.effect, "applied");
    assert.equal(charge.value.netRevenueIdr, 0);
    const settled = store.payments.net(actor("tenant-a"), "tenant-a", "TX-1");
    assert.equal(settled.ok, true);
    if (!settled.ok) return;
    assert.equal(settled.value.chargebackIdr, 10000);
    assert.equal(settled.value.refundedIdr, 0);
    const stillCancelled = store.bookings.read(actor("tenant-a"), "tenant-a", "BK-1");
    assert.equal(stillCancelled.ok, true);
    if (!stillCancelled.ok) return;
    assert.equal(stillCancelled.value.state, "CANCELLED");
  });

  it("accepts one webhook id and rolls back an event when the state write conflicts", () => {
    const store = ready();
    assert.equal(store.bookings.openReservation(draft()).ok, true);
    connect(store, "tenant-a", "pay-1", null, "PAYMENT");
    const first = store.webhooks.accept(actor("tenant-a"), { tenantId: "tenant-a", providerId: "pay-1", eventId: "wh-1", eventType: "payment.paid" });
    const second = store.webhooks.accept(actor("tenant-a"), { tenantId: "tenant-a", providerId: "pay-1", eventId: "wh-1", eventType: "payment.paid" });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.replay, true);
    assert.equal(store.exportSnapshot().webhooks.length, 1);

    const parent = store.exportSnapshot();
    const left = createMemoryCommerceStore({ snapshot: parent });
    const right = createMemoryCommerceStore({ snapshot: parent });
    assert.equal(left.webhooks.accept(actor("tenant-a"), { tenantId: "tenant-a", providerId: "pay-1", eventId: "wh-2", eventType: "payment.paid" }).ok, true);
    assert.equal(right.webhooks.accept(actor("tenant-a"), { tenantId: "tenant-a", providerId: "pay-1", eventId: "wh-2", eventType: "payment.paid" }).ok, true);
    const settled = settleConcurrent(parent, left.exportSnapshot(), right.exportSnapshot());
    assert.equal(settled.conflicts.some((item) => item.code === "DUPLICATE"), true);
    assert.equal(settled.snapshot.webhooks.filter((row) => row.eventId === "wh-2").length, 1);

    const rolled = store.runAtomic((draftStore) => {
      const appended = draftStore.events.append(actor("tenant-a"), {
        eventId: "evt-rollback",
        tenantId: "tenant-a",
        transactionRef: "TX-1",
        type: "note",
        at: NOW,
        payload: { ok: true },
      });
      if (!appended.ok) return appended;
      return draftStore.transactions.compareAndSwap(actor("tenant-a"), {
        tenantId: "tenant-a",
        transactionRef: "TX-1",
        expectedVersion: 0,
      });
    });
    assert.equal(rolled.ok, false);
    if (rolled.ok) return;
    assert.equal(rolled.code, "VERSION_CONFLICT");
    assert.equal(store.exportSnapshot().events.some((row) => row.eventId === "evt-rollback"), false);
  });

  it("expires only a provider-owned hold and leaves native expiry unset", () => {
    const providerStore = ready();
    assert.equal(providerStore.bookings.openReservation(draft({ holdExpiresAt: PAST })).ok, true);
    const expired = providerStore.bookings.expireDue(actor("tenant-a"), "tenant-a", "loc-1", NOW);
    assert.equal(expired.ok, true);
    if (!expired.ok) return;
    assert.equal(expired.value.expired, 1);

    const nativeStore = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    verified(nativeStore, "tenant-a");
    connect(nativeStore, "tenant-a", "book-1", "loc-1", "BOOKING", { holdExpiryOwner: "NATIVE_POLICY" });
    assert.equal(nativeStore.bookings.openReservation(draft({ holdExpiresAt: null, nativeExpiryPolicyId: null })).ok, true);
    const unset = nativeStore.bookings.expireDue(actor("tenant-a"), "tenant-a", "loc-1", LATER);
    assert.equal(unset.ok, true);
    if (!unset.ok) return;
    assert.equal(unset.value.expired, 0);
    assert.equal(unset.value.leftUnset, 1);
    const booking = nativeStore.bookings.read(actor("tenant-a"), "tenant-a", "BK-1");
    assert.equal(booking.ok, true);
    if (!booking.ok) return;
    assert.equal(booking.value.state, "HELD");
  });

  it("moves a booking slot only when the new slot is free", () => {
    const store = ready();
    const first = store.bookings.openReservation(draft());
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(store.bookings.openReservation(draft({
      bookingRef: "BK-2",
      transactionRef: "TX-2",
      idempotencyKey: "reserve-2",
      requestHash: "hash-2",
      offeringId: "offer-2",
      providerReference: "ext-book-2",
    })).ok, true);
    const requested = store.bookings.requestReschedule(actor("tenant-a"), {
      tenantId: "tenant-a",
      bookingRef: "BK-1",
      expectedVersion: first.value.booking.version,
      nextSlotKey: "tenant-a:loc-1:offer-2:2026-10-27T09:00:00.000Z",
    });
    assert.equal(requested.ok, true);
    if (!requested.ok) return;
    assert.equal(requested.value.slotKey, first.value.booking.slotKey);
    const conflict = store.bookings.commitReschedule(actor("tenant-a"), {
      tenantId: "tenant-a",
      bookingRef: "BK-1",
      expectedVersion: requested.value.version,
    });
    assert.equal(conflict.ok, false);
    if (conflict.ok) return;
    assert.equal(conflict.code, "SLOT_CONFLICT");
    const stayed = store.bookings.read(actor("tenant-a"), "tenant-a", "BK-1");
    assert.equal(stayed.ok, true);
    if (!stayed.ok) return;
    assert.equal(stayed.value.slotKey, first.value.booking.slotKey);
  });

  it("stores click identifiers apart from aggregate counts and can erase them", () => {
    const store = ready();
    assert.equal(store.bookings.openReservation(draft()).ok, true);
    const linked = store.attribution.saveTouchpoint(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      intentRef: "intent-1",
      bookingRef: "BK-1",
      attemptRef: null,
      gscClicks: 12,
    });
    assert.equal(linked.ok, false);
    if (linked.ok) return;
    assert.equal(linked.code, "INVALID");
    const touch = store.attribution.saveTouchpoint(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      intentRef: "intent-1",
      bookingRef: "BK-1",
      attemptRef: null,
      ctwaClid: "ctwa-1",
    });
    assert.equal(touch.ok, true);
    if (!touch.ok) return;
    assert.equal(touch.value.userLevel, true);
    const aggregate = store.attribution.saveAggregate(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      channel: "GOOGLE_SEARCH",
      count: 12,
    });
    assert.equal(aggregate.ok, true);
    const level = store.attribution.readClass(actor("tenant-a"), "tenant-a", "TX-1");
    assert.equal(level.ok, true);
    if (!level.ok) return;
    assert.equal(level.value.countsAsRevenue, false);
    assert.notEqual(level.value.level, "A");
    const erased = store.attribution.eraseIdentifiers(actor("tenant-a"), "tenant-a", touch.value.touchpointId, "customer request", LATER);
    assert.equal(erased.ok, true);
    if (!erased.ok) return;
    assert.equal(erased.value.ctwaClid, null);
    assert.equal(store.bookings.read(actor("tenant-a"), "tenant-a", "BK-1").ok, true);
    const intent = store.intents.save(actor("tenant-a"), {
      intentRef: "intent-1",
      tenantId: "tenant-a",
      locationId: "loc-1",
      experience: "WHATSAPP_CATALOG",
      intentType: "PRODUCT_ORDER",
      qualified: false,
      customerRef: null,
      commerceOrderRef: "CO-pointer",
    });
    assert.equal(intent.ok, true);
    if (!intent.ok) return;
    assert.equal(intent.value.commerceOrderRef, "CO-pointer");
  });

  it("stores credential references and rejects secret bytes", () => {
    const store = ready();
    const connection = store.connections.resolve(actor("tenant-a"), "tenant-a", "loc-1", "book-1", "BOOKING");
    assert.equal(connection.ok, true);
    if (!connection.ok) return;
    const leaked = store.connections.registerCredential(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: connection.value.connectionId,
      purpose: "WEBHOOK",
      credentialRef: "cred_webhook_1",
      plaintext: "super-secret-value",
    });
    assert.equal(leaked.ok, false);
    if (leaked.ok) return;
    assert.equal(leaked.code, "SECRET_REJECTED");
    assert.equal(JSON.stringify(store.exportSnapshot()).includes("super-secret-value"), false);
    const saved = store.connections.registerCredential(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: connection.value.connectionId,
      purpose: "WEBHOOK",
      credentialRef: "cred_webhook_1",
    });
    assert.equal(saved.ok, true);
    const rotated = store.connections.rotateCredential(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: connection.value.connectionId,
      purpose: "WEBHOOK",
      credentialRef: "cred_webhook_2",
    });
    assert.equal(rotated.ok, true);
    if (!rotated.ok) return;
    assert.equal(rotated.value.keyVersion, 2);
    assert.equal(rotated.value.status, "ACTIVE");
    const revoked = store.connections.revokeCredential(actor("tenant-a"), "tenant-a", "cred_webhook_2", LATER);
    assert.equal(revoked.ok, true);
    const blocked = store.bookings.openReservation(draft({ idempotencyKey: "reserve-9", requestHash: "hash-9", bookingRef: "BK-9", transactionRef: "TX-9", offeringId: "offer-9", providerReference: "ext-9" }));
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.code, "UNUSABLE_CONNECTION");
  });

  it("prefers an outlet connection and does not fall through an unreachable outlet", () => {
    const store = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    verified(store, "tenant-a");
    connect(store, "tenant-a", "book-1", null, "BOOKING");
    const outlet = connect(store, "tenant-a", "book-1", "loc-1", "BOOKING");
    assert.equal(outlet.ok, true);
    if (!outlet.ok) return;
    const resolved = store.connections.resolve(actor("tenant-a"), "tenant-a", "loc-1", "book-1", "BOOKING");
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.value.connectionId, outlet.value.connectionId);
    const seenVersion = outlet.value.version;
    const health = store.connections.reportHealth(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: outlet.value.connectionId,
      expectedVersion: seenVersion,
      health: "UNREACHABLE",
      at: NOW,
    });
    assert.equal(health.ok, true);
    const stale = store.connections.reportHealth(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: outlet.value.connectionId,
      expectedVersion: seenVersion,
      health: "HEALTHY",
      at: LATER,
    });
    assert.equal(stale.ok, false);
    if (stale.ok) return;
    assert.equal(stale.code, "VERSION_CONFLICT");
    const reserved = store.bookings.openReservation(draft());
    assert.equal(reserved.ok, false);
    if (reserved.ok) return;
    assert.equal(reserved.code, "UNUSABLE_CONNECTION");
    assert.equal(store.exportSnapshot().bookings.length, 0);
  });

  it("rejects a stale external slot and a reused booking reference", () => {
    const store = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    verified(store, "tenant-a");
    const registered = store.connections.register(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      providerId: "book-1",
      kind: "BOOKING",
      mode: "EXTERNAL_API",
      capabilities: capabilities("book-1"),
    });
    assert.equal(registered.ok, true);
    const stale = store.bookings.openReservation(draft({
      providerMode: "EXTERNAL_API",
      availabilityFreshUntil: PAST,
      providerReference: "ext-book-1",
    }));
    assert.equal(stale.ok, false);
    if (stale.ok) return;
    assert.equal(stale.code, "RECONCILIATION_REQUIRED");
    const fresh = store.bookings.openReservation(draft({
      providerMode: "EXTERNAL_API",
      availabilityFreshUntil: LATER,
      providerReference: "ext-book-1",
    }));
    assert.equal(fresh.ok, true);
    const reused = store.bookings.openReservation(draft({
      providerMode: "EXTERNAL_API",
      availabilityFreshUntil: LATER,
      bookingRef: "BK-2",
      transactionRef: "TX-2",
      idempotencyKey: "reserve-2",
      requestHash: "hash-2",
      offeringId: "offer-2",
      providerReference: "ext-book-1",
    }));
    assert.equal(reused.ok, false);
    if (reused.ok) return;
    assert.equal(reused.code, "REFERENCE_CONFLICT");
  });

  it("maps commerce sessions through the existing read and write rules", () => {
    const modes = ["platform", "brand", "agency"] as const;
    for (const role of ROLES) {
      for (const mode of modes) {
        for (const staff of [false, true]) {
          const session = { role: role as Role, mode, isAgencyStaff: staff };
          const mapped = actorFromCommerceSession({ ...session, tenantId: "tenant-a", locationId: role === "BRANCH" ? "loc-1" : null });
          assert.equal(mapped.permissions?.includes("read") ?? false, canReadCommerce(session));
          assert.equal(mapped.permissions?.includes("write") ?? false, canWriteCommerce(session));
        }
      }
    }
    const branch = actorFromCommerceSession({
      tenantId: "tenant-a",
      role: "BRANCH",
      mode: "brand",
      isAgencyStaff: false,
      locationId: "loc-9",
    });
    assert.deepEqual(branch.locationIds, ["loc-9"]);
    assert.deepEqual(branch.permissions, []);
    const admin = actorFromCommerceSession({
      tenantId: "tenant-a",
      role: "CLIENT_ADMIN",
      mode: "brand",
      isAgencyStaff: false,
      locationId: null,
    });
    assert.equal(admin.locationIds, null);
    assert.deepEqual(admin.permissions, ["read", "write"]);
  });
});
