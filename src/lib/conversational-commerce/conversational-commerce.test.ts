import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { sameTenant } from "@/lib/commerce/access";
import { ORDER_STATUS_PENDING_PAYMENT, PAYMENT_STATUS_NOT_INITIATED } from "@/lib/commerce/order-capture";
import { parseProductInput } from "@/lib/commerce/validate";
import { classifyOutcome, estimateCountsAsRevenue, buildTouchpoint } from "./attribution";
import { authorize } from "./auth";
import { transitionBooking } from "./booking-state";
import { catalogOrderConfirmsBooking, mapCommercePaymentStatus } from "./compatibility";
import { normalizeCustomerExperience } from "./experience";
import { phoneCorrelation } from "./ids";
import { createMemoryCommerceStore, settleConcurrent, signPolicyAttestation } from "./memory-store";
import { createMockProvider, type MockProvider } from "./mock-provider";
import {
  ORCHESTRATOR_POLICY_KEY,
  acceptWebhook,
  cancelReservation,
  createOrchestratorState,
  markWebhookApplied,
  seedOrchestratorPolicyFixture,
  openPaymentAttempt,
  readBooking,
  recordPayment,
  recordTouchpoint,
  reconcileTimedOut,
  releaseTimedOut,
  reserve,
  type ReserveCommand,
} from "./orchestrator";
import { aggregateAttemptLedgers, applyPaymentNotice, emptyLedger, signPaymentProof, verifyPaymentNotice, type RawPaymentNotice, type VerifiedPaymentEvent } from "./payment";
import { providerError } from "./provider";
import { evaluateEligibility } from "./policy";
import { createRegistry, type ProviderRegistry } from "./registry";
import { transitionTransaction } from "./transaction-state";
import { assessWebhook, planBookingEvent, signWebhook } from "./webhook";

const NOW = "2026-10-25T10:00:00.000Z";
const SECRET = "test-provider-secret";
const PAY_SECRET = "test-payment-connection";
const PAY_PROVIDER = "pay-provider";
const VERIFIED_APPROVAL = {
  source: "META_COMMERCE_POLICY" as const,
  status: "VERIFIED" as const,
  reference: "policy-record-1",
};

function actor(tenantId: string, locationIds: readonly string[] | null = null) {
  return { tenantId, locationIds };
}

function command(overrides: Partial<ReserveCommand> = {}): ReserveCommand {
  return {
    actor: actor("tenant-a"),
    tenantId: "tenant-a",
    locationId: "loc-1",
    providerId: "provider-a",
    offeringId: "offer-1",
    startsAt: "2026-11-01T09:00:00.000Z",
    idempotencyKey: "reserve-1",
    experience: "WHATSAPP_CATALOG",
    category: "GENERAL_GOODS",
    merchantEligibility: "ELIGIBLE",
    approvalEvidence: VERIFIED_APPROVAL,
    merchantConfirmed: false,
    ...overrides,
  };
}

function wire(provider: MockProvider, mode: "NATIVE" | "EXTERNAL_API" | "EXTERNAL_CHECKOUT" | "MANUAL" = "NATIVE") {
  const registry = createRegistry();
  registry.register({
    tenantId: "tenant-a",
    locationId: null,
    providerId: "provider-a",
    mode,
    provider,
  });
  const persistence = createMemoryCommerceStore({ policyValidatorKey: ORCHESTRATOR_POLICY_KEY });
  seedOrchestratorPolicyFixture(persistence);
  return { registry, state: createOrchestratorState({ persistence }) };
}

function verifiedEvent(overrides: Partial<VerifiedPaymentEvent> = {}): VerifiedPaymentEvent {
  return {
    eventId: "pay-1",
    type: "payment.paid",
    amountIdr: 10000,
    currency: "IDR",
    occurredAt: NOW,
    providerReference: "pay-ref-1",
    sequence: 1,
    tenantId: "tenant-a",
    providerId: PAY_PROVIDER,
    attemptRef: "attempt-1",
    transactionRef: "CTX-TEST",
    ...overrides,
  };
}

function rawNotice(event: VerifiedPaymentEvent, evidence: RawPaymentNotice["evidence"] = "VERIFIED_PROVIDER_EVENT"): RawPaymentNotice {
  return { ...event, evidence };
}

function proofFor(notice: RawPaymentNotice, secret = PAY_SECRET) {
  const fields = {
    tenantId: notice.tenantId,
    providerId: notice.providerId,
    attemptRef: notice.attemptRef,
    transactionRef: notice.transactionRef,
    providerReference: notice.providerReference ?? "",
    currency: "IDR" as const,
    amountIdr: notice.amountIdr,
    eventId: notice.eventId,
    type: notice.type,
    occurredAt: notice.occurredAt,
    sequence: notice.sequence,
  };
  return { ...fields, signature: signPaymentProof(secret, fields) };
}

async function payVerified(
  state: ReturnType<typeof createOrchestratorState>,
  transactionRef: string,
  overrides: Partial<VerifiedPaymentEvent> = {},
) {
  const event = verifiedEvent({ transactionRef, ...overrides });
  (await openPaymentAttempt(state, actor("tenant-a"), {
    transactionRef,
    attemptRef: event.attemptRef,
    providerId: PAY_PROVIDER,
    expectedAmountIdr: 10000,
  }));
  const notice = rawNotice(event);
  return (await recordPayment(
    state,
    actor("tenant-a"),
    {
      transactionRef,
      notice,
      proof: proofFor(notice),
      connection: { tenantId: "tenant-a", providerId: PAY_PROVIDER, secret: PAY_SECRET },
    },
    NOW,
  ));
}

describe("booking and transaction transitions", () => {
  it("allows a hold only when the provider can reserve", () => {
    assert.equal(transitionBooking("REQUESTED", "HELD", { supportsHold: true }).ok, true);
    assert.equal(transitionBooking("HELD", "CONFIRMED", { supportsHold: true }).ok, true);
    assert.equal(transitionBooking("CONFIRMED", "COMPLETED", { supportsHold: false }).ok, true);
    assert.equal(transitionBooking("CONFIRMED", "CANCELLED", { supportsHold: false }).ok, true);
    assert.equal(transitionBooking("CONFIRMED", "NO_SHOW", { supportsHold: false }).ok, true);
  });

  it("rejects invalid and terminal booking moves", () => {
    const back = transitionBooking("CONFIRMED", "REQUESTED", { supportsHold: true });
    const done = transitionBooking("COMPLETED", "CONFIRMED", { supportsHold: true });
    const skip = transitionBooking("REQUESTED", "NO_SHOW", { supportsHold: true });
    const cancelled = transitionBooking("CANCELLED", "CONFIRMED", { supportsHold: true });
    assert.equal(back.ok, false);
    assert.equal(done.ok, false);
    assert.equal(skip.ok, false);
    assert.equal(cancelled.ok, false);
    if (back.ok || done.ok || skip.ok || cancelled.ok) return;
    assert.equal(done.code, "TERMINAL");
    assert.equal(skip.code, "INVALID_TRANSITION");
    assert.equal(cancelled.code, "TERMINAL");
  });

  it("rejects a hold when the provider cannot reserve", () => {
    const move = transitionBooking("REQUESTED", "HELD", { supportsHold: false });
    assert.equal(move.ok, false);
    if (move.ok) return;
    assert.equal(move.code, "HOLD_UNSUPPORTED");
  });

  it("rejects invalid transaction moves", () => {
    assert.equal(transitionTransaction("OPEN", "COMMITTED").ok, true);
    assert.equal(transitionTransaction("PENDING_RESOLUTION", "IN_PROGRESS").ok, true);
    const closed = transitionTransaction("CLOSED", "OPEN");
    const failed = transitionTransaction("FAILED", "COMMITTED");
    const committed = transitionTransaction("COMMITTED", "OPEN");
    assert.equal(closed.ok, false);
    assert.equal(failed.ok, false);
    assert.equal(committed.ok, false);
    if (closed.ok || failed.ok || committed.ok) return;
    assert.equal(closed.code, "TERMINAL");
    assert.equal(failed.code, "TERMINAL");
    assert.equal(committed.code, "INVALID_TRANSITION");
  });
});

describe("tenant and location isolation", () => {
  it("blocks another tenant before a provider is called", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE" });
    const { registry, state } = wire(provider);
    const created = await reserve(command(), { registry, state, now: NOW });
    assert.equal(created.ok, true);
    const spoof = await reserve(command({ actor: actor("tenant-b"), idempotencyKey: "spoof" }), {
      registry,
      state,
      now: NOW,
    });
    assert.equal(spoof.ok, false);
    assert.equal(spoof.code, "CROSS_TENANT");
    assert.equal(spoof.booking, null);
    const otherTenant = await reserve(
      command({ actor: actor("tenant-b"), tenantId: "tenant-b", idempotencyKey: "other-tenant" }),
      { registry, state, now: NOW },
    );
    assert.equal(otherTenant.code, "NOT_FOUND");
    assert.equal(otherTenant.booking, null);
    assert.equal(provider.calls.length, 1);

    const bookingRef = created.booking?.bookingRef ?? "";
    const peeked = (await readBooking(state, actor("tenant-b"), bookingRef));
    assert.equal(peeked.ok, false);
    if (peeked.ok) return;
    assert.equal(peeked.code, "CROSS_TENANT");
    assert.equal(JSON.stringify(peeked).includes("PRV-"), false);

    const reader = { tenantId: "tenant-a", locationIds: null, permissions: ["read"] as const };
    const writer = { tenantId: "tenant-a", locationIds: null, permissions: ["write"] as const };
    const callsBefore = provider.calls.length;
    const deniedWrite = await reserve(command({ actor: reader, idempotencyKey: "reader-1" }), { registry, state, now: NOW });
    assert.equal(deniedWrite.code, "FORBIDDEN");
    assert.equal(provider.calls.length, callsBefore);
    const deniedRead = (await readBooking(state, writer, bookingRef));
    assert.equal(deniedRead.ok, false);
    if (deniedRead.ok) return;
    assert.equal(deniedRead.code, "FORBIDDEN");
    const allowedRead = (await readBooking(state, reader, bookingRef));
    assert.equal(allowedRead.ok, true);

    const released = (await releaseTimedOut(state, actor("tenant-b"), "reserve-1"));
    assert.equal(released.ok, false);
  });

  it("blocks an actor from another location in the same tenant", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE" });
    const { registry, state } = wire(provider);
    const result = await reserve(command({ actor: actor("tenant-a", ["loc-2"]) }), { registry, state, now: NOW });
    assert.equal(result.code, "LOCATION_FORBIDDEN");
    assert.equal(provider.calls.length, 0);
    assert.equal(authorize(actor("tenant-a", ["loc-1"]), { tenantId: "tenant-a", locationId: "loc-9" }, "read").ok, false);
  });
});

