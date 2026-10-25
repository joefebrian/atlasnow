import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentState } from "./types";

/**
 * Evidence that may move money status.
 * A redirect, chat message, screenshot, or customer claim cannot verify payment.
 */
export const PAYMENT_EVIDENCE = [
  "VERIFIED_PROVIDER_EVENT",
  "TRUSTED_MERCHANT_EVENT",
  "RECONCILED_RECORD",
  "REDIRECT",
  "WHATSAPP_MESSAGE",
  "SCREENSHOT",
  "CUSTOMER_CONFIRMATION",
] as const;
export type PaymentEvidenceKind = (typeof PAYMENT_EVIDENCE)[number];

export const PAYMENT_NOTICE_TYPES = [
  "payment.pending",
  "payment.paid",
  "payment.failed",
  "payment.expired",
  "payment.refunded",
  "payment.partially_refunded",
  "payment.chargeback",
] as const;
export type PaymentNoticeType = (typeof PAYMENT_NOTICE_TYPES)[number];

/** Inbound claim. The evidence enum is not proof. */
export type RawPaymentNotice = {
  eventId: string;
  type: PaymentNoticeType;
  evidence: PaymentEvidenceKind;
  /** Whole IDR. For a refund notice this is the cumulative refunded total, not a second delta. */
  amountIdr: number;
  currency: "IDR";
  occurredAt: string;
  providerReference: string | null;
  sequence: number | null;
  tenantId: string;
  providerId: string;
  attemptRef: string;
  transactionRef: string;
};

/**
 * HMAC over the binding fields, including occurredAt and sequence.
 * Signed with the payment connection secret after the gateway's own
 * webhook check has already passed. This HMAC is not that gateway check.
 */
export type PaymentProof = {
  tenantId: string;
  providerId: string;
  attemptRef: string;
  transactionRef: string;
  providerReference: string;
  currency: "IDR";
  amountIdr: number;
  eventId: string;
  type: PaymentNoticeType;
  occurredAt: string;
  sequence: number | null;
  signature: string;
};

/** Amount and identity AtlasNow already stored for the attempt. Not taken from the notice. */
export type PaymentExpectation = {
  tenantId: string;
  providerId: string;
  attemptRef: string;
  transactionRef: string;
  currency: "IDR";
  amountIdr: number;
};

/** Internal event. Only verifyPaymentNotice may construct one. */
export type VerifiedPaymentEvent = {
  eventId: string;
  type: PaymentNoticeType;
  amountIdr: number;
  currency: "IDR";
  occurredAt: string;
  providerReference: string;
  sequence: number | null;
  tenantId: string;
  providerId: string;
  attemptRef: string;
  transactionRef: string;
};

export type PaymentVerifyResult =
  | { ok: true; event: VerifiedPaymentEvent }
  | { ok: false; code: "UNVERIFIED" | "MISMATCH" | "REJECTED_EVIDENCE" };

export function signPaymentProof(secret: string, fields: Omit<PaymentProof, "signature">): string {
  return createHmac("sha256", secret).update(proofMaterial(fields)).digest("hex");
}

/**
 * Turns a raw notice into an internal event only when the proof matches the
 * stored attempt. A caller-supplied evidence label is not enough.
 * occurredAt and sequence are trusted only when they are inside the signed proof.
 * An empty provider reference cannot verify a payment.
 * This proof is not Xendit, Midtrans, or any other gateway signature.
 */
