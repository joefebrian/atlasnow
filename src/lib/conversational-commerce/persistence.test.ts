import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canReadCommerce, canWriteCommerce } from "@/lib/commerce/access";
import { ROLES, type Role } from "@/lib/roles";
import type { Actor } from "./auth";
import { createMemoryCommerceStore, settleConcurrent, signPolicyAttestation } from "./memory-store";
import type { CommercePersistence, ConnectionCapabilities, PolicyScope, ReservationDraft } from "./ports";
import { actorFromCommerceSession } from "./session-actor";
import { signPaymentProof, trustPaymentNotice, type VerifiedPaymentEvent } from "./payment";

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
    issuesAuthoritativeReference: true,
    ...patch,
  };
}

const GOODS_CATALOG: PolicyScope = { offeringCategory: "GENERAL_GOODS", experience: "WHATSAPP_CATALOG" };

async function verified(store: CommercePersistence, tenantId: string, by = actor(tenantId), scope: PolicyScope = GOODS_CATALOG) {
  const submission = {
    kind: "AUTHORIZED_PROCESS" as const,
    processId: "policy-job",
    reference: "policy-record-1",
    outcome: "VERIFIED" as const,
    attestation: signPolicyAttestation(POLICY_KEY, {
      tenantId,
      offeringCategory: scope.offeringCategory,
      experience: scope.experience,
      processId: "policy-job",
      reference: "policy-record-1",
      outcome: "VERIFIED",
    }),
  };
  const saved = (await store.policy.submit(by, tenantId, scope, submission));
  assert.equal(saved.ok, true);
}