describe("mock booking provider", () => {
  it("does not reserve through a checkout provider", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_CHECKOUT",
    });
    const { registry, state } = wire(provider, "EXTERNAL_CHECKOUT");
    const result = await reserve(command(), { registry, state, now: NOW });
    assert.equal(result.code, "UNSUPPORTED");
    assert.equal(result.booking, null);
    assert.equal(provider.bookingCount(), 0);
    assert.equal(provider.calls.includes("createBooking"), false);
    assert.equal(provider.calls.includes("holdReservation"), false);
    assert.equal(provider.getCapabilities().supportsHold, false);

    const availability = await provider.getAvailability({
      tenantId: "tenant-a",
      locationId: "loc-1",
      idempotencyKey: "avail-1",
      requestHash: "hash",
      offeringId: "offer-1",
      knownSlots: [{ offeringId: "offer-1", locationId: "loc-1", startsAt: "2026-11-01T09:00:00.000Z" }],
    });
    assert.equal(availability.ok, true);
    if (!availability.ok) return;
    assert.deepEqual(availability.data.slots, []);
    assert.equal(availability.data.authoritative, false);
    assert.match(availability.data.handoffUrl ?? "", /^https:\/\/booking\.invalid\/handoff\//);
  });

  it("returns a conflict for a second hold on the same slot", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE" });
    const deps = wire(provider);
    const first = await reserve(command(), { ...deps, now: NOW });
    const second = await reserve(command({ idempotencyKey: "reserve-2" }), { ...deps, now: NOW });
    assert.equal(first.booking?.state, "HELD");
    assert.equal(second.code, "CONFLICT");
    assert.equal(second.booking, null);
    assert.equal(provider.bookingCount(), 1);
    assert.equal(deps.state.bookings.size, 1);
  });

  it("replays the same idempotency key and rejects a different payload", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE" });
    const deps = wire(provider);
    const first = await reserve(command(), { ...deps, now: NOW });
    const replay = await reserve(command(), { ...deps, now: NOW });
    assert.equal(replay.replay, true);
    assert.equal(replay.booking?.bookingRef, first.booking?.bookingRef);
    assert.equal(provider.calls.length, 1);
    assert.equal(provider.bookingCount(), 1);

    const clash = await reserve(command({ offeringId: "offer-2" }), { ...deps, now: NOW });
    assert.equal(clash.code, "IDEMPOTENCY_CONFLICT");
    assert.equal(provider.bookingCount(), 1);
    assert.equal(phoneCorrelation("+6281234567890"), true);
    const phoneKey = await reserve(command({ idempotencyKey: "+6281234567890" }), { ...deps, now: NOW });
    assert.equal(phoneKey.code, "NOT_AUTHORITATIVE");
  });

  it("does not create a reservation when the external provider times out", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_API",
      timeoutOn: ["createBooking"],
    });
    const deps = wire(provider, "EXTERNAL_API");
    const first = await reserve(command(), { ...deps, now: NOW });
    const second = await reserve(command(), { ...deps, now: NOW });
    assert.equal(first.code, "TIMEOUT");
    assert.equal(first.retryable, false);
    assert.equal(first.resolutionRequired, true);
    assert.equal(first.booking, null);
    assert.equal(first.transaction?.state, "PENDING_RESOLUTION");
    assert.equal(second.replay, true);
    assert.equal(second.transaction?.transactionRef, first.transaction?.transactionRef);
    assert.equal(provider.calls.length, 1);
    assert.equal(provider.bookingCount(), 0);

    const released = (await releaseTimedOut(deps.state, actor("tenant-a"), "reserve-1"));
    assert.equal(released.ok, false);
    if (released.ok) return;
    assert.equal(released.code, "RECONCILIATION_REQUIRED");
    const blocked = await reserve(command(), { ...deps, now: NOW });
    assert.equal(blocked.replay, true);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);

    const reconciled = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-1", providerId: "provider-a", idempotencyKey: "reserve-1" },
      { ...deps, now: NOW },
    );
    assert.equal(reconciled.resolutionRequired, true);
    assert.equal(provider.bookingCount(), 0);
    const retried = await reserve(command(), { ...deps, now: NOW });
    assert.equal(retried.code, "TIMEOUT");
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 2);
    assert.equal(provider.bookingCount(), 0);
    assert.equal(deps.state.bookings.size, 0);
  });

  it("does not create a second reservation when the first timed out after commit", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_API",
      ambiguousTimeout: true,
    });
    const deps = wire(provider, "EXTERNAL_API");
    const first = await reserve(command(), { ...deps, now: NOW });
    assert.equal(first.code, "TIMEOUT");
    assert.equal(first.booking, null);
    assert.equal(first.transaction?.state, "PENDING_RESOLUTION");
    assert.equal(provider.bookingCount(), 1);

    const released = (await releaseTimedOut(deps.state, actor("tenant-a"), "reserve-1"));
    assert.equal(released.ok, false);
    const second = await reserve(command(), { ...deps, now: NOW });
    assert.equal(second.replay, true);
    assert.equal(second.transaction?.transactionRef, first.transaction?.transactionRef);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
    assert.equal(provider.bookingCount(), 1);

    const recovered = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-1", providerId: "provider-a", idempotencyKey: "reserve-1" },
      { ...deps, now: NOW },
    );
    assert.equal(recovered.ok, true);
    assert.equal(recovered.booking?.state, "CONFIRMED");
    assert.equal(recovered.transaction?.transactionRef, first.transaction?.transactionRef);
    assert.equal(recovered.transaction?.state, "COMMITTED");
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
    assert.equal(provider.bookingCount(), 1);
    const again = await reserve(command(), { ...deps, now: NOW });
    assert.equal(again.replay, true);
    assert.equal(again.booking?.bookingRef, recovered.booking?.bookingRef);
    assert.equal(provider.bookingCount(), 1);
  });

  it("retries the original key only when the provider guarantees idempotency", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_API",
      ambiguousTimeout: true,
      guaranteesIdempotency: true,
    });
    const deps = wire(provider, "EXTERNAL_API");
    const first = await reserve(command({ idempotencyKey: "guaranteed-1" }), { ...deps, now: NOW });
    assert.equal(first.code, "TIMEOUT");
    assert.equal(provider.bookingCount(), 1);
    const released = (await releaseTimedOut(deps.state, actor("tenant-a"), "guaranteed-1"));
    assert.equal(released.code, "RECONCILIATION_REQUIRED");
    const recovered = await reconcileTimedOut(
      {
        actor: actor("tenant-a"),
        tenantId: "tenant-a",
        locationId: "loc-1",
        providerId: "provider-a",
        idempotencyKey: "guaranteed-1",
      },
      { ...deps, now: NOW },
    );
    assert.equal(recovered.ok, true);
    assert.equal(recovered.booking?.state, "CONFIRMED");
    assert.equal(recovered.transaction?.transactionRef, first.transaction?.transactionRef);
    assert.equal(provider.bookingCount(), 1);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 2);
  });

  it("does not retry when lookup cannot prove the provider created nothing", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_API",
      timeoutOn: ["createBooking"],
      lookup: "non-authoritative-empty",
    });
    const deps = wire(provider, "EXTERNAL_API");
    const first = await reserve(command({ idempotencyKey: "unknown-1" }), { ...deps, now: NOW });
    assert.equal(first.code, "TIMEOUT");
    const reconciled = await reconcileTimedOut(
      {
        actor: actor("tenant-a"),
        tenantId: "tenant-a",
        locationId: "loc-1",
        providerId: "provider-a",
        idempotencyKey: "unknown-1",
      },
      { ...deps, now: NOW },
    );
    assert.equal(reconciled.code, "RECONCILIATION_REQUIRED");
    const retried = await reserve(command({ idempotencyKey: "unknown-1" }), { ...deps, now: NOW });
    assert.equal(retried.replay, true);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
    assert.equal(provider.bookingCount(), 0);
  });

  it("does not retry when the provider cannot look up the original key", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_API",
      timeoutOn: ["createBooking"],
      lookup: "unsupported",
    });
    const deps = wire(provider, "EXTERNAL_API");
    await reserve(command({ idempotencyKey: "nolookup-1" }), { ...deps, now: NOW });
    const reconciled = await reconcileTimedOut(
      {
        actor: actor("tenant-a"),
        tenantId: "tenant-a",
        locationId: "loc-1",
        providerId: "provider-a",
        idempotencyKey: "nolookup-1",
      },
      { ...deps, now: NOW },
    );
    assert.equal(reconciled.code, "RECONCILIATION_REQUIRED");
    const retried = await reserve(command({ idempotencyKey: "nolookup-1" }), { ...deps, now: NOW });
    assert.equal(retried.replay, true);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
  });

  it("closes the key when lookup reports a cancelled reservation", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_API",
      ambiguousTimeout: true,
    });
    const deps = wire(provider, "EXTERNAL_API");
    await reserve(command({ idempotencyKey: "cancelled-1" }), { ...deps, now: NOW });
    provider.setState("cancelled-1", "CANCELLED");
    const recovered = await reconcileTimedOut(
      {
        actor: actor("tenant-a"),
        tenantId: "tenant-a",
        locationId: "loc-1",
        providerId: "provider-a",
        idempotencyKey: "cancelled-1",
      },
      { ...deps, now: NOW },
    );
    assert.equal(recovered.code, "TERMINAL");
    assert.equal(recovered.booking, null);
    const retried = await reserve(command({ idempotencyKey: "cancelled-1" }), { ...deps, now: NOW });
    assert.equal(retried.replay, true);
    assert.equal(retried.code, "TERMINAL");
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
    assert.equal(provider.bookingCount(), 1);
  });

  it("does not let another provider authorize a retry after a committed timeout", async () => {
    const providerA = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_API",
      ambiguousTimeout: true,
    });
    const providerB = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-b",
      mode: "EXTERNAL_API",
    });
    const deps = wire(providerA, "EXTERNAL_API");
    const registered = deps.registry.register({
      tenantId: "tenant-a",
      locationId: null,
      providerId: "provider-b",
      mode: "EXTERNAL_API",
      provider: providerB,
    });
    assert.equal(registered.ok, true);
    const first = await reserve(command({ idempotencyKey: "split-1" }), { ...deps, now: NOW });
    assert.equal(first.code, "TIMEOUT");
    assert.equal(first.transaction?.state, "PENDING_RESOLUTION");
    assert.equal(providerA.bookingCount(), 1);

    const otherProvider = await reconcileTimedOut(
      {
        actor: actor("tenant-a"),
        tenantId: "tenant-a",
        locationId: "loc-1",
        providerId: "provider-b",
        idempotencyKey: "split-1",
      },
      { ...deps, now: NOW },
    );
    assert.equal(otherProvider.code, "SCOPE_MISMATCH");
    assert.equal(otherProvider.transaction?.state, "PENDING_RESOLUTION");
    assert.equal(providerB.calls.includes("findByIdempotencyKey"), false);
    assert.equal(providerB.calls.includes("createBooking"), false);
    assert.equal(providerA.calls.filter((call) => call === "findByIdempotencyKey").length, 0);
    assert.equal(providerA.bookingCount(), 1);

    const otherLocation = await reconcileTimedOut(
      {
        actor: actor("tenant-a"),
        tenantId: "tenant-a",
        locationId: "loc-2",
        providerId: "provider-a",
        idempotencyKey: "split-1",
      },
      { ...deps, now: NOW },
    );
    assert.equal(otherLocation.code, "SCOPE_MISMATCH");
    assert.equal(providerA.calls.filter((call) => call === "findByIdempotencyKey").length, 0);

    const wrongOutlet = await reconcileTimedOut(
      {
        actor: actor("tenant-a", ["loc-2"]),
        tenantId: "tenant-a",
        locationId: "loc-1",
        providerId: "provider-a",
        idempotencyKey: "split-1",
      },
      { ...deps, now: NOW },
    );
    assert.equal(wrongOutlet.code, "LOCATION_FORBIDDEN");
    assert.equal(providerA.calls.filter((call) => call === "createBooking").length, 1);

    const retried = await reserve(command({ idempotencyKey: "split-1" }), { ...deps, now: NOW });
    assert.equal(retried.replay, true);
    assert.equal(providerA.calls.filter((call) => call === "createBooking").length, 1);
    assert.equal(providerA.bookingCount(), 1);
    assert.equal(providerB.bookingCount(), 0);
    assert.equal(deps.state.transactions.get(first.transaction?.transactionRef ?? "")?.state, "PENDING_RESOLUTION");
  });

  it("does not adopt a recovered booking from a different request", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_API",
      ambiguousTimeout: true,
      lookupSlotKey: "tenant-a:loc-9:offer-1:2026-11-01T09:00:00.000Z",
    });
    const deps = wire(provider, "EXTERNAL_API");
    const first = await reserve(command({ idempotencyKey: "foreign-slot" }), { ...deps, now: NOW });
    const recovered = await reconcileTimedOut(
      {
        actor: actor("tenant-a"),
        tenantId: "tenant-a",
        locationId: "loc-1",
        providerId: "provider-a",
        idempotencyKey: "foreign-slot",
      },
      { ...deps, now: NOW },
    );
    assert.equal(recovered.code, "RECONCILIATION_REQUIRED");
    assert.equal(recovered.booking, null);
    assert.equal(deps.state.bookings.size, 0);
    assert.equal(deps.state.transactions.get(first.transaction?.transactionRef ?? "")?.state, "PENDING_RESOLUTION");
    const retried = await reserve(command({ idempotencyKey: "foreign-slot" }), { ...deps, now: NOW });
    assert.equal(retried.replay, true);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
    assert.equal(provider.bookingCount(), 1);
  });

  it("does not confirm an external booking without a provider reference", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_API",
      omitExternalReference: true,
    });
    const deps = wire(provider, "EXTERNAL_API");
    const result = await reserve(command(), { ...deps, now: NOW });
    assert.equal(result.code, "MISSING_REFERENCE");
    assert.equal(result.booking, null);
    assert.equal(provider.bookingCount(), 0);
    assert.equal([...deps.state.bookings.values()].some((row) => row.state === "CONFIRMED"), false);
  });

  it("does not invent a slot or a price", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE" });
    const empty = await provider.getAvailability({
      tenantId: "tenant-a",
      locationId: "loc-1",
      idempotencyKey: "avail-empty",
      requestHash: "hash",
      offeringId: "offer-1",
      knownSlots: null,
    });
    assert.equal(empty.ok, true);
    if (!empty.ok) return;
    assert.deepEqual(empty.data.slots, []);
    assert.equal(empty.data.authoritative, false);

    const quote = await provider.getQuote({
      tenantId: "tenant-a",
      locationId: "loc-1",
      idempotencyKey: "quote-1",
      requestHash: "hash",
      offeringId: "offer-1",
      unitPriceIdr: null,
    });
    assert.equal(quote.ok, false);
    if (quote.ok) return;
    assert.equal(quote.code, "UNAVAILABLE");
    assert.equal(provider.bookingCount(), 0);

    const payment = await provider.getPaymentStatus({ tenantId: "tenant-a", attemptRef: "attempt-1" });
    assert.equal(payment.ok, false);
    if (payment.ok) return;
    assert.equal(payment.code, "UNSUPPORTED");
  });
});