export function verifyPaymentNotice(input: {
  notice: RawPaymentNotice;
  proof: PaymentProof | null;
  secret: string;
  expectation: PaymentExpectation;
}): PaymentVerifyResult {
  if (!evidenceCanVerifyPaid(input.notice.evidence)) return { ok: false, code: "REJECTED_EVIDENCE" };
  if (!input.proof || !input.secret || !proofMatches(input.secret, input.proof)) return { ok: false, code: "UNVERIFIED" };
  const proof = input.proof;
  const notice = input.notice;
  const expected = input.expectation;
  if (proof.currency !== "IDR" || notice.currency !== "IDR" || expected.currency !== "IDR") {
    return { ok: false, code: "MISMATCH" };
  }
  if (
    proof.tenantId !== expected.tenantId ||
    notice.tenantId !== expected.tenantId ||
    proof.providerId !== expected.providerId ||
    notice.providerId !== expected.providerId ||
    proof.attemptRef !== expected.attemptRef ||
    notice.attemptRef !== expected.attemptRef ||
    proof.transactionRef !== expected.transactionRef ||
    notice.transactionRef !== expected.transactionRef ||
    proof.eventId !== notice.eventId ||
    proof.type !== notice.type ||
    proof.providerReference !== notice.providerReference ||
    proof.amountIdr !== notice.amountIdr ||
    proof.occurredAt !== notice.occurredAt ||
    proof.sequence !== notice.sequence
  ) {
    return { ok: false, code: "MISMATCH" };
  }
  if (!proof.providerReference.trim()) return { ok: false, code: "MISMATCH" };
  if (!Number.isFinite(Date.parse(proof.occurredAt))) return { ok: false, code: "MISMATCH" };
  if (proof.sequence != null && (!Number.isSafeInteger(proof.sequence) || proof.sequence < 0)) {
    return { ok: false, code: "MISMATCH" };
  }
  if (!amountMatchesExpectation(notice.type, notice.amountIdr, expected.amountIdr)) {
    return { ok: false, code: "MISMATCH" };
  }
  return {
    ok: true,
    event: {
      eventId: notice.eventId,
      type: notice.type,
      amountIdr: notice.amountIdr,
      currency: "IDR",
      occurredAt: notice.occurredAt,
      providerReference: proof.providerReference,
      sequence: notice.sequence,
      tenantId: expected.tenantId,
      providerId: expected.providerId,
      attemptRef: expected.attemptRef,
      transactionRef: expected.transactionRef,
    },
  };
}

function amountMatchesExpectation(type: PaymentNoticeType, amountIdr: number, expectedAmountIdr: number): boolean {
  if (!Number.isSafeInteger(amountIdr) || !Number.isSafeInteger(expectedAmountIdr) || expectedAmountIdr < 1) return false;
  if (type === "payment.partially_refunded") return amountIdr > 0 && amountIdr < expectedAmountIdr;
  if (type === "payment.chargeback") return amountIdr === expectedAmountIdr;
  return amountIdr === expectedAmountIdr;
}

function proofMaterial(fields: Omit<PaymentProof, "signature">): string {
  return [
    fields.tenantId,
    fields.providerId,
    fields.attemptRef,
    fields.transactionRef,
    fields.providerReference,
    fields.currency,
    String(fields.amountIdr),
    fields.eventId,
    fields.type,
    fields.occurredAt,
    fields.sequence == null ? "" : String(fields.sequence),
  ].join("|");
}

