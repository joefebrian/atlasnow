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

export type PaymentNotice = {
  eventId: string;
  type: PaymentNoticeType;
  evidence: PaymentEvidenceKind;
  /** Whole IDR. For a refund notice this is the cumulative refunded total, not a second delta. */
  amountIdr: number;
  currency: "IDR";
  occurredAt: string;
  providerReference: string | null;
  sequence: number | null;
};

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
  queued: PaymentNotice[];
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
  notice: PaymentNotice,
): { ledger: PaymentLedger; effect: PaymentEffect } {
  if (seen(current, notice.eventId)) return { ledger: current, effect: "duplicate" };

  if (!evidenceCanVerifyPaid(notice.evidence)) {
    return { ledger: reject(current, notice.eventId), effect: "rejected_evidence" };
  }
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

function applyOne(current: PaymentLedger, notice: PaymentNotice): { ledger: PaymentLedger; effect: PaymentEffect } {
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

function applyRefund(next: PaymentLedger, notice: PaymentNotice): { ledger: PaymentLedger; effect: PaymentEffect } {
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

function compareNotice(left: PaymentNotice, right: PaymentNotice): number {
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

function enqueue(ledger: PaymentLedger, notice: PaymentNotice): PaymentLedger {
  const next = clone(ledger);
  next.queued.push({ ...notice });
  return next;
}

function clone(ledger: PaymentLedger): PaymentLedger {
  return {
    ...ledger,
    appliedEventIds: [...ledger.appliedEventIds],
    rejectedEventIds: [...ledger.rejectedEventIds],
    queued: ledger.queued.map((notice) => ({ ...notice })),
  };
}