describe("payment evidence", () => {
  it("ignores a duplicate paid webhook", () => {
    const first = applyPaymentNotice(emptyLedger(), verifiedEvent());
    const second = applyPaymentNotice(first.ledger, verifiedEvent());
    assert.equal(first.effect, "applied");
    assert.equal(first.ledger.status, "PAID");
    assert.equal(second.effect, "duplicate");
    assert.equal(second.ledger.status, "PAID");
    assert.equal(second.ledger.appliedEventIds.length, 1);
  });

  it("does not let an earlier pending notice erase a paid status", () => {
    const paid = applyPaymentNotice(emptyLedger(), verifiedEvent());
    const pending = applyPaymentNotice(
      paid.ledger,
      verifiedEvent({ eventId: "pay-pending", type: "payment.pending", sequence: 0 }),
    );
    assert.equal(pending.effect, "ignored_out_of_order");
    assert.equal(pending.ledger.status, "PAID");
    assert.equal(pending.ledger.verifiedPaid, true);
  });

  it("holds a refund that arrives before payment and applies it after the paid event", () => {
    const early = applyPaymentNotice(
      emptyLedger(),
      verifiedEvent({ eventId: "refund-1", type: "payment.refunded", sequence: 2 }),
    );
    assert.equal(early.effect, "queued_out_of_order");
    assert.equal(early.ledger.status, "NOT_STARTED");
    assert.equal(early.ledger.verifiedPaid, false);
    const settled = applyPaymentNotice(early.ledger, verifiedEvent());
    assert.equal(settled.effect, "applied");
    assert.equal(settled.ledger.status, "REFUNDED");
    assert.equal(settled.ledger.verifiedPaid, true);
    assert.equal(settled.ledger.refundedIdr, 10000);
  });

  it("keeps partial refunds cumulative after a verified paid event", () => {
    const paid = applyPaymentNotice(emptyLedger(), verifiedEvent());
    const partial = applyPaymentNotice(
      paid.ledger,
      verifiedEvent({ eventId: "partial-1", type: "payment.partially_refunded", amountIdr: 4000 }),
    );
    const repeated = applyPaymentNotice(
      partial.ledger,
      verifiedEvent({ eventId: "partial-2", type: "payment.partially_refunded", amountIdr: 4000 }),
    );
    assert.equal(partial.ledger.status, "PARTIALLY_REFUNDED");
    assert.equal(repeated.effect, "duplicate");
    assert.equal(repeated.ledger.refundedIdr, 4000);
    const full = applyPaymentNotice(
      repeated.ledger,
      verifiedEvent({ eventId: "refund-full", type: "payment.refunded", amountIdr: 10000 }),
    );
    assert.equal(full.ledger.status, "REFUNDED");
    const chargeback = applyPaymentNotice(paid.ledger, verifiedEvent({ eventId: "cb-1", type: "payment.chargeback" }));
    assert.equal(chargeback.ledger.status, "CHARGEBACK");
    assert.equal(estimateCountsAsRevenue(), false);
  });

  it("does not mark a transaction paid from an unbound or mismatched notice", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "MANUAL" });
    const deps = wire(provider, "MANUAL");
    const lead = await reserve(command(), { ...deps, now: NOW });
    const transactionRef = lead.transaction?.transactionRef ?? "";
    assert.equal(
      (await openPaymentAttempt(deps.state, actor("tenant-a"), {
        transactionRef,
        attemptRef: "attempt-1",
        providerId: PAY_PROVIDER,
        expectedAmountIdr: 10000,
      })).ok,
      true,
    );
    const event = verifiedEvent({ transactionRef });
    const connection = { tenantId: "tenant-a", providerId: PAY_PROVIDER, secret: PAY_SECRET };
    const labeled = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: rawNotice(event), proof: null, connection },
      NOW,
    ));
    assert.equal(labeled.ok, false);
    if (labeled.ok) return;
    assert.equal(labeled.code, "UNVERIFIED");
    assert.equal(deps.state.ledgers.get(transactionRef)?.status ?? "NOT_STARTED", "NOT_STARTED");

    const screenshot = verifyPaymentNotice({
      notice: rawNotice(event, "SCREENSHOT"),
      proof: proofFor(rawNotice(event, "SCREENSHOT")),
      secret: PAY_SECRET,
      expectation: {
        tenantId: "tenant-a",
        providerId: PAY_PROVIDER,
        attemptRef: "attempt-1",
        transactionRef,
        currency: "IDR",
        amountIdr: 10000,
      },
    });
    assert.equal(screenshot.ok, false);
    if (screenshot.ok) return;
    assert.equal(screenshot.code, "REJECTED_EVIDENCE");

    const wrongAmount = rawNotice(verifiedEvent({ transactionRef, amountIdr: 5000 }));
    const mismatched = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: wrongAmount, proof: proofFor(wrongAmount), connection },
      NOW,
    ));
    assert.equal(mismatched.ok, false);
    if (mismatched.ok) return;
    assert.equal(mismatched.code, "MISMATCH");

    const otherTenant = rawNotice(verifiedEvent({ transactionRef, tenantId: "tenant-b" }));
    const tenantMismatch = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: otherTenant, proof: proofFor(otherTenant), connection },
      NOW,
    ));
    assert.equal(tenantMismatch.ok, false);

    const otherProvider = rawNotice(verifiedEvent({ transactionRef, providerId: "other-gateway" }));
    const providerMismatch = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: otherProvider, proof: proofFor(otherProvider), connection },
      NOW,
    ));
    assert.equal(providerMismatch.ok, false);
    if (providerMismatch.ok) return;
    assert.equal(providerMismatch.code, "MISMATCH");

    const otherAttempt = rawNotice(verifiedEvent({ transactionRef, attemptRef: "attempt-2" }));
    const attemptMismatch = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: otherAttempt, proof: proofFor(otherAttempt), connection },
      NOW,
    ));
    assert.equal(attemptMismatch.ok, false);
    if (attemptMismatch.ok) return;
    assert.equal(attemptMismatch.code, "NO_ATTEMPT");

    const otherTransaction = rawNotice(verifiedEvent({ transactionRef: "CTX-OTHER" }));
    const identityMismatch = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: otherTransaction, proof: proofFor(otherTransaction), connection },
      NOW,
    ));
    assert.equal(identityMismatch.ok, false);
    if (identityMismatch.ok) return;
    assert.equal(identityMismatch.code, "MISMATCH");

    const notice = rawNotice(event);
    const wrongCurrencyFields = {
      tenantId: notice.tenantId,
      providerId: notice.providerId,
      attemptRef: notice.attemptRef,
      transactionRef: notice.transactionRef,
      providerReference: notice.providerReference ?? "",
      currency: "USD" as "IDR",
      amountIdr: notice.amountIdr,
      eventId: notice.eventId,
      type: notice.type,
      occurredAt: notice.occurredAt,
      sequence: notice.sequence,
    };
    const currencyMismatch = verifyPaymentNotice({
      notice,
      proof: { ...wrongCurrencyFields, signature: signPaymentProof(PAY_SECRET, wrongCurrencyFields) },
      secret: PAY_SECRET,
      expectation: {
        tenantId: "tenant-a",
        providerId: PAY_PROVIDER,
        attemptRef: "attempt-1",
        transactionRef,
        currency: "IDR",
        amountIdr: 10000,
      },
    });
    assert.equal(currencyMismatch.ok, false);
    if (currencyMismatch.ok) return;
    assert.equal(currencyMismatch.code, "MISMATCH");

    const badConnection = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      {
        transactionRef,
        notice,
        proof: proofFor(notice),
        connection: { tenantId: "tenant-a", providerId: "other-gateway", secret: PAY_SECRET },
      },
      NOW,
    ));
    assert.equal(badConnection.ok, false);
    if (badConnection.ok) return;
    assert.equal(badConnection.code, "MISMATCH");
    assert.equal(deps.state.transactions.get(transactionRef)?.paymentStatus, "NOT_STARTED");
    assert.equal(deps.state.transactions.get(transactionRef)?.verifiedPaid, false);

    const paid = (await payVerified(deps.state, transactionRef));
    assert.equal(paid.ok, true);
    const otherReference = rawNotice(verifiedEvent({ transactionRef, eventId: "pay-2", providerReference: "pay-ref-2" }));
    const referenceMismatch = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: otherReference, proof: proofFor(otherReference), connection },
      NOW,
    ));
    assert.equal(referenceMismatch.ok, false);
    if (referenceMismatch.ok) return;
    assert.equal(referenceMismatch.code, "MISMATCH");
    assert.equal(deps.state.ledgers.get(`tenant-a:attempt-1`)?.status, "PAID");
    assert.equal(deps.state.ledgers.get(`tenant-a:attempt-1`)?.providerReference, "pay-ref-1");
  });

  it("keeps an expired attempt from blocking a later paid attempt", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "MANUAL" });
    const deps = wire(provider, "MANUAL");
    const lead = await reserve(command({ idempotencyKey: "pay-expire" }), { ...deps, now: NOW });
    const transactionRef = lead.transaction?.transactionRef ?? "";
    const connection = { tenantId: "tenant-a", providerId: PAY_PROVIDER, secret: PAY_SECRET };
    assert.equal(
      (await openPaymentAttempt(deps.state, actor("tenant-a"), {
        transactionRef,
        attemptRef: "attempt-a",
        providerId: PAY_PROVIDER,
        expectedAmountIdr: 10000,
      })).ok,
      true,
    );
    const expiredNotice = rawNotice(
      verifiedEvent({
        transactionRef,
        attemptRef: "attempt-a",
        eventId: "exp-a",
        type: "payment.expired",
        providerReference: "ref-a",
      }),
    );
    const expired = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: expiredNotice, proof: proofFor(expiredNotice), connection },
      NOW,
    ));
    assert.equal(expired.ok, true);
    if (!expired.ok) return;
    assert.equal(expired.ledger.status, "EXPIRED");
    assert.equal(expired.ledger.verifiedPaid, false);

    assert.equal(
      (await openPaymentAttempt(deps.state, actor("tenant-a"), {
        transactionRef,
        attemptRef: "attempt-b",
        providerId: PAY_PROVIDER,
        expectedAmountIdr: 10000,
      })).ok,
      true,
    );
    const paidNotice = rawNotice(
      verifiedEvent({
        transactionRef,
        attemptRef: "attempt-b",
        eventId: "pay-b",
        providerReference: "ref-b",
      }),
    );
    const paid = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: paidNotice, proof: proofFor(paidNotice), connection },
      NOW,
    ));
    assert.equal(paid.ok, true);
    if (!paid.ok) return;
    assert.equal(paid.ledger.status, "PAID");
    assert.equal(deps.state.ledgers.get("tenant-a:attempt-a")?.status, "EXPIRED");
    assert.equal(deps.state.transactions.get(transactionRef)?.paymentStatus, "PAID");
    assert.equal(deps.state.transactions.get(transactionRef)?.verifiedPaid, true);
    const totals = aggregateAttemptLedgers([
      deps.state.ledgers.get("tenant-a:attempt-a") ?? emptyLedger(),
      deps.state.ledgers.get("tenant-a:attempt-b") ?? emptyLedger(),
    ]);
    assert.equal(totals.netRevenueIdr, 10000);
    assert.equal(totals.status, "PAID");
  });

  it("leaves a later attempt pending when an earlier attempt is paid", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "MANUAL" });
    const deps = wire(provider, "MANUAL");
    const lead = await reserve(command({ idempotencyKey: "pay-pending-b" }), { ...deps, now: NOW });
    const transactionRef = lead.transaction?.transactionRef ?? "";
    const connection = { tenantId: "tenant-a", providerId: PAY_PROVIDER, secret: PAY_SECRET };
    (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-a",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-b",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    const paidNotice = rawNotice(
      verifiedEvent({ transactionRef, attemptRef: "attempt-a", eventId: "pay-a", providerReference: "ref-a" }),
    );
    const paid = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: paidNotice, proof: proofFor(paidNotice), connection },
      NOW,
    ));
    assert.equal(paid.ok, true);
    const pendingNotice = rawNotice(
      verifiedEvent({
        transactionRef,
        attemptRef: "attempt-b",
        eventId: "pend-b",
        type: "payment.pending",
        providerReference: "ref-b",
      }),
    );
    const pending = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: pendingNotice, proof: proofFor(pendingNotice), connection },
      NOW,
    ));
    assert.equal(pending.ok, true);
    if (!pending.ok) return;
    assert.equal(pending.ledger.status, "PENDING");
    assert.equal(pending.ledger.verifiedPaid, false);
    assert.equal(deps.state.ledgers.get("tenant-a:attempt-a")?.status, "PAID");
    assert.equal(deps.state.transactions.get(transactionRef)?.paymentStatus, "PAID");
    const totals = aggregateAttemptLedgers([
      deps.state.ledgers.get("tenant-a:attempt-a") ?? emptyLedger(),
      deps.state.ledgers.get("tenant-a:attempt-b") ?? emptyLedger(),
    ]);
    assert.equal(totals.netRevenueIdr, 10000);
  });

  it("rejects a repeated attempt id when the amount or provider changes", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "MANUAL" });
    const deps = wire(provider, "MANUAL");
    const lead = await reserve(command({ idempotencyKey: "pay-reuse" }), { ...deps, now: NOW });
    const transactionRef = lead.transaction?.transactionRef ?? "";
    const first = (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-a",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    assert.equal(first.ok, true);
    const changedAmount = (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-a",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 5000,
    }));
    assert.equal(changedAmount.ok, false);
    if (changedAmount.ok) return;
    assert.equal(changedAmount.code, "ATTEMPT_CONFLICT");
    const changedProvider = (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-a",
      providerId: "other-gateway",
      expectedAmountIdr: 10000,
    }));
    assert.equal(changedProvider.ok, false);
    if (changedProvider.ok) return;
    assert.equal(changedProvider.code, "ATTEMPT_CONFLICT");
    const replay = (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-a",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    assert.equal(replay.ok, true);
    if (!replay.ok) return;
    assert.equal(replay.replay, true);
    assert.equal(deps.state.paymentAttempts.get("tenant-a:attempt-a")?.expectedAmountIdr, 10000);
    const other = await reserve(command({ idempotencyKey: "pay-reuse-other" }), { ...deps, now: NOW });
    const otherTransaction = other.transaction?.transactionRef ?? "";
    const moved = (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef: otherTransaction,
      attemptRef: "attempt-a",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    assert.equal(moved.ok, false);
    if (moved.ok) return;
    assert.equal(moved.code, "ATTEMPT_CONFLICT");
    assert.equal(deps.state.paymentAttempts.get("tenant-a:attempt-a")?.transactionRef, transactionRef);
  });

  it("does not apply attempt A's refund or chargeback to attempt B", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "MANUAL" });
    const deps = wire(provider, "MANUAL");
    const lead = await reserve(command({ idempotencyKey: "pay-refund-map" }), { ...deps, now: NOW });
    const transactionRef = lead.transaction?.transactionRef ?? "";
    const connection = { tenantId: "tenant-a", providerId: PAY_PROVIDER, secret: PAY_SECRET };
    (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-a",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-b",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    const paidNotice = rawNotice(
      verifiedEvent({ transactionRef, attemptRef: "attempt-a", eventId: "pay-a", providerReference: "ref-a" }),
    );
    assert.equal(
      (await recordPayment(
        deps.state,
        actor("tenant-a"),
        { transactionRef, notice: paidNotice, proof: proofFor(paidNotice), connection },
        NOW,
      )).ok,
      true,
    );
    const mischarge = rawNotice(
      verifiedEvent({
        transactionRef,
        attemptRef: "attempt-b",
        eventId: "cb-b",
        type: "payment.chargeback",
        providerReference: "ref-a",
      }),
    );
    const chargeRejected = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: mischarge, proof: proofFor(mischarge), connection },
      NOW,
    ));
    assert.equal(chargeRejected.ok, false);
    if (chargeRejected.ok) return;
    assert.equal(chargeRejected.code, "MISMATCH");
    assert.equal(deps.state.ledgers.get("tenant-a:attempt-a")?.status, "PAID");

    const misrefund = rawNotice(
      verifiedEvent({
        transactionRef,
        attemptRef: "attempt-b",
        eventId: "refund-b",
        type: "payment.refunded",
        providerReference: "ref-a",
      }),
    );
    const rejected = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: misrefund, proof: proofFor(misrefund), connection },
      NOW,
    ));
    assert.equal(rejected.ok, false);
    if (rejected.ok) return;
    assert.equal(rejected.code, "MISMATCH");
    assert.equal(deps.state.ledgers.get("tenant-a:attempt-a")?.status, "PAID");
    assert.equal(deps.state.ledgers.get("tenant-a:attempt-b")?.status, "NOT_STARTED");

    const refundA = rawNotice(
      verifiedEvent({
        transactionRef,
        attemptRef: "attempt-a",
        eventId: "refund-a",
        type: "payment.refunded",
        providerReference: "ref-a",
      }),
    );
    const refunded = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: refundA, proof: proofFor(refundA), connection },
      NOW,
    ));
    assert.equal(refunded.ok, true);
    if (!refunded.ok) return;
    assert.equal(refunded.ledger.status, "REFUNDED");
    assert.equal(deps.state.ledgers.get("tenant-a:attempt-b")?.status, "NOT_STARTED");
    assert.equal(deps.state.transactions.get(transactionRef)?.paymentStatus, "REFUNDED");
    assert.equal(
      aggregateAttemptLedgers([
        deps.state.ledgers.get("tenant-a:attempt-a") ?? emptyLedger(),
        deps.state.ledgers.get("tenant-a:attempt-b") ?? emptyLedger(),
      ]).netRevenueIdr,
      0,
    );
  });

  it("does not double count a duplicate paid event or a second open capture", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "MANUAL" });
    const deps = wire(provider, "MANUAL");
    const lead = await reserve(command({ idempotencyKey: "pay-once" }), { ...deps, now: NOW });
    const transactionRef = lead.transaction?.transactionRef ?? "";
    const connection = { tenantId: "tenant-a", providerId: PAY_PROVIDER, secret: PAY_SECRET };
    (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-a",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    const paidNotice = rawNotice(
      verifiedEvent({ transactionRef, attemptRef: "attempt-a", eventId: "pay-a", providerReference: "ref-a" }),
    );
    const paid = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: paidNotice, proof: proofFor(paidNotice), connection },
      NOW,
    ));
    assert.equal(paid.ok, true);
    const duplicate = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: paidNotice, proof: proofFor(paidNotice), connection },
      NOW,
    ));
    assert.equal(duplicate.ok, true);
    if (!duplicate.ok || !paid.ok) return;
    assert.equal(duplicate.effect, "duplicate");
    assert.equal(duplicate.ledger.appliedEventIds.length, 1);
    const secondEvent = rawNotice(
      verifiedEvent({ transactionRef, attemptRef: "attempt-a", eventId: "pay-a-2", providerReference: "ref-a" }),
    );
    const repeated = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: secondEvent, proof: proofFor(secondEvent), connection },
      NOW,
    ));
    assert.equal(repeated.ok, true);
    if (!repeated.ok) return;
    assert.equal(repeated.effect, "duplicate");
    (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-b",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    const otherCapture = rawNotice(
      verifiedEvent({ transactionRef, attemptRef: "attempt-b", eventId: "pay-b", providerReference: "ref-b" }),
    );
    const blocked = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: otherCapture, proof: proofFor(otherCapture), connection },
      NOW,
    ));
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.code, "ATTEMPT_CONFLICT");
    const totals = aggregateAttemptLedgers([
      deps.state.ledgers.get("tenant-a:attempt-a") ?? emptyLedger(),
      deps.state.ledgers.get("tenant-a:attempt-b") ?? emptyLedger(),
    ]);
    assert.equal(totals.netRevenueIdr, 10000);
    assert.equal(deps.state.transactions.get(transactionRef)?.verifiedPaid, true);
    const outcome = classifyOutcome({
      paymentStatus: deps.state.transactions.get(transactionRef)?.paymentStatus ?? "NOT_STARTED",
      paymentVerified: deps.state.transactions.get(transactionRef)?.verifiedPaid ?? false,
      bookingState: "REQUESTED",
      authoritativeBookingRef: null,
      qualifiedLead: true,
      engaged: true,
    });
    assert.equal(outcome.countsAsRevenue, true);
    assert.equal(outcome.revenue, "FULL");
  });

  it("rejects an empty provider reference, a tampered timestamp, and a foreign tenant or provider", async () => {
    const blank = applyPaymentNotice(emptyLedger(), verifiedEvent({ providerReference: "" }));
    assert.equal(blank.ledger.verifiedPaid, false);
    assert.notEqual(blank.ledger.status, "PAID");

    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "MANUAL" });
    const deps = wire(provider, "MANUAL");
    const lead = await reserve(command({ idempotencyKey: "pay-bind" }), { ...deps, now: NOW });
    const transactionRef = lead.transaction?.transactionRef ?? "";
    const connection = { tenantId: "tenant-a", providerId: PAY_PROVIDER, secret: PAY_SECRET };
    (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-a",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    const event = verifiedEvent({ transactionRef, attemptRef: "attempt-a", providerReference: "ref-a" });
    const notice = rawNotice(event);
    const proof = proofFor(notice);
    const emptyRef = rawNotice(verifiedEvent({ ...event, providerReference: "" }));
    const unsignedEmpty = verifyPaymentNotice({
      notice: emptyRef,
      proof: proofFor(emptyRef),
      secret: PAY_SECRET,
      expectation: {
        tenantId: "tenant-a",
        providerId: PAY_PROVIDER,
        attemptRef: "attempt-a",
        transactionRef,
        currency: "IDR",
        amountIdr: 10000,
      },
    });
    assert.equal(unsignedEmpty.ok, false);
    if (unsignedEmpty.ok) return;
    assert.equal(unsignedEmpty.code, "MISMATCH");

    const shifted = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: { ...notice, occurredAt: "2026-10-25T08:00:00.000Z" }, proof, connection },
      NOW,
    ));
    assert.equal(shifted.ok, false);
    if (shifted.ok) return;
    assert.equal(shifted.code, "MISMATCH");
    const reordered = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: { ...notice, sequence: 9 }, proof, connection },
      NOW,
    ));
    assert.equal(reordered.ok, false);
    if (reordered.ok) return;
    assert.equal(reordered.code, "MISMATCH");

    const otherTenant = rawNotice(verifiedEvent({ ...event, tenantId: "tenant-b" }));
    const tenantRejected = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice: otherTenant, proof: proofFor(otherTenant), connection },
      NOW,
    ));
    assert.equal(tenantRejected.ok, false);
    const otherProvider = rawNotice(verifiedEvent({ ...event, providerId: "other-gateway" }));
    const providerRejected = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      {
        transactionRef,
        notice: otherProvider,
        proof: proofFor(otherProvider),
        connection: { tenantId: "tenant-a", providerId: "other-gateway", secret: PAY_SECRET },
      },
      NOW,
    ));
    assert.equal(providerRejected.ok, false);
    assert.equal(deps.state.transactions.get(transactionRef)?.paymentStatus, "NOT_STARTED");
    assert.equal(deps.state.transactions.get(transactionRef)?.verifiedPaid, false);
  });
});