function proofMatches(secret: string, proof: PaymentProof): boolean {
  const expected = signPaymentProof(secret, proof);
  const left = Buffer.from(expected);
  const right = Buffer.from(proof.signature);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type PaymentEffect =
  | "applied"
  | "duplicate"
  | "ignored_out_of_order"
  | "queued_out_of_order"
  | "rejected_evidence"
  | "rejected_transition"
  | "rejected_amount";

export type PaymentLedger = {
  status: PaymentState;
  amountIdr: number | null;
  refundedIdr: number;
  currency: "IDR" | null;
  verifiedPaid: boolean;
  appliedEventIds: string[];
  rejectedEventIds: string[];
  queued: VerifiedPaymentEvent[];
  providerReference: string | null;
};

export function emptyLedger(): PaymentLedger {
  return {
    status: "NOT_STARTED",
    amountIdr: null,
    refundedIdr: 0,
    currency: null,
    verifiedPaid: false,
    appliedEventIds: [],
    rejectedEventIds: [],
    queued: [],
    providerReference: null,
  };
}

export function evidenceCanVerifyPaid(kind: PaymentEvidenceKind): boolean {
  return kind === "VERIFIED_PROVIDER_EVENT" || kind === "TRUSTED_MERCHANT_EVENT" || kind === "RECONCILED_RECORD";
}

export function applyPaymentNotice(
  current: PaymentLedger,
  notice: VerifiedPaymentEvent,
): { ledger: PaymentLedger; effect: PaymentEffect } {
  if (seen(current, notice.eventId)) return { ledger: current, effect: "duplicate" };

  if (notice.currency !== "IDR" || !Number.isSafeInteger(notice.amountIdr) || notice.amountIdr < 0) {
    return { ledger: reject(current, notice.eventId), effect: "rejected_amount" };
  }

  if (notice.type === "payment.refunded" || notice.type === "payment.partially_refunded" || notice.type === "payment.chargeback") {
    if (current.status !== "PAID" && current.status !== "PARTIALLY_REFUNDED") {
      return { ledger: enqueue(current, notice), effect: "queued_out_of_order" };
    }
  }

  const applied = applyOne(current, notice);
  if (applied.effect !== "applied") return applied;
  return flush(applied.ledger, applied.effect);
}

function applyOne(current: PaymentLedger, notice: VerifiedPaymentEvent): { ledger: PaymentLedger; effect: PaymentEffect } {
  const next = clone(current);
  next.currency = "IDR";
  if (notice.providerReference) next.providerReference = notice.providerReference;

  if (notice.type === "payment.pending") {
    if (next.status === "PAID" || next.status === "PARTIALLY_REFUNDED" || next.status === "REFUNDED" || next.status === "CHARGEBACK") {
      next.appliedEventIds.push(notice.eventId);
      return { ledger: next, effect: "ignored_out_of_order" };
    }
    if (next.status === "PENDING") {
      next.appliedEventIds.push(notice.eventId);
      return { ledger: next, effect: "duplicate" };
    }
    if (next.status !== "NOT_STARTED") {
      next.rejectedEventIds.push(notice.eventId);
      return { ledger: next, effect: "rejected_transition" };
    }
    next.status = "PENDING";
    next.amountIdr = notice.amountIdr;
    next.appliedEventIds.push(notice.eventId);
    return { ledger: next, effect: "applied" };
  }

  if (notice.type === "payment.paid") {
    if (!notice.providerReference.trim()) {
      next.rejectedEventIds.push(notice.eventId);
      return { ledger: next, effect: "rejected_amount" };
    }
    if (notice.amountIdr < 1) {
      next.rejectedEventIds.push(notice.eventId);
      return { ledger: next, effect: "rejected_amount" };
    }
    if (next.status === "PAID" && next.amountIdr === notice.amountIdr) {
      next.appliedEventIds.push(notice.eventId);
      return { ledger: next, effect: "duplicate" };
    }
    if (next.status !== "NOT_STARTED" && next.status !== "PENDING") {
      next.appliedEventIds.push(notice.eventId);
      return { ledger: next, effect: "ignored_out_of_order" };
    }
    next.status = "PAID";
    next.amountIdr = notice.amountIdr;
    next.verifiedPaid = true;
    next.appliedEventIds.push(notice.eventId);
    return { ledger: next, effect: "applied" };
  }

  if (notice.type === "payment.failed" || notice.type === "payment.expired") {
    if (next.status !== "NOT_STARTED" && next.status !== "PENDING") {
      next.appliedEventIds.push(notice.eventId);
      return { ledger: next, effect: "ignored_out_of_order" };
    }
    next.status = notice.type === "payment.failed" ? "FAILED" : "EXPIRED";
    next.amountIdr = notice.amountIdr;
    next.appliedEventIds.push(notice.eventId);
    return { ledger: next, effect: "applied" };
  }

  if (notice.type === "payment.chargeback") {
    if (next.status !== "PAID" && next.status !== "PARTIALLY_REFUNDED") {
      next.rejectedEventIds.push(notice.eventId);
      return { ledger: next, effect: "rejected_transition" };
    }
    next.status = "CHARGEBACK";
    next.appliedEventIds.push(notice.eventId);
    return { ledger: next, effect: "applied" };
  }

  return applyRefund(next, notice);
}

function applyRefund(next: PaymentLedger, notice: VerifiedPaymentEvent): { ledger: PaymentLedger; effect: PaymentEffect } {
  const captured = next.amountIdr;
  if (captured == null || captured < 1) {
    next.rejectedEventIds.push(notice.eventId);
    return { ledger: next, effect: "rejected_amount" };
  }
  if (notice.type === "payment.refunded" && notice.amountIdr !== captured) {
    next.rejectedEventIds.push(notice.eventId);
    return { ledger: next, effect: "rejected_amount" };
  }
  const target = notice.type === "payment.refunded" ? captured : notice.amountIdr;
  if (!Number.isSafeInteger(target) || target < 1 || target > captured) {
    next.rejectedEventIds.push(notice.eventId);
    return { ledger: next, effect: "rejected_amount" };
  }
  if (target <= next.refundedIdr) {
    next.appliedEventIds.push(notice.eventId);
    return { ledger: next, effect: "duplicate" };
  }
  if (notice.type === "payment.partially_refunded" && target === captured) {
    next.rejectedEventIds.push(notice.eventId);
    return { ledger: next, effect: "rejected_amount" };
  }
  next.refundedIdr = target;
  next.status = target === captured ? "REFUNDED" : "PARTIALLY_REFUNDED";
  next.appliedEventIds.push(notice.eventId);
  return { ledger: next, effect: "applied" };
}

function flush(ledger: PaymentLedger, effect: PaymentEffect): { ledger: PaymentLedger; effect: PaymentEffect } {
  if (!ledger.queued.length) return { ledger, effect };
  const queued = [...ledger.queued].sort(compareNotice);
  let current: PaymentLedger = { ...ledger, queued: [] };
  for (const notice of queued) {
    const step = applyOne(current, notice);
    current = step.ledger;
  }
  return { ledger: current, effect };
}

function compareNotice(left: VerifiedPaymentEvent, right: VerifiedPaymentEvent): number {
  if (left.sequence != null && right.sequence != null && left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }
  return left.occurredAt.localeCompare(right.occurredAt);
}

function seen(ledger: PaymentLedger, eventId: string): boolean {
  return (
    ledger.appliedEventIds.includes(eventId) ||
    ledger.rejectedEventIds.includes(eventId) ||
    ledger.queued.some((notice) => notice.eventId === eventId)
  );
}

function reject(ledger: PaymentLedger, eventId: string): PaymentLedger {
  const next = clone(ledger);
  next.rejectedEventIds.push(eventId);
  return next;
}

function enqueue(ledger: PaymentLedger, notice: VerifiedPaymentEvent): PaymentLedger {
  const next = clone(ledger);
  next.queued.push({ ...notice });
  return next;
}

/**
 * Transaction status is derived from attempt ledgers. It is not a second place that applies events.
 * Settled funds count once per attempt. REFUNDED and CHARGEBACK add no revenue.
 * A failed or expired attempt does not erase another attempt.
 */
export function aggregateAttemptLedgers(ledgers: readonly PaymentLedger[]): {
  status: PaymentState;
  verifiedPaid: boolean;
  netRevenueIdr: number;
} {
  let net = 0;
  let refundedOnSettled = 0;
  let verifiedPaid = false;
  let chargeback = false;
  let refunded = false;
  let pending = false;
  let failed = false;
  let expired = false;
  for (const ledger of ledgers) {
    if (ledger.verifiedPaid) verifiedPaid = true;
    if (ledger.status === "PAID" || ledger.status === "PARTIALLY_REFUNDED") {
      net += Math.max(0, (ledger.amountIdr ?? 0) - ledger.refundedIdr);
      refundedOnSettled += ledger.refundedIdr;
    } else if (ledger.status === "CHARGEBACK") chargeback = true;
    else if (ledger.status === "REFUNDED") refunded = true;
    else if (ledger.status === "PENDING") pending = true;
    else if (ledger.status === "FAILED") failed = true;
    else if (ledger.status === "EXPIRED") expired = true;
  }
  const status: PaymentState =
    net > 0 && refundedOnSettled > 0
      ? "PARTIALLY_REFUNDED"
      : net > 0
        ? "PAID"
        : chargeback
          ? "CHARGEBACK"
          : refunded
            ? "REFUNDED"
            : pending
              ? "PENDING"
              : failed
                ? "FAILED"
                : expired
                  ? "EXPIRED"
                  : "NOT_STARTED";
  return { status, verifiedPaid, netRevenueIdr: net };
}

function clone(ledger: PaymentLedger): PaymentLedger {
  return {
    ...ledger,
    appliedEventIds: [...ledger.appliedEventIds],
    rejectedEventIds: [...ledger.rejectedEventIds],
    queued: ledger.queued.map((notice) => ({ ...notice })),
  };
}