async function connect(store: CommercePersistence, tenantId: string, providerId: string, locationId: string | null, kind: "BOOKING" | "PAYMENT", patch?: Partial<ConnectionCapabilities>) {
  return (await store.connections.register(actor(tenantId), {
    tenantId,
    locationId,
    providerId,
    kind,
    mode: kind === "PAYMENT" ? "MERCHANT_PAYMENT_GATEWAY" : "NATIVE",
    capabilities: capabilities(providerId, patch),
  }));
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

async function ready() {
  const store = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
  await verified(store, "tenant-a");
  const connection = (await connect(store, "tenant-a", "book-1", "loc-1", "BOOKING"));
  assert.equal(connection.ok, true);
  return store;
}

function trusted(patch: Partial<VerifiedPaymentEvent> = {}, expectedAmountIdr = 10000) {
  const verified = event(patch);
  const notice = { ...verified, evidence: "VERIFIED_PROVIDER_EVENT" as const };
  const secret = "persistence-payment-secret";
  const fields = {
    tenantId: notice.tenantId,
    providerId: notice.providerId,
    attemptRef: notice.attemptRef,
    transactionRef: notice.transactionRef,
    providerReference: notice.providerReference,
    currency: "IDR" as const,
    amountIdr: notice.amountIdr,
    eventId: notice.eventId,
    type: notice.type,
    occurredAt: notice.occurredAt,
    sequence: notice.sequence,
  };
  const proof = { ...fields, signature: signPaymentProof(secret, fields) };
  const result = trustPaymentNotice({
    notice,
    proof,
    secret,
    expectation: {
      tenantId: verified.tenantId,
      providerId: verified.providerId,
      attemptRef: verified.attemptRef,
      transactionRef: verified.transactionRef,
      currency: "IDR" as const,
      amountIdr: expectedAmountIdr,
    },
  });
  if (!result.ok) throw new Error(result.code);
  return result.evidence;
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
  it("keeps tenants and locations apart", async () => {
    const store = await ready();
    const opened = (await store.bookings.openReservation(draft()));
    assert.equal(opened.ok, true);
    const foreign = (await store.bookings.read(actor("tenant-b"), "tenant-a", "BK-1"));
    assert.equal(foreign.ok, false);
    if (foreign.ok) return;
    assert.equal(foreign.code, "CROSS_TENANT");
    const outlet = (await store.bookings.read(actor("tenant-a", ["loc-2"]), "tenant-a", "BK-1"));
    assert.equal(outlet.ok, false);
    if (outlet.ok) return;
    assert.equal(outlet.code, "LOCATION_FORBIDDEN");
    const listed = (await store.bookings.list(actor("tenant-b"), "tenant-a", "loc-1"));
    assert.equal(listed.ok, false);
    const own = (await store.bookings.list(actor("tenant-a", ["loc-1"]), "tenant-a", "loc-1"));
    assert.equal(own.ok, true);
    if (!own.ok) return;
    assert.equal(own.value.length, 1);
    const elsewhere = (await store.bookings.list(actor("tenant-a", ["loc-1"]), "tenant-a", "loc-2"));
    assert.equal(elsewhere.ok, false);
  });

  it("denies a caller-supplied VERIFIED enum and still allows an attested process", async () => {
    const store = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    (await connect(store, "tenant-a", "book-1", "loc-1", "BOOKING"));
    const caller = (await store.policy.submit(actor("tenant-a"), "tenant-a", GOODS_CATALOG, {
      kind: "CALLER_ENUM",
      status: "VERIFIED",
      reference: "policy-record-1",
    }));
    assert.equal(caller.ok, true);
    if (!caller.ok) return;
    assert.equal(caller.value.status, "UNVERIFIED");
    assert.equal(caller.value.validatedBy, null);
    const denied = (await store.bookings.openReservation(draft()));
    assert.equal(denied.ok, false);
    if (denied.ok) return;
    assert.equal(denied.code, "POLICY_DENIED");
    assert.equal((await store.exportSnapshot()).transactions.length, 0);

    await verified(store, "tenant-a");
    const service = (await store.bookings.openReservation(draft({ category: "SERVICE" })));
    assert.equal(service.ok, false);
    if (service.ok) return;
    assert.equal(service.code, "POLICY_DENIED");
    const chat = (await store.bookings.openReservation(draft({ experience: "WHATSAPP_CHAT" })));
    assert.equal(chat.ok, false);

    const allowed = (await store.bookings.openReservation(draft()));
    assert.equal(allowed.ok, true);
    if (!allowed.ok) return;
    assert.equal(allowed.value.booking.state, "HELD");
    const again = (await store.bookings.openReservation(draft()));
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.equal(again.replay, true);
    assert.equal((await store.exportSnapshot()).bookings.length, 1);
  });

  it("settles two concurrent holds on one slot as a single reservation", async () => {
    const store = await ready();
    const parent = (await store.exportSnapshot());
    const left = createMemoryCommerceStore({ snapshot: parent, policyValidatorKey: POLICY_KEY });
    const right = createMemoryCommerceStore({ snapshot: parent, policyValidatorKey: POLICY_KEY });
    assert.equal((await left.bookings.openReservation(draft({ bookingRef: "BK-LEFT", transactionRef: "TX-LEFT" }))).ok, true);
    assert.equal((await right.bookings.openReservation(draft({ bookingRef: "BK-RIGHT", transactionRef: "TX-RIGHT", idempotencyKey: "reserve-right", requestHash: "hash-right" }))).ok, true);
    const settled = settleConcurrent(parent, (await left.exportSnapshot()), (await right.exportSnapshot()));
    assert.equal(settled.conflicts.some((item) => item.code === "SLOT_CONFLICT"), true);
    assert.equal(settled.snapshot.bookings.length, 1);
    assert.equal(settled.snapshot.bookings[0]?.bookingRef, "BK-LEFT");
    assert.equal(settled.snapshot.transactions.some((row) => row.transactionRef === "TX-LEFT"), true);
    assert.equal(settled.snapshot.transactions.some((row) => row.transactionRef === "TX-RIGHT"), false);
    assert.equal(settled.snapshot.idempotency.some((row) => row.idempotencyKey === "reserve-1"), true);
    assert.equal(settled.snapshot.idempotency.some((row) => row.idempotencyKey === "reserve-right"), false);
    assert.equal(settled.snapshot.bookings[0]?.transactionRef, "TX-LEFT");
  });

  it("rehydrates a timeout and does not create a second booking until that provider allows it", async () => {
    const store = await ready();
    const timeout = (await store.idempotency.recordTimeout(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      providerId: "book-1",
      idempotencyKey: "reserve-1",
      requestHash: "hash-1",
      slotKey: "tenant-a:loc-1:offer-1:2026-10-27T09:00:00.000Z",
      transactionRef: "TX-1",
    }));
    assert.equal(timeout.ok, true);
    const raw = JSON.parse(JSON.stringify((await store.exportSnapshot())));
    const restored = createMemoryCommerceStore({ snapshot: raw, policyValidatorKey: POLICY_KEY });
    assert.equal(JSON.stringify((await restored.exportSnapshot())), JSON.stringify((await store.exportSnapshot())));
    const blocked = (await restored.bookings.openReservation(draft()));
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.code, "RECONCILIATION_REQUIRED");
    const otherProvider = (await restored.idempotency.noteAbsence(actor("tenant-a"), "tenant-a", "reserve-1", {
      providerId: "book-2",
      locationId: "loc-1",
      requirementId: "mock-absence-v1",
      satisfied: true,
      observedEmpty: true,
    }));
    assert.equal(otherProvider.ok, false);
    if (otherProvider.ok) return;
    assert.equal(otherProvider.code, "SCOPE_MISMATCH");
    const unproven = (await restored.idempotency.noteAbsence(actor("tenant-a"), "tenant-a", "reserve-1", {
      providerId: "book-1",
      locationId: "loc-1",
      requirementId: "some-other-rule",
      satisfied: true,
      observedEmpty: true,
    }));
    assert.equal(unproven.ok, false);
    if (unproven.ok) return;
    assert.equal(unproven.code, "RECONCILIATION_REQUIRED");
    const proven = (await restored.idempotency.noteAbsence(actor("tenant-a"), "tenant-a", "reserve-1", {
      providerId: "book-1",
      locationId: "loc-1",
      requirementId: "mock-absence-v1",
      satisfied: true,
      observedEmpty: true,
    }));
    assert.equal(proven.ok, true);
    const created = (await restored.bookings.openReservation(draft()));
    assert.equal(created.ok, true);
    const replay = (await restored.bookings.openReservation(draft()));
    assert.equal(replay.ok, true);
    if (!replay.ok) return;
    assert.equal(replay.replay, true);
    assert.equal((await restored.exportSnapshot()).bookings.length, 1);
  });

  it("keeps one payment attempt identity, one provider reference, and one live capture", async () => {
    const store = await ready();
    assert.equal((await store.bookings.openReservation(draft())).ok, true);
    assert.equal((await store.bookings.openReservation(draft({
      bookingRef: "BK-2",
      transactionRef: "TX-2",
      idempotencyKey: "reserve-2",
      requestHash: "hash-2",
      offeringId: "offer-2",
      providerReference: "ext-book-2",
    }))).ok, true);
    (await connect(store, "tenant-a", "pay-1", "loc-1", "PAYMENT"));
    const first = (await store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-1",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    }));
    assert.equal(first.ok, true);
    const replay = (await store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-1",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    }));
    assert.equal(replay.ok, true);
    if (!replay.ok) return;
    assert.equal(replay.replay, true);
    const changed = (await store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-2",
      attemptRef: "attempt-1",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 5000,
    }));
    assert.equal(changed.ok, false);
    if (changed.ok) return;
    assert.equal(changed.code, "ATTEMPT_CONFLICT");

    const paid = (await store.payments.applyEvent(actor("tenant-a"), trusted()));
    assert.equal(paid.ok, true);
    if (!paid.ok) return;
    assert.equal(paid.value.netRevenueIdr, 10000);
    const duplicate = (await store.payments.applyEvent(actor("tenant-a"), trusted({ eventId: "pay-evt-1b" })));
    assert.equal(duplicate.ok, true);
    if (!duplicate.ok) return;
    assert.equal(duplicate.value.effect, "duplicate");
    assert.equal(duplicate.value.netRevenueIdr, 10000);
    assert.equal((await store.exportSnapshot()).ledgerEvents.length, 1);

    const second = (await store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-2",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    }));
    assert.equal(second.ok, true);
    const split = (await store.payments.applyEvent(actor("tenant-a"), trusted({ eventId: "pay-evt-2", attemptRef: "attempt-2", providerReference: "gw-2" })));
    assert.equal(split.ok, false);
    if (split.ok) return;
    assert.equal(split.code, "ATTEMPT_CONFLICT");

    const other = (await store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-2",
      attemptRef: "attempt-3",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    }));
    assert.equal(other.ok, true);
    const stolen = (await store.payments.applyEvent(actor("tenant-a"), trusted({
      eventId: "pay-evt-3",
      attemptRef: "attempt-3",
      transactionRef: "TX-2",
      providerReference: "gw-1",
    })));
    assert.equal(stolen.ok, false);
    if (stolen.ok) return;
    assert.equal(stolen.code, "REFERENCE_CONFLICT");
    const net = (await store.payments.net(actor("tenant-a"), "tenant-a", "TX-1"));
    assert.equal(net.ok, true);
    if (!net.ok) return;
    assert.equal(net.value.netRevenueIdr, 10000);
    assert.equal(net.value.refundedIdr, 0);
  });

  it("reconciles EXPIRED only from an authoritative provider read", async () => {
    const store = await ready();
    assert.equal((await store.bookings.openReservation(draft())).ok, true);
    (await connect(store, "tenant-a", "pay-1", "loc-1", "PAYMENT"));
    assert.equal((await store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-1",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    })).ok, true);
    const guessed = (await store.payments.reconcileTerminal(actor("tenant-a"), {
      tenantId: "tenant-a",
      attemptRef: "attempt-1",
      to: "EXPIRED",
      providerId: "pay-1",
      requirementId: "mock-absence-v1",
      satisfied: false,
      authoritativeRead: false,
    }));
    assert.equal(guessed.ok, false);
    if (guessed.ok) return;
    assert.equal(guessed.code, "RECONCILIATION_REQUIRED");
    const expired = (await store.payments.reconcileTerminal(actor("tenant-a"), {
      tenantId: "tenant-a",
      attemptRef: "attempt-1",
      to: "EXPIRED",
      providerId: "pay-1",
      requirementId: "mock-absence-v1",
      satisfied: true,
      authoritativeRead: true,
    }));
    assert.equal(expired.ok, true);
    if (!expired.ok) return;
    assert.equal(expired.value.ledger.status, "EXPIRED");
    assert.equal(expired.value.netRevenueIdr, 0);
    assert.equal((await store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-2",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    })).ok, true);
    const paid = (await store.payments.applyEvent(actor("tenant-a"), trusted({ eventId: "pay-evt-2", attemptRef: "attempt-2", providerReference: "gw-2" })));
    assert.equal(paid.ok, true);
    if (!paid.ok) return;
    assert.equal(paid.value.netRevenueIdr, 10000);
    const back = (await store.payments.reconcileTerminal(actor("tenant-a"), {
      tenantId: "tenant-a",
      attemptRef: "attempt-2",
      to: "FAILED",
      providerId: "pay-1",
      requirementId: "mock-absence-v1",
      satisfied: true,
      authoritativeRead: true,
    }));
    assert.equal(back.ok, false);
    if (back.ok) return;
    assert.equal(back.code, "TERMINAL");
  });

  it("cancels a booking without refunding, and refunds without changing the booking", async () => {
    const store = await ready();
    const opened = (await store.bookings.openReservation(draft()));
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    (await connect(store, "tenant-a", "pay-1", "loc-1", "PAYMENT"));
    assert.equal((await store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-1",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    })).ok, true);
    assert.equal((await store.payments.applyEvent(actor("tenant-a"), trusted())).ok, true);
    const cancelled = (await store.bookings.transition(actor("tenant-a"), {
      tenantId: "tenant-a",
      bookingRef: "BK-1",
      expectedVersion: opened.value.booking.version,
      to: "CANCELLED",
      nowIso: NOW,
    }));
    assert.equal(cancelled.ok, true);
    const stillPaid = (await store.payments.net(actor("tenant-a"), "tenant-a", "TX-1"));
    assert.equal(stillPaid.ok, true);
    if (!stillPaid.ok) return;
    assert.equal(stillPaid.value.status, "PAID");
    assert.equal(stillPaid.value.netRevenueIdr, 10000);
    const partial = (await store.payments.applyEvent(actor("tenant-a"), trusted({ eventId: "refund-1", type: "payment.partially_refunded", amountIdr: 4000 })));
    assert.equal(partial.ok, true);
    if (!partial.ok) return;
    assert.equal(partial.value.netRevenueIdr, 6000);
    assert.equal((await store.payments.net(actor("tenant-a"), "tenant-a", "TX-1")).ok, true);
    const after = (await store.payments.net(actor("tenant-a"), "tenant-a", "TX-1"));
    assert.equal(after.ok, true);
    if (!after.ok) return;
    assert.equal(after.value.refundedIdr, 4000);
    assert.equal(after.value.chargebackIdr, 0);
    const booking = (await store.bookings.read(actor("tenant-a"), "tenant-a", "BK-1"));
    assert.equal(booking.ok, true);
    if (!booking.ok) return;
    assert.equal(booking.value.state, "CANCELLED");
    const charge = (await store.payments.applyEvent(actor("tenant-a"), trusted({ eventId: "cb-1", type: "payment.chargeback", amountIdr: 10000 })));
    assert.equal(charge.ok, true);
    if (!charge.ok) return;
    assert.equal(charge.value.effect, "applied");
    assert.equal(charge.value.netRevenueIdr, 0);
    const settled = (await store.payments.net(actor("tenant-a"), "tenant-a", "TX-1"));
    assert.equal(settled.ok, true);
    if (!settled.ok) return;
    assert.equal(settled.value.chargebackIdr, 10000);
    assert.equal(settled.value.refundedIdr, 0);
    const stillCancelled = (await store.bookings.read(actor("tenant-a"), "tenant-a", "BK-1"));
    assert.equal(stillCancelled.ok, true);
    if (!stillCancelled.ok) return;
    assert.equal(stillCancelled.value.state, "CANCELLED");
  });

  it("rejects a forged paid event submitted directly to the payment port", async () => {
    const store = await ready();
    assert.equal((await store.bookings.openReservation(draft())).ok, true);
    assert.equal((await connect(store, "tenant-a", "pay-1", "loc-1", "PAYMENT")).ok, true);
    assert.equal((await store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-1",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    })).ok, true);
    const forged = (await store.payments.applyEvent(actor("tenant-a"), { event: event() }));
    assert.equal(forged.ok, false);
    if (forged.ok) return;
    assert.equal(forged.code, "INVALID");
    const writer = (await store.payments.applyEvent(actor("tenant-a", null, ["write"]), { event: event({ eventId: "forged-write" }) }));
    assert.equal(writer.ok, false);
    if (writer.ok) return;
    assert.equal(writer.code, "INVALID");
    const ledger = (await store.exportSnapshot()).ledgers[0];
    assert.equal(ledger?.ledger.status, "NOT_STARTED");
    assert.equal(ledger?.ledger.verifiedPaid, false);
    assert.equal((await store.exportSnapshot()).ledgerEvents.length, 0);
    const paid = (await store.payments.applyEvent(actor("tenant-a"), trusted()));
    assert.equal(paid.ok, true);
    if (!paid.ok) return;
    assert.equal(paid.value.ledger.status, "PAID");
    assert.equal(paid.value.ledger.verifiedPaid, true);
  });

  it("accepts one webhook id and rolls back an event when the state write conflicts", async () => {
    const store = await ready();
    assert.equal((await store.bookings.openReservation(draft())).ok, true);
    const payment = (await connect(store, "tenant-a", "pay-1", null, "PAYMENT"));
    assert.equal(payment.ok, true);
    if (!payment.ok) return;
    const first = (await store.webhooks.accept(actor("tenant-a"), { tenantId: "tenant-a", connectionId: payment.value.connectionId, eventId: "wh-1", eventType: "payment.paid" }));
    const second = (await store.webhooks.accept(actor("tenant-a"), { tenantId: "tenant-a", connectionId: payment.value.connectionId, eventId: "wh-1", eventType: "payment.paid" }));
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.replay, true);
    assert.equal((await store.exportSnapshot()).webhooks.length, 1);

    const parent = (await store.exportSnapshot());
    const left = createMemoryCommerceStore({ snapshot: parent });
    const right = createMemoryCommerceStore({ snapshot: parent });
    assert.equal((await left.webhooks.accept(actor("tenant-a"), { tenantId: "tenant-a", connectionId: payment.value.connectionId, eventId: "wh-2", eventType: "payment.paid" })).ok, true);
    assert.equal((await right.webhooks.accept(actor("tenant-a"), { tenantId: "tenant-a", connectionId: payment.value.connectionId, eventId: "wh-2", eventType: "payment.paid" })).ok, true);
    const settled = settleConcurrent(parent, (await left.exportSnapshot()), (await right.exportSnapshot()));
    assert.equal(settled.conflicts.some((item) => item.code === "DUPLICATE"), true);
    assert.equal(settled.snapshot.webhooks.filter((row) => row.eventId === "wh-2").length, 1);

    const rolled = await store.runAtomic(async (draftStore) => {
      const appended = await draftStore.events.append(actor("tenant-a"), {
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
    assert.equal((await store.exportSnapshot()).events.some((row) => row.eventId === "evt-rollback"), false);
  });

  it("expires only a provider-owned hold and leaves native expiry unset", async () => {
    const providerStore = await ready();
    assert.equal((await providerStore.bookings.openReservation(draft({ holdExpiresAt: PAST }))).ok, true);
    const expired = (await providerStore.bookings.expireDue(actor("tenant-a"), "tenant-a", "loc-1", NOW));
    assert.equal(expired.ok, true);
    if (!expired.ok) return;
    assert.equal(expired.value.expired, 1);

    const nativeStore = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    await verified(nativeStore, "tenant-a");
    (await connect(nativeStore, "tenant-a", "book-1", "loc-1", "BOOKING", { holdExpiryOwner: "NATIVE_POLICY" }));
    assert.equal((await nativeStore.bookings.openReservation(draft({ holdExpiresAt: null, nativeExpiryPolicyId: null }))).ok, true);
    const unset = (await nativeStore.bookings.expireDue(actor("tenant-a"), "tenant-a", "loc-1", LATER));
    assert.equal(unset.ok, true);
    if (!unset.ok) return;
    assert.equal(unset.value.expired, 0);
    assert.equal(unset.value.leftUnset, 1);
    const booking = (await nativeStore.bookings.read(actor("tenant-a"), "tenant-a", "BK-1"));
    assert.equal(booking.ok, true);
    if (!booking.ok) return;
    assert.equal(booking.value.state, "HELD");
  });

  it("moves a booking slot only when the new slot is free", async () => {
    const store = await ready();
    const first = (await store.bookings.openReservation(draft()));
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal((await store.bookings.openReservation(draft({
      bookingRef: "BK-2",
      transactionRef: "TX-2",
      idempotencyKey: "reserve-2",
      requestHash: "hash-2",
      offeringId: "offer-2",
      providerReference: "ext-book-2",
    }))).ok, true);
    const requested = (await store.bookings.requestReschedule(actor("tenant-a"), {
      tenantId: "tenant-a",
      bookingRef: "BK-1",
      expectedVersion: first.value.booking.version,
      nextSlotKey: "tenant-a:loc-1:offer-2:2026-10-27T09:00:00.000Z",
    }));
    assert.equal(requested.ok, true);
    if (!requested.ok) return;
    assert.equal(requested.value.slotKey, first.value.booking.slotKey);
    const conflict = (await store.bookings.commitReschedule(actor("tenant-a"), {
      tenantId: "tenant-a",
      bookingRef: "BK-1",
      expectedVersion: requested.value.version,
    }));
    assert.equal(conflict.ok, false);
    if (conflict.ok) return;
    assert.equal(conflict.code, "SLOT_CONFLICT");
    const stayed = (await store.bookings.read(actor("tenant-a"), "tenant-a", "BK-1"));
    assert.equal(stayed.ok, true);
    if (!stayed.ok) return;
    assert.equal(stayed.value.slotKey, first.value.booking.slotKey);
  });

  it("stores click identifiers apart from aggregate counts and can erase them", async () => {
    const store = await ready();
    assert.equal((await store.bookings.openReservation(draft())).ok, true);
    const linked = (await store.attribution.saveTouchpoint(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      intentRef: "intent-1",
      bookingRef: "BK-1",
      attemptRef: null,
      gscClicks: 12,
    }));
    assert.equal(linked.ok, false);
    if (linked.ok) return;
    assert.equal(linked.code, "INVALID");
    const touch = (await store.attribution.saveTouchpoint(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      intentRef: "intent-1",
      bookingRef: "BK-1",
      attemptRef: null,
      ctwaClid: "ctwa-1",
    }));
    assert.equal(touch.ok, true);
    if (!touch.ok) return;
    assert.equal(touch.value.userLevel, true);
    const aggregate = (await store.attribution.saveAggregate(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      channel: "GOOGLE_SEARCH",
      count: 12,
    }));
    assert.equal(aggregate.ok, true);
    const level = (await store.attribution.readClass(actor("tenant-a"), "tenant-a", "TX-1"));
    assert.equal(level.ok, true);
    if (!level.ok) return;
    assert.equal(level.value.countsAsRevenue, false);
    assert.notEqual(level.value.level, "A");
    const erased = (await store.attribution.eraseIdentifiers(actor("tenant-a"), "tenant-a", touch.value.touchpointId, "customer request", LATER));
    assert.equal(erased.ok, true);
    if (!erased.ok) return;
    assert.equal(erased.value.ctwaClid, null);
    assert.equal((await store.bookings.read(actor("tenant-a"), "tenant-a", "BK-1")).ok, true);
    const intent = (await store.intents.save(actor("tenant-a"), {
      intentRef: "intent-1",
      tenantId: "tenant-a",
      locationId: "loc-1",
      experience: "WHATSAPP_CATALOG",
      intentType: "PRODUCT_ORDER",
      qualified: false,
      customerRef: null,
      commerceOrderRef: "CO-pointer",
    }));
    assert.equal(intent.ok, true);
    if (!intent.ok) return;
    assert.equal(intent.value.commerceOrderRef, "CO-pointer");
  });

  it("stores credential references and rejects secret bytes", async () => {
    const store = await ready();
    const connection = (await store.connections.resolve(actor("tenant-a"), "tenant-a", "loc-1", "book-1", "BOOKING"));
    assert.equal(connection.ok, true);
    if (!connection.ok) return;
    const leaked = (await store.connections.registerCredential(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: connection.value.connectionId,
      purpose: "WEBHOOK",
      credentialRef: "cred_webhook_1",
      plaintext: "super-secret-value",
    }));
    assert.equal(leaked.ok, false);
    if (leaked.ok) return;
    assert.equal(leaked.code, "SECRET_REJECTED");
    assert.equal(JSON.stringify((await store.exportSnapshot())).includes("super-secret-value"), false);
    const saved = (await store.connections.registerCredential(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: connection.value.connectionId,
      purpose: "WEBHOOK",
      credentialRef: "cred_webhook_1",
    }));
    assert.equal(saved.ok, true);
    const rotated = (await store.connections.rotateCredential(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: connection.value.connectionId,
      purpose: "WEBHOOK",
      credentialRef: "cred_webhook_2",
    }));
    assert.equal(rotated.ok, true);
    if (!rotated.ok) return;
    assert.equal(rotated.value.keyVersion, 2);
    assert.equal(rotated.value.status, "ACTIVE");
    const revoked = (await store.connections.revokeCredential(actor("tenant-a"), "tenant-a", "cred_webhook_2", LATER));
    assert.equal(revoked.ok, true);
    const blocked = (await store.bookings.openReservation(draft({ idempotencyKey: "reserve-9", requestHash: "hash-9", bookingRef: "BK-9", transactionRef: "TX-9", offeringId: "offer-9", providerReference: "ext-9" })));
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.code, "UNUSABLE_CONNECTION");
  });

  it("prefers an outlet connection and does not fall through an unreachable outlet", async () => {
    const store = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    await verified(store, "tenant-a");
    (await connect(store, "tenant-a", "book-1", null, "BOOKING"));
    const outlet = (await connect(store, "tenant-a", "book-1", "loc-1", "BOOKING"));
    assert.equal(outlet.ok, true);
    if (!outlet.ok) return;
    const resolved = (await store.connections.resolve(actor("tenant-a"), "tenant-a", "loc-1", "book-1", "BOOKING"));
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.value.connectionId, outlet.value.connectionId);
    const seenVersion = outlet.value.version;
    const health = (await store.connections.reportHealth(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: outlet.value.connectionId,
      expectedVersion: seenVersion,
      health: "UNREACHABLE",
      at: NOW,
    }));
    assert.equal(health.ok, true);
    const stale = (await store.connections.reportHealth(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: outlet.value.connectionId,
      expectedVersion: seenVersion,
      health: "HEALTHY",
      at: LATER,
    }));
    assert.equal(stale.ok, false);
    if (stale.ok) return;
    assert.equal(stale.code, "VERSION_CONFLICT");
    const reserved = (await store.bookings.openReservation(draft()));
    assert.equal(reserved.ok, false);
    if (reserved.ok) return;
    assert.equal(reserved.code, "UNUSABLE_CONNECTION");
    assert.equal((await store.exportSnapshot()).bookings.length, 0);
  });

  it("rejects a stale external slot and a reused booking reference", async () => {
    const store = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    await verified(store, "tenant-a");
    const registered = (await store.connections.register(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      providerId: "book-1",
      kind: "BOOKING",
      mode: "EXTERNAL_API",
      capabilities: capabilities("book-1"),
    }));
    assert.equal(registered.ok, true);
    const stale = (await store.bookings.openReservation(draft({
      providerMode: "EXTERNAL_API",
      availabilityFreshUntil: PAST,
      providerReference: "ext-book-1",
    })));
    assert.equal(stale.ok, false);
    if (stale.ok) return;
    assert.equal(stale.code, "RECONCILIATION_REQUIRED");
    const fresh = (await store.bookings.openReservation(draft({
      providerMode: "EXTERNAL_API",
      availabilityFreshUntil: LATER,
      providerReference: "ext-book-1",
    })));
    assert.equal(fresh.ok, true);
    const reused = (await store.bookings.openReservation(draft({
      providerMode: "EXTERNAL_API",
      availabilityFreshUntil: LATER,
      bookingRef: "BK-2",
      transactionRef: "TX-2",
      idempotencyKey: "reserve-2",
      requestHash: "hash-2",
      offeringId: "offer-2",
      providerReference: "ext-book-1",
    })));
    assert.equal(reused.ok, false);
    if (reused.ok) return;
    assert.equal(reused.code, "REFERENCE_CONFLICT");
  });

  it("returns copies so a read-only caller cannot change stored booking, payment, or connection state", async () => {
    const store = await ready();
    const opened = (await store.bookings.openReservation(draft()));
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const storedVersion = opened.value.booking.version;
    opened.value.booking.state = "CANCELLED";
    opened.value.booking.version = 99;
    opened.value.transaction.state = "CLOSED";
    const reader = actor("tenant-a", null, ["read"]);
    const read = (await store.bookings.read(reader, "tenant-a", "BK-1"));
    assert.equal(read.ok, true);
    if (!read.ok) return;
    assert.equal(read.value.state, "HELD");
    assert.equal(read.value.version, storedVersion);
    read.value.state = "CANCELLED";
    read.value.providerReference = "mutated-by-reader";
    read.value.version = 99;
    const listed = (await store.bookings.list(reader, "tenant-a", "loc-1"));
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    const first = listed.value[0];
    assert.ok(first);
    first.state = "EXPIRED";
    listed.value.length = 0;
    const again = (await store.bookings.read(reader, "tenant-a", "BK-1"));
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.equal(again.value.state, "HELD");
    assert.equal(again.value.providerReference, "ext-book-1");
    assert.equal(again.value.version, storedVersion);
    assert.equal((await store.exportSnapshot()).bookings.length, 1);

    const payment = (await connect(store, "tenant-a", "pay-1", "loc-1", "PAYMENT"));
    assert.equal(payment.ok, true);
    if (!payment.ok) return;
    assert.equal((await store.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-1",
      providerId: "pay-1",
      providerMode: "MERCHANT_PAYMENT_GATEWAY",
      expectedAmountIdr: 10000,
    })).ok, true);
    const paid = (await store.payments.applyEvent(actor("tenant-a"), trusted()));
    assert.equal(paid.ok, true);
    if (!paid.ok) return;
    paid.value.ledger.status = "FAILED";
    paid.value.ledger.amountIdr = 1;
    paid.value.netRevenueIdr = 0;
    const net = (await store.payments.net(reader, "tenant-a", "TX-1"));
    assert.equal(net.ok, true);
    if (!net.ok) return;
    assert.equal(net.value.status, "PAID");
    assert.equal(net.value.netRevenueIdr, 10000);

    const resolved = (await store.connections.resolve(reader, "tenant-a", "loc-1", "book-1", "BOOKING"));
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    resolved.value.health = "UNREACHABLE";
    resolved.value.status = "REVOKED";
    resolved.value.capabilities.supportsHold = false;
    const fresh = (await store.connections.resolve(reader, "tenant-a", "loc-1", "book-1", "BOOKING"));
    assert.equal(fresh.ok, true);
    if (!fresh.ok) return;
    assert.equal(fresh.value.health, "UNKNOWN");
    assert.equal(fresh.value.status, "ACTIVE");
    assert.equal(fresh.value.capabilities.supportsHold, true);

    const blocked = (await store.bookings.transition(reader, {
      tenantId: "tenant-a",
      bookingRef: "BK-1",
      expectedVersion: storedVersion,
      to: "CANCELLED",
      nowIso: NOW,
    }));
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.code, "FORBIDDEN");
    const moved = (await store.bookings.transition(actor("tenant-a"), {
      tenantId: "tenant-a",
      bookingRef: "BK-1",
      expectedVersion: storedVersion,
      to: "CANCELLED",
      nowIso: NOW,
    }));
    assert.equal(moved.ok, true);
    const after = (await store.bookings.read(reader, "tenant-a", "BK-1"));
    assert.equal(after.ok, true);
    if (!after.ok) return;
    assert.equal(after.value.state, "CANCELLED");
    assert.equal(after.value.version, storedVersion + 1);
  });

  it("rejects a reservation mode that disagrees with the registered connection", async () => {
    const native = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    await verified(native, "tenant-a");
    (await connect(native, "tenant-a", "book-1", "loc-1", "BOOKING"));
    const mismatch = (await native.bookings.openReservation(draft({ providerMode: "EXTERNAL_API" })));
    assert.equal(mismatch.ok, false);
    if (mismatch.ok) return;
    assert.equal(mismatch.code, "SCOPE_MISMATCH");
    assert.equal((await native.exportSnapshot()).bookings.length, 0);

    const checkout = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    await verified(checkout, "tenant-a");
    const checkoutConnection = (await checkout.connections.register(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      providerId: "book-1",
      kind: "BOOKING",
      mode: "EXTERNAL_CHECKOUT",
      capabilities: capabilities("book-1", { issuesAuthoritativeReference: false, supportsHold: false, holdExpiryOwner: "NONE" }),
    }));
    assert.equal(checkoutConnection.ok, true);
    const direct = (await checkout.bookings.openReservation(draft({
      providerMode: "EXTERNAL_CHECKOUT",
      referenceAuthoritative: true,
      providerReference: "checkout-ref",
    })));
    assert.equal(direct.ok, false);
    if (direct.ok) return;
    assert.equal(direct.code, "INVALID");
    assert.equal((await checkout.exportSnapshot()).bookings.length, 0);
    const held = (await checkout.connections.register(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-2",
      providerId: "book-hold",
      kind: "BOOKING",
      mode: "EXTERNAL_CHECKOUT",
      capabilities: capabilities("book-hold", { supportsHold: true, issuesAuthoritativeReference: false, holdExpiryOwner: "NONE" }),
    }));
    assert.equal(held.ok, false);
    if (held.ok) return;
    assert.equal(held.code, "INVALID");

    const manual = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    await verified(manual, "tenant-a");
    assert.equal((await manual.connections.register(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      providerId: "book-1",
      kind: "BOOKING",
      mode: "MANUAL",
      capabilities: capabilities("book-1", { issuesAuthoritativeReference: false, supportsHold: false, holdExpiryOwner: "NONE" }),
    })).ok, true);
    const invented = (await manual.bookings.openReservation(draft({
      providerMode: "MANUAL",
      referenceAuthoritative: true,
      providerReference: "staff-made-this",
    })));
    assert.equal(invented.ok, false);
    if (invented.ok) return;
    assert.equal(invented.code, "INVALID");
    const referenceOnly = (await manual.bookings.openReservation(draft({
      providerMode: "MANUAL",
      referenceAuthoritative: false,
      providerReference: "staff-made-this",
    })));
    assert.equal(referenceOnly.ok, false);
    if (referenceOnly.ok) return;
    assert.equal(referenceOnly.code, "INVALID");
    const requested = (await manual.bookings.openReservation(draft({
      providerMode: "MANUAL",
      referenceAuthoritative: false,
      providerReference: null,
    })));
    assert.equal(requested.ok, true);
    if (!requested.ok) return;
    assert.equal(requested.value.booking.state, "REQUESTED");
    assert.equal(requested.value.booking.referenceAuthoritative, false);
    assert.equal(requested.value.booking.providerReference, null);

    const weak = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    await verified(weak, "tenant-a");
    (await connect(weak, "tenant-a", "book-1", "loc-1", "BOOKING", { issuesAuthoritativeReference: false }));
    const forged = (await weak.bookings.openReservation(draft({ referenceAuthoritative: true, providerReference: "forged-ref" })));
    assert.equal(forged.ok, false);
    if (forged.ok) return;
    assert.equal(forged.code, "INVALID");
    const forgedReference = (await weak.bookings.openReservation(draft({ referenceAuthoritative: false, providerReference: "forged-ref" })));
    assert.equal(forgedReference.ok, false);
    if (forgedReference.ok) return;
    assert.equal(forgedReference.code, "INVALID");
    assert.equal((await weak.exportSnapshot()).bookings.length, 0);

    const mixed = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    const paymentMode = (await mixed.connections.register(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      providerId: "book-1",
      kind: "BOOKING",
      mode: "MERCHANT_PAYMENT_GATEWAY",
      capabilities: capabilities("book-1"),
    }));
    assert.equal(paymentMode.ok, false);
    if (paymentMode.ok) return;
    assert.equal(paymentMode.code, "INVALID");

    const pay = await ready();
    assert.equal((await pay.bookings.openReservation(draft())).ok, true);
    (await connect(pay, "tenant-a", "pay-1", "loc-1", "PAYMENT"));
    const wrongAttempt = (await pay.payments.openAttempt(actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "TX-1",
      attemptRef: "attempt-1",
      providerId: "pay-1",
      providerMode: "EXTERNAL_BOOKING_PROVIDER",
      expectedAmountIdr: 10000,
    }));
    assert.equal(wrongAttempt.ok, false);
    if (wrongAttempt.ok) return;
    assert.equal(wrongAttempt.code, "SCOPE_MISMATCH");
    assert.equal((await pay.exportSnapshot()).attempts.length, 0);
  });

  it("keeps policy evidence inside one merchant, offering, and commerce surface", async () => {
    const store = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    (await connect(store, "tenant-a", "book-1", "loc-1", "BOOKING"));
    await verified(store, "tenant-a");
    const ticket = (await store.bookings.openReservation(draft({ category: "ADMISSION_TICKET" })));
    assert.equal(ticket.ok, false);
    if (ticket.ok) return;
    assert.equal(ticket.code, "POLICY_DENIED");
    const flow = (await store.bookings.openReservation(draft({ experience: "WHATSAPP_FLOW" })));
    assert.equal(flow.ok, false);
    if (flow.ok) return;
    assert.equal(flow.code, "POLICY_DENIED");
    const unknownMerchant = (await store.bookings.openReservation(draft({ merchantEligibility: "UNKNOWN" })));
    assert.equal(unknownMerchant.ok, false);
    if (unknownMerchant.ok) return;
    assert.equal(unknownMerchant.code, "POLICY_DENIED");
    assert.equal((await store.exportSnapshot()).bookings.length, 0);

    const reused = (await store.policy.submit(actor("tenant-a"), "tenant-a", { offeringCategory: "ADMISSION_TICKET", experience: "WHATSAPP_CATALOG" }, {
      kind: "AUTHORIZED_PROCESS",
      processId: "policy-job",
      reference: "policy-record-1",
      outcome: "VERIFIED",
      attestation: signPolicyAttestation(POLICY_KEY, {
        tenantId: "tenant-a",
        offeringCategory: "GENERAL_GOODS",
        experience: "WHATSAPP_CATALOG",
        processId: "policy-job",
        reference: "policy-record-1",
        outcome: "VERIFIED",
      }),
    }));
    assert.equal(reused.ok, false);
    if (reused.ok) return;
    assert.equal(reused.code, "POLICY_DENIED");
    const caller = (await store.policy.submit(actor("tenant-a"), "tenant-a", { offeringCategory: "ADMISSION_TICKET", experience: "WHATSAPP_CATALOG" }, {
      kind: "CALLER_ENUM",
      status: "VERIFIED",
      reference: "ticket-caller",
    }));
    assert.equal(caller.ok, true);
    if (!caller.ok) return;
    assert.equal(caller.value.status, "UNVERIFIED");
    assert.equal(caller.value.validatedBy, null);
    const goods = (await store.policy.read(actor("tenant-a"), "tenant-a", GOODS_CATALOG));
    assert.equal(goods.ok, true);
    if (!goods.ok) return;
    assert.equal(goods.value.status, "VERIFIED");
    assert.equal(goods.value.offeringCategory, "GENERAL_GOODS");
    const stillTicket = (await store.bookings.openReservation(draft({
      category: "ADMISSION_TICKET",
      bookingRef: "BK-TICKET",
      transactionRef: "TX-TICKET",
      idempotencyKey: "reserve-ticket",
      requestHash: "hash-ticket",
      providerReference: "ext-ticket",
    })));
    assert.equal(stillTicket.ok, false);
    if (stillTicket.ok) return;
    assert.equal(stillTicket.code, "POLICY_DENIED");
    const allowed = (await store.bookings.openReservation(draft()));
    assert.equal(allowed.ok, true);
    assert.equal((await store.exportSnapshot()).policyEvidence.some((row) => row.tenantId.toLowerCase().includes("yola")), false);
    const yola = (await store.bookings.openReservation(draft({
      actor: actor("yola-fun"),
      tenantId: "yola-fun",
      merchantEligibility: "UNKNOWN",
      bookingRef: "BK-YOLA",
      transactionRef: "TX-YOLA",
      idempotencyKey: "reserve-yola",
      requestHash: "hash-yola",
      providerReference: "ext-yola",
    })));
    assert.equal(yola.ok, false);
    if (yola.ok) return;
    assert.equal(yola.code, "POLICY_DENIED");
    assert.equal((await store.exportSnapshot()).bookings.some((row) => row.tenantId === "yola-fun"), false);
  });

  it("dedupes webhook events per connection and does not let one tenant suppress another", async () => {
    const store = createMemoryCommerceStore({ policyValidatorKey: POLICY_KEY });
    const left = (await connect(store, "tenant-a", "vendor-1", "loc-a", "PAYMENT"));
    const right = (await connect(store, "tenant-b", "vendor-1", "loc-b", "PAYMENT"));
    assert.equal(left.ok, true);
    assert.equal(right.ok, true);
    if (!left.ok || !right.ok) return;
    const first = (await store.webhooks.accept(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: left.value.connectionId,
      eventId: "evt-shared",
      eventType: "payment.paid",
    }));
    const other = (await store.webhooks.accept(actor("tenant-b"), {
      tenantId: "tenant-b",
      connectionId: right.value.connectionId,
      eventId: "evt-shared",
      eventType: "payment.paid",
    }));
    const replay = (await store.webhooks.accept(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: left.value.connectionId,
      eventId: "evt-shared",
      eventType: "payment.paid",
    }));
    assert.equal(first.ok, true);
    assert.equal(other.ok, true);
    assert.equal(replay.ok, true);
    if (!first.ok || !other.ok || !replay.ok) return;
    assert.equal(replay.replay, true);
    assert.notEqual(first.value.dedupeKey, other.value.dedupeKey);
    assert.equal(first.value.dedupeKey, `${left.value.connectionId}:evt-shared`);
    assert.equal(other.value.dedupeKey, `${right.value.connectionId}:evt-shared`);
    const crossed = (await store.webhooks.accept(actor("tenant-a"), {
      tenantId: "tenant-a",
      connectionId: right.value.connectionId,
      eventId: "evt-other",
      eventType: "payment.paid",
    }));
    assert.equal(crossed.ok, false);
    if (crossed.ok) return;
    assert.equal(crossed.code, "CROSS_TENANT");
    const snapshot = (await store.exportSnapshot());
    assert.equal(snapshot.webhooks.length, 2);
    assert.equal(new Set(snapshot.webhooks.map((row) => row.dedupeKey)).size, 2);
  });

  it("keeps both reservations when concurrent creates use different slots", async () => {
    const store = await ready();
    const parent = (await store.exportSnapshot());
    const left = createMemoryCommerceStore({ snapshot: parent, policyValidatorKey: POLICY_KEY });
    const right = createMemoryCommerceStore({ snapshot: parent, policyValidatorKey: POLICY_KEY });
    assert.equal((await left.bookings.openReservation(draft({
      bookingRef: "BK-A",
      transactionRef: "TX-A",
      idempotencyKey: "reserve-a",
      requestHash: "hash-a",
      offeringId: "offer-a",
      providerReference: "ext-a",
    }))).ok, true);
    assert.equal((await left.events.append(actor("tenant-a"), {
      eventId: "evt-a",
      tenantId: "tenant-a",
      transactionRef: "TX-A",
      type: "reserved",
      at: NOW,
      payload: { slot: "a" },
    })).ok, true);
    assert.equal((await right.bookings.openReservation(draft({
      bookingRef: "BK-B",
      transactionRef: "TX-B",
      idempotencyKey: "reserve-b",
      requestHash: "hash-b",
      offeringId: "offer-b",
      startsAt: "2026-10-28T09:00:00.000Z",
      providerReference: "ext-b",
    }))).ok, true);
    assert.equal((await right.events.append(actor("tenant-a"), {
      eventId: "evt-b",
      tenantId: "tenant-a",
      transactionRef: "TX-B",
      type: "reserved",
      at: NOW,
      payload: { slot: "b" },
    })).ok, true);
    const settled = settleConcurrent(parent, (await left.exportSnapshot()), (await right.exportSnapshot()));
    assert.equal(settled.conflicts.length, 0);
    assert.equal(settled.snapshot.bookings.length, 2);
    for (const ref of ["A", "B"] as const) {
      const booking = settled.snapshot.bookings.find((row) => row.bookingRef === `BK-${ref}`);
      assert.ok(booking);
      assert.equal(booking.transactionRef, `TX-${ref}`);
      assert.equal(settled.snapshot.transactions.some((row) => row.transactionRef === `TX-${ref}` && row.bookingRef === `BK-${ref}`), true);
      assert.equal(settled.snapshot.idempotency.some((row) => row.idempotencyKey === `reserve-${ref.toLowerCase()}` && row.transactionRef === `TX-${ref}`), true);
      assert.equal(settled.snapshot.events.some((row) => row.eventId === `evt-${ref.toLowerCase()}` && row.transactionRef === `TX-${ref}`), true);
    }
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