describe("booking and payment stay independent", () => {
  it("confirms a booking while payment has not started", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "EXTERNAL_API" });
    const deps = wire(provider, "EXTERNAL_API");
    const result = await reserve(command(), { ...deps, now: NOW });
    assert.equal(result.booking?.state, "CONFIRMED");
    assert.equal(result.booking?.referenceAuthoritative, true);
    assert.equal(result.transaction?.paymentStatus, "NOT_STARTED");
    assert.equal(result.transaction?.verifiedPaid, false);
    const outcome = classifyOutcome({
      paymentStatus: "NOT_STARTED",
      paymentVerified: false,
      bookingState: "CONFIRMED",
      authoritativeBookingRef: result.booking?.providerReference ?? null,
      qualifiedLead: true,
      engaged: true,
    });
    assert.equal(outcome.level, "B");
    assert.equal(outcome.countsAsRevenue, false);
  });

  it("records a verified payment without confirming the booking", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "MANUAL" });
    const deps = wire(provider, "MANUAL");
    const opened = await reserve(command({ experience: "WHATSAPP_CHAT", idempotencyKey: "chat-1" }), {
      ...deps,
      now: NOW,
    });
    assert.equal(opened.code, "POLICY_BLOCKED");
    assert.equal(provider.calls.length, 0);

    const lead = await reserve(command(), { ...deps, now: NOW });
    assert.equal(lead.booking?.state, "REQUESTED");
    const transactionRef = lead.transaction?.transactionRef ?? "";
    const paid = (await payVerified(deps.state, transactionRef));
    assert.equal(paid.ok, true);
    if (!paid.ok) return;
    assert.equal(paid.ledger.status, "PAID");
    assert.equal(paid.booking?.state, "REQUESTED");
    assert.equal(paid.transaction.paymentStatus, "PAID");
    const outcome = classifyOutcome({
      paymentStatus: paid.ledger.status,
      paymentVerified: paid.ledger.verifiedPaid,
      bookingState: paid.booking?.state ?? null,
      authoritativeBookingRef: paid.booking?.providerReference ?? null,
      qualifiedLead: true,
      engaged: true,
    });
    assert.equal(outcome.level, "A");
    assert.equal(outcome.countsAsRevenue, true);
  });

  it("cancels a booking without refunding, then refunds without reopening it", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "EXTERNAL_API" });
    const deps = wire(provider, "EXTERNAL_API");
    const opened = await reserve(command(), { ...deps, now: NOW });
    const transactionRef = opened.transaction?.transactionRef ?? "";
    const bookingRef = opened.booking?.bookingRef ?? "";
    const paid = (await payVerified(deps.state, transactionRef));
    assert.equal(paid.ok, true);
    const cancelled = await cancelReservation(
      { actor: actor("tenant-a"), bookingRef, idempotencyKey: "cancel-1" },
      { ...deps, now: NOW },
    );
    assert.equal(cancelled.booking?.state, "CANCELLED");
    assert.equal(deps.state.ledgers.get("tenant-a:attempt-1")?.status, "PAID");
    const refunded = (await payVerified(deps.state, transactionRef, { eventId: "refund-1", type: "payment.refunded" }));
    assert.equal(refunded.ok, true);
    if (!refunded.ok) return;
    assert.equal(refunded.ledger.status, "REFUNDED");
    assert.equal(refunded.booking?.state, "CANCELLED");
    const outcome = classifyOutcome({
      paymentStatus: "REFUNDED",
      paymentVerified: true,
      bookingState: "CANCELLED",
      authoritativeBookingRef: opened.booking?.providerReference ?? null,
      qualifiedLead: true,
      engaged: true,
    });
    assert.equal(outcome.countsAsRevenue, false);
    assert.notEqual(outcome.level, "A");
  });
});

describe("policy, experience, and attribution", () => {
  it("fails closed when Meta eligibility is unknown", () => {
    const unknown = evaluateEligibility({
      merchantEligibility: "UNKNOWN",
      offeringCategory: "GENERAL_GOODS",
      experience: "WHATSAPP_CATALOG",
      approvalEvidence: VERIFIED_APPROVAL,
    });
    assert.equal(unknown.transactional, "DENY");
    assert.equal(unknown.leadCapture, "ALLOW");

    const service = evaluateEligibility({
      merchantEligibility: "ELIGIBLE",
      offeringCategory: "SERVICE",
      experience: "WHATSAPP_FLOW",
      approvalEvidence: VERIFIED_APPROVAL,
    });
    assert.equal(service.transactional, "DENY");

    const flowTicket = evaluateEligibility({
      merchantEligibility: "ELIGIBLE",
      offeringCategory: "ADMISSION_TICKET",
      experience: "WHATSAPP_FLOW",
      approvalEvidence: VERIFIED_APPROVAL,
    });
    assert.equal(flowTicket.transactional, "DENY");
    assert.match(flowTicket.reasons[0], /Flow/);

    const labeled = evaluateEligibility({
      merchantEligibility: "ELIGIBLE",
      offeringCategory: "GENERAL_GOODS",
      experience: "WHATSAPP_CATALOG",
      approvalEvidence: { source: "META_COMMERCE_POLICY", status: "UNVERIFIED", reference: "meta-approval-1" },
    });
    assert.equal(labeled.transactional, "DENY");
    assert.match(labeled.reasons[0], /not a verified/);

    const blank = evaluateEligibility({
      merchantEligibility: "ELIGIBLE",
      offeringCategory: "GENERAL_GOODS",
      experience: "WHATSAPP_CATALOG",
      approvalEvidence: { source: "META_COMMERCE_POLICY", status: "VERIFIED", reference: "  " },
    });
    assert.equal(blank.transactional, "DENY");

    const catalogGoods = evaluateEligibility({
      merchantEligibility: "ELIGIBLE",
      offeringCategory: "GENERAL_GOODS",
      experience: "WHATSAPP_CATALOG",
      approvalEvidence: VERIFIED_APPROVAL,
    });
    assert.equal(catalogGoods.transactional, "ALLOW");
  });

  it("normalizes a catalog order and a Flow submission without confirming a booking", () => {
    const catalog = normalizeCustomerExperience({
      tenantId: "tenant-a",
      locationId: "loc-1",
      experience: "WHATSAPP_CATALOG",
      event: "catalog.order",
      commerceOrderRef: "CO-1",
    });
    const flow = normalizeCustomerExperience({
      tenantId: "tenant-a",
      locationId: "loc-1",
      experience: "WHATSAPP_FLOW",
      event: "flow.submission",
    });
    const selection = normalizeCustomerExperience({
      tenantId: "tenant-a",
      locationId: "loc-1",
      experience: "WHATSAPP_FLOW",
      event: "flow.selection",
    });
    assert.equal(catalog.ok, true);
    assert.equal(flow.ok, true);
    assert.equal(selection.ok, true);
    if (!catalog.ok || !flow.ok || !selection.ok) return;
    assert.equal(catalog.value.intent.intentType, "PRODUCT_ORDER");
    assert.equal(catalog.value.intent.commerceOrderRef, "CO-1");
    assert.equal(catalog.value.confirmed, false);
    assert.equal(catalog.value.createsReservation, false);
    assert.equal(catalog.value.verifiesPayment, false);
    assert.equal(catalog.value.bookingState, null);
    assert.equal(flow.value.intent.intentType, "STRUCTURED_RESPONSE");
    assert.equal(flow.value.confirmed, false);
    assert.equal(flow.value.createsReservation, false);
    assert.equal(flow.value.verifiesPayment, false);
    assert.equal(selection.value.intent.intentType, "BOOKING_REQUEST");
    assert.equal(selection.value.bookingState, null);
    assert.equal(selection.value.confirmed, false);
  });

  it("rejects an event that does not belong to the experience", () => {
    const catalogFlow = normalizeCustomerExperience({
      tenantId: "tenant-a",
      locationId: "loc-1",
      experience: "WHATSAPP_CATALOG",
      event: "flow.submission",
    });
    const flowOrder = normalizeCustomerExperience({
      tenantId: "tenant-a",
      locationId: "loc-1",
      experience: "WHATSAPP_FLOW",
      event: "catalog.order",
    });
    const chatFlow = normalizeCustomerExperience({
      tenantId: "tenant-a",
      locationId: "loc-1",
      experience: "WHATSAPP_CHAT",
      event: "flow.selection",
    });
    const chatOrder = normalizeCustomerExperience({
      tenantId: "tenant-a",
      locationId: "loc-1",
      experience: "WHATSAPP_CHAT",
      event: "catalog.order",
    });
    assert.equal(catalogFlow.ok, false);
    assert.equal(flowOrder.ok, false);
    assert.equal(chatFlow.ok, false);
    assert.equal(chatOrder.ok, false);
    if (catalogFlow.ok || flowOrder.ok || chatFlow.ok || chatOrder.ok) return;
    assert.equal(catalogFlow.code, "EXPERIENCE_EVENT_MISMATCH");
    assert.equal(flowOrder.code, "EXPERIENCE_EVENT_MISMATCH");
    assert.equal(chatFlow.code, "EXPERIENCE_EVENT_MISMATCH");
    const chat = normalizeCustomerExperience({
      tenantId: "tenant-a",
      locationId: "loc-1",
      experience: "WHATSAPP_CHAT",
      event: "chat.message",
    });
    assert.equal(chat.ok, true);
    if (!chat.ok) return;
    assert.equal(chat.value.confirmed, false);
    assert.equal(chat.value.verifiesPayment, false);
    assert.equal(chat.value.createsReservation, false);
  });

  it("does not invent a click id from aggregated or missing attribution", () => {
    const missing = buildTouchpoint({ tenantId: "tenant-a", locationId: "loc-1", transactionRef: null });
    assert.equal(missing.channel, "UNKNOWN");
    assert.equal(missing.confidence, "NONE");
    assert.equal(missing.userLevel, false);
    assert.equal(missing.ctwaClid, null);
    assert.equal(missing.gclid, null);
    assert.match(missing.warnings.join(" "), /No attribution identifier/);

    const aggregate = buildTouchpoint({
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: null,
      gscClicks: 12,
      gbpViews: 4,
      ctwaClid: "  ",
    });
    assert.equal(aggregate.userLevel, false);
    assert.equal(aggregate.ctwaClid, null);
    assert.equal(aggregate.channel, "GOOGLE_SEARCH");
    assert.match(aggregate.warnings.join(" "), /not a user-level click/);

    const ctwa = buildTouchpoint({
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef: "CTX-1",
      ctwaClid: "ctwa-123",
      gscClicks: 12,
    });
    assert.equal(ctwa.channel, "META_CTWA");
    assert.equal(ctwa.ctwaClid, "ctwa-123");
    assert.equal(ctwa.userLevel, true);
    assert.equal(ctwa.confidence, "HIGH");
  });
});

