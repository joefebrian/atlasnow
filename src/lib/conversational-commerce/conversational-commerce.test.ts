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
import { createMockProvider, type MockProvider } from "./mock-provider";
import {
  cancelReservation,
  createOrchestratorState,
  readBooking,
  recordPayment,
  releaseTimedOut,
  reserve,
  type ReserveCommand,
} from "./orchestrator";
import { applyPaymentNotice, emptyLedger, type PaymentNotice } from "./payment";
import { evaluateEligibility } from "./policy";
import { createRegistry, type ProviderRegistry } from "./registry";
import { transitionTransaction } from "./transaction-state";
import { assessWebhook, planBookingEvent, signWebhook } from "./webhook";

const NOW = "2026-10-25T10:00:00.000Z";
const SECRET = "test-provider-secret";

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
    approvalEvidenceRef: "meta-approval-1",
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
  return { registry, state: createOrchestratorState() };
}

function paidNotice(overrides: Partial<PaymentNotice> = {}): PaymentNotice {
  return {
    eventId: "pay-1",
    type: "payment.paid",
    evidence: "VERIFIED_PROVIDER_EVENT",
    amountIdr: 10000,
    currency: "IDR",
    occurredAt: NOW,
    providerReference: "pay-ref-1",
    sequence: 1,
    ...overrides,
  };
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
    const peeked = readBooking(state, actor("tenant-b"), bookingRef);
    assert.equal(peeked.ok, false);
    if (peeked.ok) return;
    assert.equal(peeked.code, "CROSS_TENANT");
    assert.equal(JSON.stringify(peeked).includes("PRV-"), false);

    const released = releaseTimedOut(state, actor("tenant-b"), "reserve-1");
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

    assert.equal(releaseTimedOut(deps.state, actor("tenant-a"), "reserve-1").ok, true);
    const retried = await reserve(command(), { ...deps, now: NOW });
    assert.equal(retried.code, "TIMEOUT");
    assert.equal(provider.calls.length, 2);
    assert.equal(provider.bookingCount(), 0);
    assert.equal(deps.state.bookings.size, 0);
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
    const first = applyPaymentNotice(emptyLedger(), paidNotice());
    const second = applyPaymentNotice(first.ledger, paidNotice());
    assert.equal(first.effect, "applied");
    assert.equal(first.ledger.status, "PAID");
    assert.equal(second.effect, "duplicate");
    assert.equal(second.ledger.status, "PAID");
    assert.equal(second.ledger.appliedEventIds.length, 1);
  });

  it("does not let an earlier pending notice erase a paid status", () => {
    const paid = applyPaymentNotice(emptyLedger(), paidNotice());
    const pending = applyPaymentNotice(
      paid.ledger,
      paidNotice({ eventId: "pay-pending", type: "payment.pending", sequence: 0 }),
    );
    assert.equal(pending.effect, "ignored_out_of_order");
    assert.equal(pending.ledger.status, "PAID");
    assert.equal(pending.ledger.verifiedPaid, true);
  });

  it("holds a refund that arrives before payment and applies it after the paid event", () => {
    const early = applyPaymentNotice(
      emptyLedger(),
      paidNotice({ eventId: "refund-1", type: "payment.refunded", sequence: 2 }),
    );
    assert.equal(early.effect, "queued_out_of_order");
    assert.equal(early.ledger.status, "NOT_STARTED");
    assert.equal(early.ledger.verifiedPaid, false);
    const settled = applyPaymentNotice(early.ledger, paidNotice());
    assert.equal(settled.effect, "applied");
    assert.equal(settled.ledger.status, "REFUNDED");
    assert.equal(settled.ledger.verifiedPaid, true);
    assert.equal(settled.ledger.refundedIdr, 10000);
  });

  it("rejects unverified evidence and keeps partial refunds cumulative", () => {
    const screenshot = applyPaymentNotice(emptyLedger(), paidNotice({ evidence: "SCREENSHOT" }));
    assert.equal(screenshot.effect, "rejected_evidence");
    assert.equal(screenshot.ledger.status, "NOT_STARTED");

    const redirect = applyPaymentNotice(emptyLedger(), paidNotice({ eventId: "redir", evidence: "REDIRECT" }));
    assert.equal(redirect.ledger.status, "NOT_STARTED");

    const paid = applyPaymentNotice(emptyLedger(), paidNotice());
    const partial = applyPaymentNotice(
      paid.ledger,
      paidNotice({ eventId: "partial-1", type: "payment.partially_refunded", amountIdr: 4000 }),
    );
    const repeated = applyPaymentNotice(
      partial.ledger,
      paidNotice({ eventId: "partial-2", type: "payment.partially_refunded", amountIdr: 4000 }),
    );
    assert.equal(partial.ledger.status, "PARTIALLY_REFUNDED");
    assert.equal(repeated.effect, "duplicate");
    assert.equal(repeated.ledger.refundedIdr, 4000);
    const full = applyPaymentNotice(
      repeated.ledger,
      paidNotice({ eventId: "refund-full", type: "payment.refunded", amountIdr: 10000 }),
    );
    assert.equal(full.ledger.status, "REFUNDED");
    const chargeback = applyPaymentNotice(paid.ledger, paidNotice({ eventId: "cb-1", type: "payment.chargeback" }));
    assert.equal(chargeback.ledger.status, "CHARGEBACK");
    assert.equal(estimateCountsAsRevenue(), false);
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
    const paid = recordPayment(deps.state, actor("tenant-a"), transactionRef, paidNotice(), NOW);
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
    const paid = recordPayment(deps.state, actor("tenant-a"), transactionRef, paidNotice(), NOW);
    assert.equal(paid.ok, true);
    const cancelled = await cancelReservation(
      { actor: actor("tenant-a"), bookingRef, idempotencyKey: "cancel-1" },
      { ...deps, now: NOW },
    );
    assert.equal(cancelled.booking?.state, "CANCELLED");
    assert.equal(deps.state.ledgers.get(transactionRef)?.status, "PAID");
    const refunded = recordPayment(
      deps.state,
      actor("tenant-a"),
      transactionRef,
      paidNotice({ eventId: "refund-1", type: "payment.refunded" }),
      NOW,
    );
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
      approvalEvidenceRef: "meta-approval-1",
    });
    assert.equal(unknown.transactional, "DENY");
    assert.equal(unknown.leadCapture, "ALLOW");

    const service = evaluateEligibility({
      merchantEligibility: "ELIGIBLE",
      offeringCategory: "SERVICE",
      experience: "WHATSAPP_FLOW",
      approvalEvidenceRef: "meta-approval-1",
    });
    assert.equal(service.transactional, "DENY");

    const flowTicket = evaluateEligibility({
      merchantEligibility: "ELIGIBLE",
      offeringCategory: "ADMISSION_TICKET",
      experience: "WHATSAPP_FLOW",
      approvalEvidenceRef: "meta-approval-1",
    });
    assert.equal(flowTicket.transactional, "DENY");
    assert.match(flowTicket.reasons[0], /Flow/);

    const catalogGoods = evaluateEligibility({
      merchantEligibility: "ELIGIBLE",
      offeringCategory: "GENERAL_GOODS",
      experience: "WHATSAPP_CATALOG",
      approvalEvidenceRef: "meta-approval-1",
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
    assert.equal(catalog.intent.intentType, "PRODUCT_ORDER");
    assert.equal(catalog.intent.commerceOrderRef, "CO-1");
    assert.equal(catalog.confirmed, false);
    assert.equal(catalog.createsReservation, false);
    assert.equal(catalog.bookingState, null);
    assert.equal(flow.intent.intentType, "STRUCTURED_RESPONSE");
    assert.equal(flow.confirmed, false);
    assert.equal(flow.createsReservation, false);
    assert.equal(selection.intent.intentType, "BOOKING_REQUEST");
    assert.equal(selection.bookingState, null);
    assert.equal(selection.confirmed, false);
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
  it("requires a matching signature, tenant, and provider", () => {
    const rawBody = JSON.stringify({ eventId: "evt-1" });
    const signature = signWebhook(SECRET, rawBody, NOW);
    const accepted = assessWebhook({
      providerId: "provider-a",
      tenantId: "tenant-a",
      eventId: "evt-1",
      eventType: "payment.paid",
      occurredAt: NOW,
      nowIso: NOW,
      signature,
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

    const unsigned = assessWebhook({
      providerId: "provider-a",
      tenantId: "tenant-a",
      eventId: "evt-1",
      eventType: "payment.paid",
      occurredAt: NOW,
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
      providerId: "provider-a",
      tenantId: "",
      eventId: "evt-1",
      eventType: "payment.paid",
      occurredAt: NOW,
      nowIso: NOW,
      signature,
      secret: SECRET,
      rawBody,
      seenEventIds: [],
      sequence: null,
      lastSequence: null,
    });
    assert.equal(missingTenant.ok, false);

    const duplicate = assessWebhook({
      providerId: "provider-a",
      tenantId: "tenant-a",
      eventId: "evt-1",
      eventType: "booking.confirmed",
      occurredAt: NOW,
      nowIso: NOW,
      signature,
      secret: SECRET,
      rawBody,
      seenEventIds: ["evt-1"],
      sequence: 2,
      lastSequence: 1,
    });
    assert.equal(duplicate.ok, true);
    if (!duplicate.ok) return;
    assert.equal(duplicate.duplicate, true);

    const stale = assessWebhook({
      providerId: "provider-a",
      tenantId: "tenant-a",
      eventId: "evt-2",
      eventType: "booking.confirmed",
      occurredAt: "2026-10-25T09:00:00.000Z",
      nowIso: NOW,
      signature: signWebhook(SECRET, rawBody, "2026-10-25T09:00:00.000Z"),
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
    for (const file of files) {
      const text = readFileSync(join(here, file), "utf8");
      assert.equal(text.includes("@prisma/client"), false, file);
      assert.equal(text.includes("prisma."), false, file);
      assert.equal(text.includes("items_batch"), false, file);
      assert.equal(text.includes("process.env"), false, file);
      assert.equal(text.includes("fetch("), false, file);
      assert.equal(text.includes("graph.facebook.com"), false, file);
    }
  });
});

describe("registry", () => {
  it("does not resolve another tenant's provider id", () => {
    const registry: ProviderRegistry = createRegistry();
    const provider = createMockProvider({ boundTenantId: "tenant-a", providerId: "shared-name", mode: "MANUAL" });
    registry.register({ tenantId: "tenant-a", locationId: "loc-1", providerId: "shared-name", mode: "MANUAL", provider });
    assert.equal(registry.resolve({ tenantId: "tenant-b", locationId: "loc-1" }, "shared-name").ok, false);
    assert.equal(registry.resolve({ tenantId: "tenant-a", locationId: "loc-2" }, "shared-name").ok, false);
    assert.equal(registry.resolve({ tenantId: "tenant-a", locationId: "loc-1" }, "shared-name").ok, true);
  });
});