describe("webhook gate", () => {
  const connection = { providerId: "provider-a", tenantId: "tenant-a" };

  function signed(rawBody: string, deliveredAt: string) {
    return signWebhook(SECRET, rawBody, deliveredAt);
  }

  it("requires a matching signature, tenant, and provider", () => {
    const rawBody = JSON.stringify({ eventId: "evt-1", tenantId: "tenant-b" });
    const accepted = assessWebhook({
      connection,
      claimedTenantId: "tenant-a",
      claimedProviderId: "provider-a",
      eventId: "evt-1",
      eventType: "payment.paid",
      occurredAt: NOW,
      deliveredAt: NOW,
      nowIso: NOW,
      signature: signed(rawBody, NOW),
      secret: SECRET,
      rawBody,
      seenEventIds: [],
      sequence: 4,
      lastSequence: 5,
    });
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(accepted.outOfOrder, true);
    assert.equal(accepted.duplicate, false);
    assert.equal(accepted.tenantId, "tenant-a");
    assert.equal(accepted.providerId, "provider-a");
    assert.equal(accepted.dedupeKey, "provider-a:evt-1");

    const unsigned = assessWebhook({
      connection,
      claimedTenantId: "tenant-a",
      eventId: "evt-1",
      eventType: "payment.paid",
      occurredAt: NOW,
      deliveredAt: NOW,
      nowIso: NOW,
      signature: "not-the-hmac",
      secret: SECRET,
      rawBody,
      seenEventIds: [],
      sequence: null,
      lastSequence: null,
    });
    assert.equal(unsigned.ok, false);
    if (unsigned.ok) return;
    assert.equal(unsigned.reason, "UNSIGNED");

    const missingTenant = assessWebhook({
      connection: { providerId: "provider-a", tenantId: "" },
      claimedTenantId: null,
      eventId: "evt-1",
      eventType: "payment.paid",
      occurredAt: NOW,
      deliveredAt: NOW,
      nowIso: NOW,
      signature: signed(rawBody, NOW),
      secret: SECRET,
      rawBody,
      seenEventIds: [],
      sequence: null,
      lastSequence: null,
    });
    assert.equal(missingTenant.ok, false);
    if (missingTenant.ok) return;
    assert.equal(missingTenant.reason, "MISSING_TENANT");

    const duplicate = assessWebhook({
      connection,
      claimedTenantId: "tenant-a",
      eventId: "evt-1",
      eventType: "booking.confirmed",
      occurredAt: NOW,
      deliveredAt: NOW,
      nowIso: NOW,
      signature: signed(rawBody, NOW),
      secret: SECRET,
      rawBody,
      seenEventIds: ["evt-1"],
      sequence: 2,
      lastSequence: 1,
    });
    assert.equal(duplicate.ok, true);
    if (!duplicate.ok) return;
    assert.equal(duplicate.duplicate, true);

    const duplicateKey = assessWebhook({
      connection,
      claimedTenantId: null,
      eventId: "evt-1",
      eventType: "booking.confirmed",
      occurredAt: NOW,
      deliveredAt: NOW,
      nowIso: NOW,
      signature: signed(rawBody, NOW),
      secret: SECRET,
      rawBody,
      seenEventIds: ["provider-a:evt-1"],
      sequence: null,
      lastSequence: null,
    });
    assert.equal(duplicateKey.ok, true);
    if (!duplicateKey.ok) return;
    assert.equal(duplicateKey.duplicate, true);
    assert.equal(duplicateKey.tenantId, "tenant-a");

    const deliveredAt = "2026-10-25T09:00:00.000Z";
    const stale = assessWebhook({
      connection,
      claimedTenantId: "tenant-a",
      eventId: "evt-2",
      eventType: "booking.confirmed",
      occurredAt: NOW,
      deliveredAt,
      nowIso: NOW,
      signature: signed(rawBody, deliveredAt),
      secret: SECRET,
      rawBody,
      seenEventIds: [],
      sequence: null,
      lastSequence: null,
    });
    assert.equal(stale.ok, false);
    if (stale.ok) return;
    assert.equal(stale.reason, "REPLAY");
  });

  it("accepts a delayed business event when delivery is fresh and ignores a spoofed tenant", () => {
    const rawBody = JSON.stringify({ eventId: "evt-old", tenantId: "tenant-b" });
    const delayed = assessWebhook({
      connection,
      claimedTenantId: "tenant-a",
      eventId: "evt-old",
      eventType: "booking.confirmed",
      occurredAt: "2026-10-25T08:00:00.000Z",
      deliveredAt: NOW,
      nowIso: NOW,
      signature: signed(rawBody, NOW),
      secret: SECRET,
      rawBody,
      seenEventIds: [],
      sequence: null,
      lastSequence: null,
    });
    assert.equal(delayed.ok, true);
    if (!delayed.ok) return;
    assert.equal(delayed.tenantId, "tenant-a");
    assert.equal(delayed.dedupeKey, "provider-a:evt-old");

    const spoofed = assessWebhook({
      connection,
      claimedTenantId: "tenant-b",
      claimedProviderId: "provider-b",
      eventId: "evt-spoof",
      eventType: "payment.paid",
      occurredAt: NOW,
      deliveredAt: NOW,
      nowIso: NOW,
      signature: signed(rawBody, NOW),
      secret: SECRET,
      rawBody,
      seenEventIds: [],
      sequence: null,
      lastSequence: null,
    });
    assert.equal(spoofed.ok, false);
    if (spoofed.ok) return;
    assert.equal(spoofed.reason, "TENANT_MISMATCH");

    const wrongProvider = assessWebhook({
      connection,
      claimedTenantId: "tenant-a",
      claimedProviderId: "provider-b",
      eventId: "evt-provider",
      eventType: "payment.paid",
      occurredAt: NOW,
      deliveredAt: NOW,
      nowIso: NOW,
      signature: signed(rawBody, NOW),
      secret: SECRET,
      rawBody,
      seenEventIds: [],
      sequence: null,
      lastSequence: null,
    });
    assert.equal(wrongProvider.ok, false);
    if (wrongProvider.ok) return;
    assert.equal(wrongProvider.reason, "PROVIDER_MISMATCH");
  });

  it("does not confirm an external booking event that has no reference", () => {
    const missing = planBookingEvent({
      eventType: "booking.confirmed",
      duplicate: false,
      from: "REQUESTED",
      providerReference: null,
      supportsHold: false,
      external: true,
    });
    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.equal(missing.code, "MISSING_REFERENCE");

    const reschedule = planBookingEvent({
      eventType: "booking.rescheduled",
      duplicate: false,
      from: "CONFIRMED",
      providerReference: "prv-1",
      supportsHold: false,
      external: true,
    });
    assert.equal(reschedule.ok, true);
    if (!reschedule.ok) return;
    assert.equal(reschedule.applied, false);
    assert.equal(reschedule.reason, "RESCHEDULE_NOT_IN_M1A");
  });
});

describe("existing commerce compatibility", () => {
  it("maps current order and payment words without treating a catalog order as a booking", () => {
    assert.equal(ORDER_STATUS_PENDING_PAYMENT, "PENDING_PAYMENT");
    assert.equal(PAYMENT_STATUS_NOT_INITIATED, "NOT_INITIATED");
    assert.equal(mapCommercePaymentStatus(PAYMENT_STATUS_NOT_INITIATED), "NOT_STARTED");
    assert.equal(mapCommercePaymentStatus("LINK_CREATED"), "PENDING");
    assert.equal(mapCommercePaymentStatus("DISPUTED"), "CHARGEBACK");
    assert.equal(mapCommercePaymentStatus("PAID"), "PAID");
    assert.equal(mapCommercePaymentStatus("UNKNOWN_PROVIDER_WORD"), "NOT_STARTED");
    assert.equal(catalogOrderConfirmsBooking(), false);

    const parsed = parseProductInput({
      sku: "PLAY-001",
      name: "Family package",
      unitPriceIdr: 150000,
      description: "Fixed price package",
      category: "Admission",
      availability: "AVAILABLE",
      status: "ACTIVE",
      variants: [],
      outlets: [{ locationId: "loc-a", availability: "AVAILABLE" }],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.catalogEligibility, "UNKNOWN");
    const eligible = parseProductInput({
      sku: "PLAY-001",
      name: "Family package",
      unitPriceIdr: 150000,
      catalogEligibility: "ELIGIBLE",
    });
    assert.equal(eligible.ok, false);
    assert.equal(sameTenant("tenant-a", "tenant-b"), false);
  });

  it("stays isolated from Prisma, Meta writes, and live switches", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(here).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
    assert.ok(files.includes("orchestrator.ts"));
    const prismaFiles = new Set(["postgres-store.ts", "postgres-booking.ts", "postgres-finance.ts", "qa-database.ts"]);
    for (const file of ["postgres-store.ts", "postgres-booking.ts", "postgres-finance.ts"]) {
      const adapter = readFileSync(join(here, file), "utf8");
      assert.equal(adapter.includes("writeSnapshot"), false, file);
      assert.equal(adapter.includes("pg_advisory_xact_lock"), false, file);
      assert.equal(adapter.includes(".deleteMany()"), false, file);
    }
    for (const file of files) {
      const text = readFileSync(join(here, file), "utf8");
      if (!prismaFiles.has(file)) {
        assert.equal(text.includes("@prisma/client"), false, file);
        assert.equal(text.includes("prisma."), false, file);
      }
      if (file !== "qa-database.ts") assert.equal(text.includes("process.env"), false, file);
      assert.equal(text.includes("items_batch"), false, file);
      assert.equal(text.includes("fetch("), false, file);
      assert.equal(text.includes("graph.facebook.com"), false, file);
    }
  });
});

describe("registry", () => {
  it("does not resolve another tenant's provider id", () => {
    const registry: ProviderRegistry = createRegistry();
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "shared-name", mode: "MANUAL" });
    const registered = registry.register({ tenantId: "tenant-a", locationId: "loc-1", providerId: "shared-name", mode: "MANUAL", provider });
    assert.equal(registered.ok, true);
    assert.equal(registry.resolve({ tenantId: "tenant-b", locationId: "loc-1" }, "shared-name").ok, false);
    assert.equal(registry.resolve({ tenantId: "tenant-a", locationId: "loc-2" }, "shared-name").ok, false);
    assert.equal(registry.resolve({ tenantId: "tenant-a", locationId: "loc-1" }, "shared-name").ok, true);
  });

  it("rejects a registration whose id or mode disagrees with the adapter", () => {
    const registry = createRegistry();
    const native = createMockProvider({ boundTenantId: "tenant-a", providerId: "native-1", mode: "NATIVE" });
    const asExternal = registry.register({
      tenantId: "tenant-a",
      locationId: null,
      providerId: "native-1",
      mode: "EXTERNAL_API",
      provider: native,
    });
    assert.equal(asExternal.ok, false);
    if (asExternal.ok) return;
    assert.equal(asExternal.code, "PROVIDER_MISMATCH");
    assert.equal(registry.resolve({ tenantId: "tenant-a", locationId: "loc-1" }, "native-1").ok, false);

    const external = createMockProvider({ boundTenantId: "tenant-a", providerId: "ext-1", mode: "EXTERNAL_API" });
    const asNative = registry.register({
      tenantId: "tenant-a",
      locationId: null,
      providerId: "ext-1",
      mode: "NATIVE",
      provider: external,
    });
    assert.equal(asNative.ok, false);
    if (asNative.ok) return;
    assert.equal(asNative.code, "PROVIDER_MISMATCH");
    assert.equal(registry.resolve({ tenantId: "tenant-a", locationId: "loc-1" }, "ext-1").ok, false);

    const wrongId = registry.register({
      tenantId: "tenant-a",
      locationId: null,
      providerId: "other-id",
      mode: "NATIVE",
      provider: native,
    });
    assert.equal(wrongId.ok, false);
    const matched = registry.register({
      tenantId: "tenant-a",
      locationId: null,
      providerId: "native-1",
      mode: "NATIVE",
      provider: native,
    });
    assert.equal(matched.ok, true);
    assert.equal(registry.resolve({ tenantId: "tenant-a", locationId: "loc-1" }, "native-1").ok, true);
  });
});

function paymentCapabilities(providerId: string) {
  return {
    providerId,
    supportsHold: false,
    mock: true,
    guaranteesIdempotency: false,
    absenceConsistencyRequirement: null,
    holdExpiryOwner: "NONE" as const,
    issuesAuthoritativeReference: false,
  };
}

describe("port-backed orchestrator", () => {
  it("creates a reservation through the persistence ports", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE" });
    const deps = wire(provider);
    const created = await reserve(command(), { ...deps, now: NOW });
    assert.equal(created.ok, true);
    assert.equal(created.booking?.state, "HELD");
    const snap = (await deps.state.persistence.exportSnapshot());
    assert.equal(snap.bookings.length, 1);
    assert.equal(snap.transactions.length, 1);
    assert.equal(snap.transactions[0]?.state, "IN_PROGRESS");
    assert.equal(snap.transactions[0]?.bookingRef, created.booking?.bookingRef);
    assert.equal(snap.idempotency.some((row) => row.status === "COMPLETED" && row.idempotencyKey === "reserve-1"), true);
    assert.equal(snap.intents.some((row) => row.intentType === "BOOKING_REQUEST" && row.customerRef == null), true);
    assert.equal(snap.events.some((row) => row.type === "booking.updated"), true);
    assert.equal(snap.connections.some((row) => row.kind === "BOOKING" && row.locationId === "loc-1" && row.mode === "NATIVE"), true);
    assert.equal(deps.state.bookings.size, 1);
  });

  it("replays the same port-backed reservation exactly once", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE" });
    const deps = wire(provider);
    const first = await reserve(command({ idempotencyKey: "replay-port" }), { ...deps, now: NOW });
    const second = await reserve(command({ idempotencyKey: "replay-port" }), { ...deps, now: NOW });
    assert.equal(second.replay, true);
    assert.equal(second.booking?.bookingRef, first.booking?.bookingRef);
    assert.equal(second.transaction?.transactionRef, first.transaction?.transactionRef);
    assert.equal(provider.calls.filter((call) => call === "holdReservation").length, 1);
    assert.equal((await deps.state.persistence.exportSnapshot()).bookings.length, 1);
  });

  it("keeps one booking when two stores reserve the same slot", async () => {
    const seeded = createMemoryCommerceStore({ policyValidatorKey: ORCHESTRATOR_POLICY_KEY });
    seedOrchestratorPolicyFixture(seeded);
    const parent = (await seeded.exportSnapshot());
    const left = createOrchestratorState({
      persistence: createMemoryCommerceStore({ snapshot: parent, policyValidatorKey: ORCHESTRATOR_POLICY_KEY }),
    });
    const right = createOrchestratorState({
      persistence: createMemoryCommerceStore({ snapshot: parent, policyValidatorKey: ORCHESTRATOR_POLICY_KEY }),
    });
    const leftProvider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE" });
    const rightProvider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE" });
    const leftRegistry = createRegistry();
    const rightRegistry = createRegistry();
    leftRegistry.register({ tenantId: "tenant-a", locationId: null, providerId: "provider-a", mode: "NATIVE", provider: leftProvider });
    rightRegistry.register({ tenantId: "tenant-a", locationId: null, providerId: "provider-a", mode: "NATIVE", provider: rightProvider });
    const first = await reserve(command({ idempotencyKey: "slot-left" }), { registry: leftRegistry, state: left, now: NOW });
    const second = await reserve(command({ idempotencyKey: "slot-right" }), { registry: rightRegistry, state: right, now: NOW });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    const settled = settleConcurrent(parent, (await left.persistence.exportSnapshot()), (await right.persistence.exportSnapshot()));
    assert.equal(settled.conflicts.some((item) => item.code === "SLOT_CONFLICT"), true);
    assert.equal(settled.snapshot.bookings.length, 1);
    assert.equal(settled.snapshot.transactions.length, 1);
    assert.equal(settled.snapshot.transactions[0]?.transactionRef, first.transaction?.transactionRef);
  });

  it("does not persist a second booking when commit is followed by a provider timeout", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_API",
      ambiguousTimeout: true,
    });
    const deps = wire(provider, "EXTERNAL_API");
    const first = await reserve(command({ idempotencyKey: "commit-timeout" }), { ...deps, now: NOW });
    assert.equal(first.code, "TIMEOUT");
    assert.equal(first.resolutionRequired, true);
    assert.equal(provider.bookingCount(), 1);
    assert.equal((await deps.state.persistence.exportSnapshot()).bookings.length, 0);
    assert.equal((await deps.state.persistence.exportSnapshot()).transactions[0]?.state, "PENDING_RESOLUTION");
    const again = await reserve(command({ idempotencyKey: "commit-timeout" }), { ...deps, now: NOW });
    assert.equal(again.replay, true);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
  });

  it("restarts from a snapshot and recovers the pending reservation", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_API",
      ambiguousTimeout: true,
    });
    const deps = wire(provider, "EXTERNAL_API");
    const first = await reserve(command({ idempotencyKey: "restart-1" }), { ...deps, now: NOW });
    assert.equal(first.transaction?.state, "PENDING_RESOLUTION");
    const raw = JSON.parse(JSON.stringify((await deps.state.persistence.exportSnapshot())));
    const restored = createOrchestratorState({
      persistence: createMemoryCommerceStore({ snapshot: raw, policyValidatorKey: ORCHESTRATOR_POLICY_KEY }),
    });
    assert.equal(restored.transactions.get(first.transaction?.transactionRef ?? "")?.state, "PENDING_RESOLUTION");
    const recovered = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-1", providerId: "provider-a", idempotencyKey: "restart-1" },
      { registry: deps.registry, state: restored, now: NOW },
    );
    assert.equal(recovered.ok, true);
    assert.equal(recovered.transaction?.state, "COMMITTED");
    assert.equal(recovered.booking?.referenceAuthoritative, true);
    assert.equal(provider.bookingCount(), 1);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
  });

  it("rejects reconciliation from another provider or location", async () => {
    const providerA = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_API",
      ambiguousTimeout: true,
    });
    const providerB = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-b", mode: "EXTERNAL_API" });
    const deps = wire(providerA, "EXTERNAL_API");
    deps.registry.register({ tenantId: "tenant-a", locationId: null, providerId: "provider-b", mode: "EXTERNAL_API", provider: providerB });
    await reserve(command({ idempotencyKey: "cross-1" }), { ...deps, now: NOW });
    const otherProvider = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-1", providerId: "provider-b", idempotencyKey: "cross-1" },
      { ...deps, now: NOW },
    );
    const otherLocation = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-2", providerId: "provider-a", idempotencyKey: "cross-1" },
      { ...deps, now: NOW },
    );
    assert.equal(otherProvider.code, "SCOPE_MISMATCH");
    assert.equal(otherLocation.code, "SCOPE_MISMATCH");
    assert.equal(providerB.calls.length, 0);
    assert.equal(providerA.calls.includes("findByIdempotencyKey"), false);
    assert.equal(deps.state.transactions.get(deps.state.transactions.keys().next().value ?? "")?.state, "PENDING_RESOLUTION");
  });

  it("lets attempt B pay after attempt A expires without changing the booking", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "MANUAL" });
    const deps = wire(provider, "MANUAL");
    const lead = await reserve(command({ idempotencyKey: "expire-port" }), { ...deps, now: NOW });
    const transactionRef = lead.transaction?.transactionRef ?? "";
    const bookingState = lead.booking?.state;
    const connection = { tenantId: "tenant-a", providerId: PAY_PROVIDER, secret: PAY_SECRET };
    (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-a",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    const expiredNotice = rawNotice(verifiedEvent({ transactionRef, attemptRef: "attempt-a", eventId: "exp-a", type: "payment.expired", providerReference: "ref-a" }));
    const expired = (await recordPayment(deps.state, actor("tenant-a"), { transactionRef, notice: expiredNotice, proof: proofFor(expiredNotice), connection }, NOW));
    assert.equal(expired.ok, true);
    (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-b",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    const paidNotice = rawNotice(verifiedEvent({ transactionRef, attemptRef: "attempt-b", eventId: "pay-b", providerReference: "ref-b" }));
    const paid = (await recordPayment(deps.state, actor("tenant-a"), { transactionRef, notice: paidNotice, proof: proofFor(paidNotice), connection }, NOW));
    assert.equal(paid.ok, true);
    if (!paid.ok) return;
    assert.equal(paid.ledger.status, "PAID");
    assert.equal(paid.booking?.state, bookingState);
    assert.equal(deps.state.ledgers.get("tenant-a:attempt-a")?.status, "EXPIRED");
    assert.equal(deps.state.transactions.get(transactionRef)?.verifiedPaid, true);
    const snap = (await deps.state.persistence.exportSnapshot());
    assert.equal(snap.attempts.length, 2);
    assert.equal(snap.ledgerEvents.filter((row) => row.type === "payment.paid").length, 1);
  });

  it("refunds and chargebacks without changing the booking", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "EXTERNAL_API" });
    const deps = wire(provider, "EXTERNAL_API");
    const opened = await reserve(command({ idempotencyKey: "refund-port" }), { ...deps, now: NOW });
    const transactionRef = opened.transaction?.transactionRef ?? "";
    const paid = (await payVerified(deps.state, transactionRef, { providerReference: "ref-refund" }));
    assert.equal(paid.ok, true);
    const refunded = (await payVerified(deps.state, transactionRef, {
      eventId: "refund-port",
      type: "payment.partially_refunded",
      amountIdr: 4000,
      providerReference: "ref-refund",
    }));
    assert.equal(refunded.ok, true);
    if (!refunded.ok) return;
    assert.equal(refunded.ledger.status, "PARTIALLY_REFUNDED");
    assert.equal(refunded.booking?.state, "CONFIRMED");
    const charge = (await payVerified(deps.state, transactionRef, { eventId: "cb-port", type: "payment.chargeback", providerReference: "ref-refund" }));
    assert.equal(charge.ok, true);
    if (!charge.ok) return;
    assert.equal(charge.booking?.state, "CONFIRMED");
    assert.equal((await deps.state.persistence.exportSnapshot()).bookings[0]?.state, "CONFIRMED");
    assert.notEqual(deps.state.transactions.get(transactionRef)?.paymentStatus, "NOT_STARTED");
  });

  it("dedupes webhooks per connection and rejects an actor outside that location", async () => {
    const state = createOrchestratorState();
    const writer = actor("tenant-a");
    const first = (await state.persistence.connections.register(writer, {
      tenantId: "tenant-a",
      locationId: "loc-1",
      providerId: "pay-a",
      kind: "PAYMENT",
      mode: "MERCHANT_PAYMENT_GATEWAY",
      capabilities: paymentCapabilities("pay-a"),
    }));
    const second = (await state.persistence.connections.register(writer, {
      tenantId: "tenant-a",
      locationId: "loc-2",
      providerId: "pay-a",
      kind: "PAYMENT",
      mode: "MERCHANT_PAYMENT_GATEWAY",
      capabilities: paymentCapabilities("pay-a"),
    }));
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    const left = (await acceptWebhook(state, writer, { tenantId: "tenant-a", connectionId: first.value.connectionId, eventId: "evt-1", eventType: "payment.paid" }));
    const leftAgain = (await acceptWebhook(state, writer, { tenantId: "tenant-a", connectionId: first.value.connectionId, eventId: "evt-1", eventType: "payment.paid" }));
    const right = (await acceptWebhook(state, writer, { tenantId: "tenant-a", connectionId: second.value.connectionId, eventId: "evt-1", eventType: "payment.paid" }));
    assert.equal(left.ok, true);
    assert.equal(leftAgain.ok, true);
    assert.equal(right.ok, true);
    if (!left.ok || !leftAgain.ok || !right.ok) return;
    assert.equal(leftAgain.replay, true);
    assert.equal(right.replay, false);
    assert.notEqual(left.value.dedupeKey, right.value.dedupeKey);
    const outsider = (await markWebhookApplied(state, actor("tenant-a", ["loc-2"]), "tenant-a", left.value.dedupeKey));
    assert.equal(outsider.ok, false);
    if (outsider.ok) return;
    assert.equal(outsider.code, "LOCATION_FORBIDDEN");
    assert.equal((await state.persistence.exportSnapshot()).webhooks.find((row) => row.dedupeKey === left.value.dedupeKey)?.status, "RECEIVED");
    const reader = (await markWebhookApplied(state, { tenantId: "tenant-a", locationIds: null, permissions: ["read"] }, "tenant-a", left.value.dedupeKey));
    assert.equal(reader.ok, false);
    if (reader.ok) return;
    assert.equal(reader.code, "FORBIDDEN");
    const applied = (await markWebhookApplied(state, writer, "tenant-a", left.value.dedupeKey));
    assert.equal(applied.ok, true);
    if (!applied.ok) return;
    assert.equal(applied.value.status, "APPLIED");
  });

  it("rejects a forged payment event before any ledger write", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "MANUAL" });
    const deps = wire(provider, "MANUAL");
    const lead = await reserve(command({ idempotencyKey: "forged-pay" }), { ...deps, now: NOW });
    const transactionRef = lead.transaction?.transactionRef ?? "";
    (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-1",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    const notice = rawNotice(verifiedEvent({ transactionRef }));
    const forged = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      { transactionRef, notice, proof: null, connection: { tenantId: "tenant-a", providerId: PAY_PROVIDER, secret: PAY_SECRET } },
      NOW,
    ));
    assert.equal(forged.ok, false);
    const proof = proofFor(notice);
    const tampered = (await recordPayment(
      deps.state,
      actor("tenant-a"),
      {
        transactionRef,
        notice,
        proof: { ...proof, signature: "0".repeat(64) },
        connection: { tenantId: "tenant-a", providerId: PAY_PROVIDER, secret: PAY_SECRET },
      },
      NOW,
    ));
    assert.equal(tampered.ok, false);
    const snap = (await deps.state.persistence.exportSnapshot());
    assert.equal(snap.ledgerEvents.length, 0);
    assert.equal(snap.ledgers[0]?.ledger.status, "NOT_STARTED");
    assert.equal(deps.state.transactions.get(transactionRef)?.verifiedPaid, false);
  });

  it("does not let an untrusted snapshot grant commerce approval", async () => {
    const snapshot = (await createMemoryCommerceStore({ policyValidatorKey: ORCHESTRATOR_POLICY_KEY }).exportSnapshot());
    snapshot.policyEvidence.push({
      tenantId: "tenant-a",
      offeringCategory: "GENERAL_GOODS",
      experience: "WHATSAPP_CATALOG",
      source: "META_COMMERCE_POLICY",
      status: "VERIFIED",
      reference: "forged-meta-approval",
      validatedBy: "untrusted-import",
      integrity: null,
      version: 1,
    });
    const hostile = createOrchestratorState({
      persistence: createMemoryCommerceStore({ snapshot, policyValidatorKey: ORCHESTRATOR_POLICY_KEY }),
    });
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE" });
    const registry = createRegistry();
    registry.register({ tenantId: "tenant-a", locationId: null, providerId: "provider-a", mode: "NATIVE", provider });
    const denied = await reserve(command({ idempotencyKey: "forged-approval" }), { registry, state: hostile, now: NOW });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "POLICY_DENIED");
    assert.equal(denied.booking, null);
    assert.equal(provider.calls.length, 0);
    const after = (await hostile.persistence.exportSnapshot());
    assert.equal(after.bookings.length, 0);
    assert.equal(after.policyEvidence.some((row) => row.status === "VERIFIED"), false);
    const yola = await reserve(
      command({ actor: actor("yola-fun"), tenantId: "yola-fun", idempotencyKey: "yola-1" }),
      { registry, state: hostile, now: NOW },
    );
    assert.equal(yola.code, "NOT_FOUND");
    assert.equal(yola.booking, null);
    assert.equal((await hostile.persistence.exportSnapshot()).bookings.some((row) => row.tenantId.toLowerCase().includes("yola")), false);
  });

  it("does not let external checkout invent a reservation", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "EXTERNAL_CHECKOUT" });
    const deps = wire(provider, "EXTERNAL_CHECKOUT");
    const result = await reserve(command({ idempotencyKey: "checkout-port" }), { ...deps, now: NOW });
    assert.equal(result.code, "UNSUPPORTED");
    assert.equal(result.booking, null);
    const snap = (await deps.state.persistence.exportSnapshot());
    assert.equal(snap.bookings.length, 0);
    assert.equal(snap.externalRefs.length, 0);
    assert.equal(provider.bookingCount(), 0);
    assert.equal(provider.calls.includes("createBooking"), false);
  });

  it("does not turn a manual inquiry into verified revenue", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "MANUAL" });
    const deps = wire(provider, "MANUAL");
    const lead = await reserve(command({ idempotencyKey: "manual-port", merchantConfirmed: true }), { ...deps, now: NOW });
    assert.equal(lead.booking?.state, "REQUESTED");
    assert.equal(lead.booking?.referenceAuthoritative, false);
    assert.equal(lead.booking?.providerReference, null);
    const transactionRef = lead.transaction?.transactionRef ?? "";
    const classified = (await deps.state.persistence.attribution.readClass(actor("tenant-a"), "tenant-a", transactionRef));
    assert.equal(classified.ok, true);
    if (!classified.ok) return;
    assert.equal(classified.value.countsAsRevenue, false);
    assert.notEqual(classified.value.level, "A");
    assert.equal(deps.state.transactions.get(transactionRef)?.verifiedPaid, false);
  });

  it("keeps attribution evidence after booking and payment changes", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "EXTERNAL_API" });
    const deps = wire(provider, "EXTERNAL_API");
    const opened = await reserve(command({ idempotencyKey: "attr-port" }), { ...deps, now: NOW });
    const transactionRef = opened.transaction?.transactionRef ?? "";
    const saved = (await recordTouchpoint(deps.state, actor("tenant-a"), {
      tenantId: "tenant-a",
      locationId: "loc-1",
      transactionRef,
      intentRef: opened.transaction?.intentRef ?? null,
      bookingRef: opened.booking?.bookingRef ?? null,
      attemptRef: null,
      ctwaClid: "ctwa-port-1",
    }));
    assert.equal(saved.ok, true);
    const before = (await deps.state.persistence.attribution.readClass(actor("tenant-a"), "tenant-a", transactionRef));
    assert.equal(before.ok, true);
    if (!before.ok) return;
    assert.equal(before.value.level, "B");
    assert.equal(before.value.countsAsRevenue, false);
    assert.equal(before.value.channel, "META_CTWA");
    const paid = (await payVerified(deps.state, transactionRef, { providerReference: "attr-pay" }));
    assert.equal(paid.ok, true);
    const afterPay = (await deps.state.persistence.attribution.readClass(actor("tenant-a"), "tenant-a", transactionRef));
    assert.equal(afterPay.ok, true);
    if (!afterPay.ok) return;
    assert.equal(afterPay.value.level, "A");
    assert.equal(afterPay.value.countsAsRevenue, true);
    assert.equal(afterPay.value.channel, "META_CTWA");
    const refunded = (await payVerified(deps.state, transactionRef, { eventId: "attr-refund", type: "payment.refunded", providerReference: "attr-pay" }));
    assert.equal(refunded.ok, true);
    if (!refunded.ok) return;
    assert.equal(refunded.booking?.state, "CONFIRMED");
    const afterRefund = (await deps.state.persistence.attribution.readClass(actor("tenant-a"), "tenant-a", transactionRef));
    assert.equal(afterRefund.ok, true);
    if (!afterRefund.ok) return;
    assert.equal(afterRefund.value.countsAsRevenue, false);
    assert.equal(afterRefund.value.channel, "META_CTWA");
    const touch = (await deps.state.persistence.exportSnapshot()).touchpoints.find((row) => row.transactionRef === transactionRef);
    assert.equal(touch?.ctwaClid, "ctwa-port-1");
    assert.equal(touch?.channel, "META_CTWA");
  });

  it("does not seed merchant approval from the orchestrator constructor", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "NATIVE" });
    const registry = createRegistry();
    registry.register({ tenantId: "tenant-a", locationId: null, providerId: "provider-a", mode: "NATIVE", provider });
    const state = createOrchestratorState();
    assert.equal((await state.persistence.exportSnapshot()).policyEvidence.length, 0);
    const denied = await reserve(command({ idempotencyKey: "no-fixture" }), { registry, state, now: NOW });
    assert.equal(denied.code, "POLICY_DENIED");
    assert.equal(denied.booking, null);
    assert.equal(provider.calls.length, 0);
    assert.equal((await state.persistence.exportSnapshot()).bookings.length, 0);
    assert.equal((await state.persistence.exportSnapshot()).policyEvidence.some((row) => row.status === "VERIFIED"), false);
  });

  it("lets only the claim winner call the booking provider", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "EXTERNAL_API" });
    const { registry, state } = wire(provider, "EXTERNAL_API");
    const idempotency = state.persistence.idempotency;
    const realClaim = idempotency.claim.bind(idempotency);
    const observedEmpty: boolean[] = [];
    let releaseFirst: (() => void) | undefined;
    let markFirst: (() => void) | undefined;
    let markSecond: (() => void) | undefined;
    const firstReady = new Promise<void>((resolve) => {
      markFirst = resolve;
    });
    const secondReady = new Promise<void>((resolve) => {
      markSecond = resolve;
    });
    let claims = 0;
    idempotency.claim = (async (actor, input) => {
      claims += 1;
      const occupied = (await state.persistence.exportSnapshot()).idempotency.some((row) => row.tenantId === input.tenantId && row.idempotencyKey === input.idempotencyKey);
      observedEmpty.push(!occupied);
      if (claims === 1) {
        markFirst?.();
        return new Promise((resolve) => {
          releaseFirst = async () => resolve((await realClaim(actor, input)));
        });
      }
      const result = (await realClaim(actor, input));
      markSecond?.();
      return result;
    }) as typeof idempotency.claim;

    let creates = 0;
    let markCreate: (() => void) | undefined;
    const createReady = new Promise<void>((resolve) => {
      markCreate = resolve;
    });
    let releaseCreate: (() => void) | undefined;
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    const originalCreate = provider.createBooking.bind(provider);
    provider.createBooking = async (input) => {
      creates += 1;
      markCreate?.();
      await createGate;
      return (await originalCreate(input));
    };

    const first = reserve(command({ idempotencyKey: "race-1" }), { registry, state, now: NOW });
    await firstReady;
    const second = reserve(command({ idempotencyKey: "race-1" }), { registry, state, now: NOW });
    await secondReady;
    await createReady;
    assert.deepEqual(observedEmpty, [true, true]);
    assert.equal(creates, 1);
    assert.equal(provider.bookingCount(), 0);
    releaseFirst?.();
    const loser = await first;
    assert.equal(loser.ok, false);
    assert.equal(loser.replay, true);
    assert.equal(loser.resolutionRequired, true);
    assert.equal(loser.code, "TIMEOUT");
    assert.equal(loser.booking, null);
    assert.equal(creates, 1);
    releaseCreate?.();
    const winner = await second;
    assert.equal(winner.ok, true);
    assert.equal(winner.booking?.state, "CONFIRMED");
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
    assert.equal(provider.bookingCount(), 1);
    const replay = await reserve(command({ idempotencyKey: "race-1" }), { registry, state, now: NOW });
    assert.equal(replay.replay, true);
    assert.equal(replay.booking?.bookingRef, winner.booking?.bookingRef);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
  });

  it("does not let a commerce writer apply a forged paid event", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "MANUAL" });
    const deps = wire(provider, "MANUAL");
    const lead = await reserve(command({ idempotencyKey: "forged-port" }), { ...deps, now: NOW });
    const transactionRef = lead.transaction?.transactionRef ?? "";
    (await openPaymentAttempt(deps.state, actor("tenant-a"), {
      transactionRef,
      attemptRef: "attempt-1",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    const writer = { tenantId: "tenant-a", locationIds: null, permissions: ["write"] as const };
    const forged = (await deps.state.persistence.payments.applyEvent(writer, { event: verifiedEvent({ transactionRef }) }));
    assert.equal(forged.ok, false);
    if (forged.ok) return;
    assert.equal(forged.code, "INVALID");
    const snap = (await deps.state.persistence.exportSnapshot());
    assert.equal(snap.ledgers[0]?.ledger.status, "NOT_STARTED");
    assert.equal(snap.ledgers[0]?.ledger.verifiedPaid, false);
    assert.equal(snap.ledgerEvents.length, 0);
    assert.equal(deps.state.transactions.get(transactionRef)?.verifiedPaid, false);
    assert.equal(deps.state.transactions.get(transactionRef)?.paymentStatus, "NOT_STARTED");
  });
});

async function reloaded(state: ReturnType<typeof createOrchestratorState>) {
  const raw = JSON.parse(JSON.stringify((await state.persistence.exportSnapshot())));
  return createOrchestratorState({
    persistence: createMemoryCommerceStore({ snapshot: raw, policyValidatorKey: ORCHESTRATOR_POLICY_KEY }),
  });
}

describe("orchestration crash recovery", () => {
  it("recovers a crash after the claim without creating a booking", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "EXTERNAL_API" });
    const deps = wire(provider, "EXTERNAL_API");
    await assert.rejects(
      async () => (await reserve(command({ idempotencyKey: "crash-claim" }), { ...deps, now: NOW, crash: { afterClaim() { throw new Error("crash-after-claim"); } } })),
      /crash-after-claim/,
    );
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 0);
    assert.equal(provider.bookingCount(), 0);
    const snap = (await deps.state.persistence.exportSnapshot());
    const inflight = snap.inflight.find((row) => row.idempotencyKey === "crash-claim");
    assert.ok(inflight);
    assert.equal(inflight?.tenantId, "tenant-a");
    assert.equal(inflight?.locationId, "loc-1");
    assert.equal(inflight?.providerId, "provider-a");
    assert.equal(inflight?.offeringId, "offer-1");
    assert.equal(inflight?.startsAt, "2026-11-01T09:00:00.000Z");
    assert.equal(inflight?.absenceVerified, false);
    assert.equal(snap.transactions[0]?.state, "PENDING_RESOLUTION");
    assert.equal(snap.bookings.length, 0);
    const clash = await reserve(command({ idempotencyKey: "crash-claim", offeringId: "offer-9" }), { ...deps, now: NOW });
    assert.equal(clash.code, "IDEMPOTENCY_CONFLICT");
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 0);

    const restored = await reloaded(deps.state);
    const reconciled = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-1", providerId: "provider-a", idempotencyKey: "crash-claim" },
      { registry: deps.registry, state: restored, now: NOW },
    );
    assert.equal(reconciled.code, "TIMEOUT");
    assert.equal(reconciled.resolutionRequired, true);
    assert.equal(provider.bookingCount(), 0);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 0);
    assert.equal((await restored.persistence.exportSnapshot()).bookings.length, 0);
    const retried = await reserve(command({ idempotencyKey: "crash-claim" }), { registry: deps.registry, state: restored, now: NOW });
    assert.equal(retried.ok, true);
    assert.equal(retried.transaction?.transactionRef, snap.transactions[0]?.transactionRef);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
    assert.equal(provider.bookingCount(), 1);
    const again = await reserve(command({ idempotencyKey: "crash-claim" }), { registry: deps.registry, state: restored, now: NOW });
    assert.equal(again.replay, true);
    assert.equal(again.booking?.bookingRef, retried.booking?.bookingRef);
    assert.equal(provider.bookingCount(), 1);
  });

  it("adopts the provider booking when the local write crashes", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "EXTERNAL_API" });
    const deps = wire(provider, "EXTERNAL_API");
    await assert.rejects(
      async () => (await reserve(command({ idempotencyKey: "crash-persist" }), { ...deps, now: NOW, crash: { beforePersist() { throw new Error("crash-before-persist"); } } })),
      /crash-before-persist/,
    );
    assert.equal(provider.bookingCount(), 1);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
    assert.equal((await deps.state.persistence.exportSnapshot()).bookings.length, 0);
    const transactionRef = (await deps.state.persistence.exportSnapshot()).transactions[0]?.transactionRef ?? "";
    assert.equal(deps.state.transactions.get(transactionRef)?.state, "PENDING_RESOLUTION");
    const restored = await reloaded(deps.state);
    const recovered = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-1", providerId: "provider-a", idempotencyKey: "crash-persist" },
      { registry: deps.registry, state: restored, now: NOW },
    );
    assert.equal(recovered.ok, true);
    assert.equal(recovered.transaction?.transactionRef, transactionRef);
    assert.equal(recovered.transaction?.state, "COMMITTED");
    assert.equal(recovered.booking?.state, "CONFIRMED");
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
    assert.equal(provider.bookingCount(), 1);
    const second = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-1", providerId: "provider-a", idempotencyKey: "crash-persist" },
      { registry: deps.registry, state: restored, now: NOW },
    );
    assert.equal(second.replay, true);
    assert.equal(second.booking?.bookingRef, recovered.booking?.bookingRef);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
    assert.equal((await restored.persistence.exportSnapshot()).bookings.length, 1);
  });

  it("restarts after timeout persistence without a second booking", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_API",
      timeoutOn: ["createBooking"],
    });
    const deps = wire(provider, "EXTERNAL_API");
    await assert.rejects(
      async () => (await reserve(command({ idempotencyKey: "crash-timeout" }), { ...deps, now: NOW, crash: { afterTimeout() { throw new Error("crash-after-timeout"); } } })),
      /crash-after-timeout/,
    );
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
    assert.equal(provider.bookingCount(), 0);
    const restored = await reloaded(deps.state);
    assert.equal((await restored.persistence.exportSnapshot()).transactions[0]?.state, "PENDING_RESOLUTION");
    const reconciled = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-1", providerId: "provider-a", idempotencyKey: "crash-timeout" },
      { registry: deps.registry, state: restored, now: NOW },
    );
    assert.equal(reconciled.resolutionRequired, true);
    assert.equal(reconciled.booking, null);
    assert.equal(provider.bookingCount(), 0);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
    assert.equal((await restored.persistence.exportSnapshot()).bookings.length, 0);
  });

  it("adopts once when reconciliation crashes before the local write", async () => {
    const provider = createMockProvider({
      boundTenantId: "tenant-a",
      providerId: "provider-a",
      mode: "EXTERNAL_API",
      ambiguousTimeout: true,
    });
    const deps = wire(provider, "EXTERNAL_API");
    const first = await reserve(command({ idempotencyKey: "crash-reconcile" }), { ...deps, now: NOW });
    assert.equal(first.code, "TIMEOUT");
    assert.equal(provider.bookingCount(), 1);
    const restored = await reloaded(deps.state);
    let crashed = false;
    await assert.rejects(
      async () => (await reconcileTimedOut(
        { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-1", providerId: "provider-a", idempotencyKey: "crash-reconcile" },
        {
          registry: deps.registry,
          state: restored,
          now: NOW,
          crash: {
            beforeAdopt() {
              if (!crashed) {
                crashed = true;
                throw new Error("crash-before-adopt");
              }
            },
          },
        },
      )),
      /crash-before-adopt/,
    );
    assert.equal((await restored.persistence.exportSnapshot()).bookings.length, 0);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
    const recovered = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-1", providerId: "provider-a", idempotencyKey: "crash-reconcile" },
      {
        registry: deps.registry,
        state: restored,
        now: NOW,
        crash: {
          beforeAdopt() {
            if (!crashed) throw new Error("crash-before-adopt");
          },
        },
      },
    );
    assert.equal(recovered.ok, true);
    assert.equal(recovered.transaction?.transactionRef, first.transaction?.transactionRef);
    assert.equal(recovered.booking?.state, "CONFIRMED");
    assert.equal(provider.bookingCount(), 1);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
    assert.equal((await restored.persistence.exportSnapshot()).bookings.length, 1);
    const third = await reconcileTimedOut(
      { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-1", providerId: "provider-a", idempotencyKey: "crash-reconcile" },
      { registry: deps.registry, state: restored, now: NOW },
    );
    assert.equal(third.replay, true);
    assert.equal(third.booking?.bookingRef, recovered.booking?.bookingRef);
    assert.equal(provider.bookingCount(), 1);
  });
});

describe("provider outcome certainty", () => {
  it("defaults an unspecified provider failure to an uncertain outcome", () => {
    assert.equal(providerError("RETRYABLE", "again later").outcomeCertainty, "MAY_COMMIT");
    assert.equal(providerError("UNAVAILABLE", "later").outcomeCertainty, "MAY_COMMIT");
    assert.equal(providerError("CONFLICT", "slot taken", "NO_COMMIT").outcomeCertainty, "NO_COMMIT");
  });

  it("keeps a committed RETRYABLE result unresolved and adopts it once", async () => {
    await assertUncertainCommit("RETRYABLE");
  });

  it("keeps a committed UNAVAILABLE result unresolved and adopts it once", async () => {
    await assertUncertainCommit("UNAVAILABLE");
  });

  it("keeps the envelope when the provider omits a committed booking reference", async () => {
    const recovered = await assertUncertainCommit("INCOMPLETE_REFERENCE");
    assert.ok(recovered.booking?.providerReference);
    assert.equal(recovered.booking?.state, "CONFIRMED");
  });

  it("closes a definitive no-commit conflict without leaving a recovery envelope", async () => {
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "provider-a", mode: "EXTERNAL_API" });
    const deps = wire(provider, "EXTERNAL_API");
    const first = await reserve(command({ idempotencyKey: "held-slot" }), { ...deps, now: NOW });
    assert.equal(first.ok, true);
    const blocked = await reserve(command({ idempotencyKey: "conflict-slot" }), { ...deps, now: NOW });
    assert.equal(blocked.code, "CONFLICT");
    assert.equal(blocked.resolutionRequired, false);
    assert.equal(blocked.booking, null);
    const snap = (await deps.state.persistence.exportSnapshot());
    assert.equal(snap.bookings.length, 1);
    assert.equal(snap.inflight.some((row) => row.idempotencyKey === "conflict-slot"), false);
    const closed = snap.idempotency.find((row) => row.idempotencyKey === "conflict-slot");
    assert.equal(closed?.status, "COMPLETED");
    assert.equal(closed?.outcomeCode, "CONFLICT");
    const repeat = await reserve(command({ idempotencyKey: "conflict-slot" }), { ...deps, now: NOW });
    assert.equal(repeat.replay, true);
    assert.equal(repeat.code, "CONFLICT");
    assert.equal(provider.bookingCount(), 1);
    assert.equal(provider.calls.filter((call) => call === "createBooking").length, 2);
  });
});

async function assertUncertainCommit(commitThen: "RETRYABLE" | "UNAVAILABLE" | "INCOMPLETE_REFERENCE") {
  const provider = createMockProvider({
    boundTenantId: "tenant-a",
    providerId: "provider-a",
    mode: "EXTERNAL_API",
    commitThen,
  });
  const deps = wire(provider, "EXTERNAL_API");
  const idempotencyKey = `uncertain-${commitThen}`;
  const first = await reserve(command({ idempotencyKey }), { ...deps, now: NOW });
  const expectedCode = commitThen === "INCOMPLETE_REFERENCE" ? "MISSING_REFERENCE" : commitThen;
  assert.equal(first.code, expectedCode);
  assert.equal(first.ok, false);
  assert.equal(first.resolutionRequired, true);
  assert.equal(first.booking, null);
  assert.equal(first.transaction?.state, "PENDING_RESOLUTION");
  assert.equal(provider.bookingCount(), 1);
  const snap = (await deps.state.persistence.exportSnapshot());
  assert.equal(snap.bookings.length, 0);
  assert.equal(snap.inflight.some((row) => row.idempotencyKey === idempotencyKey), true);
  assert.equal(snap.idempotency.find((row) => row.idempotencyKey === idempotencyKey)?.status, "PENDING_RESOLUTION");
  assert.notEqual(snap.transactions[0]?.state, "FAILED");
  const again = await reserve(command({ idempotencyKey }), { ...deps, now: NOW });
  assert.equal(again.replay, true);
  assert.equal(again.resolutionRequired, true);
  assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
  assert.equal(provider.bookingCount(), 1);

  const restored = await reloaded(deps.state);
  assert.equal((await restored.persistence.exportSnapshot()).inflight.some((row) => row.idempotencyKey === idempotencyKey), true);
  const recovered = await reconcileTimedOut(
    { actor: actor("tenant-a"), tenantId: "tenant-a", locationId: "loc-1", providerId: "provider-a", idempotencyKey },
    { registry: deps.registry, state: restored, now: NOW },
  );
  assert.equal(recovered.ok, true);
  assert.equal(recovered.transaction?.transactionRef, first.transaction?.transactionRef);
  assert.equal(recovered.transaction?.state, "COMMITTED");
  assert.equal(recovered.booking?.state, "CONFIRMED");
  assert.equal(provider.calls.filter((call) => call === "createBooking").length, 1);
  assert.equal(provider.bookingCount(), 1);
  assert.equal((await restored.persistence.exportSnapshot()).bookings.length, 1);
  const replay = await reserve(command({ idempotencyKey }), { registry: deps.registry, state: restored, now: NOW });
  assert.equal(replay.replay, true);
  assert.equal(replay.booking?.bookingRef, recovered.booking?.bookingRef);
  assert.equal(provider.bookingCount(), 1);
  return recovered;
}

describe("tenant-scoped references", () => {
  it("routes a shared booking, transaction, payment, and cancellation to the authenticated tenant", async () => {
    const store = createMemoryCommerceStore({ policyValidatorKey: ORCHESTRATOR_POLICY_KEY });
    await seedSharedReservation(store, "tenant-b", "prv-b");
    await seedSharedReservation(store, "tenant-a", "prv-a");
    const state = createOrchestratorState({ persistence: store });
    const seen: string[] = [];
    const registry = createRegistry();
    for (const tenantId of ["tenant-b", "tenant-a"]) {
      const provider = createMockProvider({ boundTenantId: tenantId, providerId: "provider-a", mode: "NATIVE" });
      provider.cancelBooking = async (input) => {
        seen.push(`${input.tenantId}:${input.bookingRef}`);
        return {
          ok: true,
          replay: false,
          data: {
            bookingRef: input.bookingRef,
            state: "CANCELLED",
            slotKey: "slot",
            providerReference: tenantId === "tenant-a" ? "prv-a" : "prv-b",
            referenceAuthoritative: true,
            handoffUrl: null,
          },
        };
      };
      registry.register({ tenantId, locationId: null, providerId: "provider-a", mode: "NATIVE", provider });
    }

    const readA = (await readBooking(state, actor("tenant-a"), "BK-SAME"));
    const readB = (await readBooking(state, actor("tenant-b"), "BK-SAME"));
    assert.equal(readA.ok, true);
    assert.equal(readB.ok, true);
    if (!readA.ok || !readB.ok) return;
    assert.equal(readA.booking.providerReference, "prv-a");
    assert.equal(readB.booking.providerReference, "prv-b");
    assert.equal(readA.booking.tenantId, "tenant-a");
    assert.equal(readB.booking.tenantId, "tenant-b");
    const hidden = (await readBooking(state, actor("tenant-c"), "BK-SAME"));
    assert.equal(hidden.ok, false);
    if (hidden.ok) return;
    assert.equal(hidden.code, "CROSS_TENANT");
    assert.equal(JSON.stringify(hidden).includes("prv-"), false);
    const wrongOutlet = (await readBooking(state, actor("tenant-a", ["loc-2"]), "BK-SAME"));
    assert.equal(wrongOutlet.ok, false);
    if (wrongOutlet.ok) return;
    assert.equal(wrongOutlet.code, "LOCATION_FORBIDDEN");

    const openedB = (await openPaymentAttempt(state, actor("tenant-b"), {
      transactionRef: "TX-SAME",
      attemptRef: "attempt-same",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    const openedA = (await openPaymentAttempt(state, actor("tenant-a"), {
      transactionRef: "TX-SAME",
      attemptRef: "attempt-same",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    assert.equal(openedB.ok, true);
    assert.equal(openedA.ok, true);
    const foreignAttempt = (await openPaymentAttempt(state, actor("tenant-c"), {
      transactionRef: "TX-SAME",
      attemptRef: "attempt-c",
      providerId: PAY_PROVIDER,
      expectedAmountIdr: 10000,
    }));
    assert.equal(foreignAttempt.ok, false);
    if (foreignAttempt.ok) return;
    assert.equal(foreignAttempt.code, "CROSS_TENANT");
    const paidA = (await payTenant(state, "tenant-a", "gw-a"));
    assert.equal(paidA.ok, true);
    if (!paidA.ok) return;
    assert.equal(paidA.ledger.providerReference, "gw-a");
    const ledgers = (await state.persistence.exportSnapshot()).ledgers;
    assert.equal(ledgers.find((row) => row.tenantId === "tenant-b")?.ledger.status, "NOT_STARTED");
    assert.equal(JSON.stringify(ledgers.find((row) => row.tenantId === "tenant-b")).includes("gw-a"), false);
    const paidB = (await payTenant(state, "tenant-b", "gw-b"));
    assert.equal(paidB.ok, true);
    if (!paidB.ok) return;
    assert.equal(paidB.ledger.providerReference, "gw-b");
    assert.equal(paidA.ledger.providerReference, "gw-a");
    const afterPay = (await state.persistence.exportSnapshot());
    assert.equal(afterPay.transactions.find((row) => row.tenantId === "tenant-a")?.verifiedPaid, true);
    assert.equal(afterPay.transactions.find((row) => row.tenantId === "tenant-b")?.verifiedPaid, true);
    assert.equal(afterPay.ledgers.find((row) => row.tenantId === "tenant-a")?.ledger.providerReference, "gw-a");
    assert.equal(afterPay.ledgers.find((row) => row.tenantId === "tenant-b")?.ledger.providerReference, "gw-b");

    const deniedCancel = await cancelReservation(
      { actor: actor("tenant-c"), bookingRef: "BK-SAME", idempotencyKey: "cancel-c" },
      { registry, state, now: NOW },
    );
    assert.equal(deniedCancel.code, "CROSS_TENANT");
    assert.equal(deniedCancel.booking, null);
    assert.equal(seen.length, 0);
    const wrongLocation = await cancelReservation(
      { actor: actor("tenant-a", ["loc-2"]), bookingRef: "BK-SAME", idempotencyKey: "cancel-loc" },
      { registry, state, now: NOW },
    );
    assert.equal(wrongLocation.code, "LOCATION_FORBIDDEN");
    assert.equal(seen.length, 0);
    const cancelA = await cancelReservation(
      { actor: actor("tenant-a"), bookingRef: "BK-SAME", idempotencyKey: "cancel-a" },
      { registry, state, now: NOW },
    );
    assert.equal(cancelA.ok, true);
    assert.equal(cancelA.booking?.tenantId, "tenant-a");
    assert.equal(cancelA.booking?.state, "CANCELLED");
    assert.deepEqual(seen, ["tenant-a:BK-SAME"]);
    const stillB = (await readBooking(state, actor("tenant-b"), "BK-SAME"));
    assert.equal(stillB.ok, true);
    if (!stillB.ok) return;
    assert.equal(stillB.booking.state, "HELD");
    assert.equal(stillB.booking.providerReference, "prv-b");
    const cancelB = await cancelReservation(
      { actor: actor("tenant-b"), bookingRef: "BK-SAME", idempotencyKey: "cancel-b" },
      { registry, state, now: NOW },
    );
    assert.equal(cancelB.ok, true);
    assert.equal(cancelB.booking?.tenantId, "tenant-b");
    assert.deepEqual(seen, ["tenant-a:BK-SAME", "tenant-b:BK-SAME"]);
  });
});

async function seedSharedReservation(store: ReturnType<typeof createMemoryCommerceStore>, tenantId: string, providerReference: string) {
  const by = actor(tenantId);
  const fields = {
    tenantId,
    offeringCategory: "GENERAL_GOODS" as const,
    experience: "WHATSAPP_CATALOG" as const,
    processId: "policy-job",
    reference: `policy-${tenantId}`,
    outcome: "VERIFIED" as const,
  };
  const policy = (await store.policy.submit(by, tenantId, { offeringCategory: "GENERAL_GOODS", experience: "WHATSAPP_CATALOG" }, {
    kind: "AUTHORIZED_PROCESS",
    processId: "policy-job",
    reference: fields.reference,
    outcome: "VERIFIED",
    attestation: signPolicyAttestation(ORCHESTRATOR_POLICY_KEY, fields),
  }));
  assert.equal(policy.ok, true);
  const connection = (await store.connections.register(by, {
    tenantId,
    locationId: "loc-1",
    providerId: "provider-a",
    kind: "BOOKING",
    mode: "NATIVE",
    capabilities: {
      providerId: "provider-a",
      supportsHold: true,
      mock: true,
      guaranteesIdempotency: false,
      absenceConsistencyRequirement: "mock-absence-v1",
      holdExpiryOwner: "PROVIDER",
      issuesAuthoritativeReference: true,
    },
  }));
  assert.equal(connection.ok, true);
  const opened = (await store.bookings.openReservation({
    actor: by,
    tenantId,
    locationId: "loc-1",
    providerId: "provider-a",
    offeringId: "offer-1",
    startsAt: "2026-11-01T09:00:00.000Z",
    idempotencyKey: `reserve-${tenantId}`,
    requestHash: `hash-${tenantId}`,
    experience: "WHATSAPP_CATALOG",
    category: "GENERAL_GOODS",
    merchantEligibility: "ELIGIBLE",
    intentRef: null,
    bookingRef: "BK-SAME",
    transactionRef: "TX-SAME",
    providerMode: "NATIVE",
    providerReference,
    referenceAuthoritative: true,
    holdExpiresAt: null,
    nativeExpiryPolicyId: null,
    availabilityFreshUntil: null,
    nowIso: NOW,
  }));
  assert.equal(opened.ok, true);
}

async function payTenant(state: ReturnType<typeof createOrchestratorState>, tenantId: string, providerReference: string) {
  const event = verifiedEvent({
    tenantId,
    transactionRef: "TX-SAME",
    attemptRef: "attempt-same",
    providerReference,
    eventId: `pay-${tenantId}`,
  });
  const notice = rawNotice(event);
  return (await recordPayment(
    state,
    actor(tenantId),
    {
      transactionRef: "TX-SAME",
      notice,
      proof: proofFor(notice),
      connection: { tenantId, providerId: PAY_PROVIDER, secret: PAY_SECRET },
    },
    NOW,
  ));
}
