import { createHmac, timingSafeEqual } from "node:crypto";
import type { BookingState } from "./types";
import { transitionBooking } from "./booking-state";

export const INBOUND_EVENT_TYPES = [
  "booking.created",
  "booking.confirmed",
  "booking.cancelled",
  "booking.rescheduled",
  "booking.expired",
  "payment.pending",
  "payment.paid",
  "payment.failed",
  "payment.expired",
  "payment.refunded",
  "payment.partially_refunded",
  "payment.chargeback",
] as const;
export type InboundEventType = (typeof INBOUND_EVENT_TYPES)[number];

const MAX_SKEW_MS = 5 * 60 * 1000;

export type WebhookAssessment =
  | { ok: true; duplicate: boolean; outOfOrder: boolean; eventType: InboundEventType }
  | { ok: false; reason: "UNSIGNED" | "MISSING_PROVIDER" | "MISSING_TENANT" | "MISSING_EVENT" | "REPLAY" | "UNSUPPORTED_EVENT" };

/**
 * Gate for a future provider webhook. No HTTP route calls this.
 * A non-empty signature is not enough. The HMAC must match the raw body and timestamp.
 * Tenant and provider identity are required before the body is trusted.
 */
export function assessWebhook(input: {
  providerId: string;
  tenantId: string;
  eventId: string;
  eventType: string;
  occurredAt: string;
  nowIso: string;
  signature: string | null;
  secret: string;
  rawBody: string;
  seenEventIds: readonly string[];
  sequence: number | null;
  lastSequence: number | null;
}): WebhookAssessment {
  if (!input.providerId.trim()) return { ok: false, reason: "MISSING_PROVIDER" };
  if (!input.tenantId.trim()) return { ok: false, reason: "MISSING_TENANT" };
  if (!input.eventId.trim()) return { ok: false, reason: "MISSING_EVENT" };
  if (!input.secret || !signatureMatches(input.secret, input.rawBody, input.occurredAt, input.signature)) {
    return { ok: false, reason: "UNSIGNED" };
  }
  const occurred = Date.parse(input.occurredAt);
  const now = Date.parse(input.nowIso);
  if (!Number.isFinite(occurred) || !Number.isFinite(now) || Math.abs(now - occurred) > MAX_SKEW_MS) {
    return { ok: false, reason: "REPLAY" };
  }
  if (!(INBOUND_EVENT_TYPES as readonly string[]).includes(input.eventType)) {
    return { ok: false, reason: "UNSUPPORTED_EVENT" };
  }
  const eventType = input.eventType as InboundEventType;
  const duplicate = input.seenEventIds.includes(input.eventId);
  const outOfOrder =
    input.sequence != null && input.lastSequence != null && input.sequence < input.lastSequence;
  return { ok: true, duplicate, outOfOrder, eventType };
}

export function signWebhook(secret: string, rawBody: string, timestamp: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

function signatureMatches(secret: string, rawBody: string, timestamp: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = signWebhook(secret, rawBody, timestamp);
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type BookingEventPlan =
  | { ok: true; applied: false; reason: "RESCHEDULE_NOT_IN_M1A" | "DUPLICATE" | "CREATED_ALREADY_TRACKED" }
  | { ok: true; applied: true; to: BookingState }
  | { ok: false; code: "MISSING_REFERENCE" | "INVALID_TRANSITION" | "HOLD_UNSUPPORTED" | "TERMINAL" | "UNSUPPORTED_EVENT" };

/**
 * Plans a booking transition from an already authenticated event.
 * Reschedule is recognized and not applied. No slot is invented.
 * Confirmation of an external booking requires a provider reference.
 */
export function planBookingEvent(input: {
  eventType: InboundEventType;
  duplicate: boolean;
  from: BookingState | null;
  providerReference: string | null;
  supportsHold: boolean;
  external: boolean;
}): BookingEventPlan {
  if (input.duplicate) return { ok: true, applied: false, reason: "DUPLICATE" };
  if (!input.eventType.startsWith("booking.")) return { ok: false, code: "UNSUPPORTED_EVENT" };
  if (input.eventType === "booking.rescheduled") {
    return { ok: true, applied: false, reason: "RESCHEDULE_NOT_IN_M1A" };
  }
  if (input.eventType === "booking.created") {
    if (input.from) return { ok: true, applied: false, reason: "CREATED_ALREADY_TRACKED" };
    return { ok: true, applied: true, to: "REQUESTED" };
  }
  if (!input.from) return { ok: false, code: "INVALID_TRANSITION" };
  const target = targetState(input.eventType);
  if (!target) return { ok: false, code: "UNSUPPORTED_EVENT" };
  if ((target === "CONFIRMED" || target === "CANCELLED" || target === "EXPIRED") && input.external && !input.providerReference) {
    return { ok: false, code: "MISSING_REFERENCE" };
  }
  const move = transitionBooking(input.from, target, { supportsHold: input.supportsHold });
  if (!move.ok) return { ok: false, code: move.code };
  return { ok: true, applied: true, to: target };
}

function targetState(eventType: InboundEventType): BookingState | null {
  if (eventType === "booking.confirmed") return "CONFIRMED";
  if (eventType === "booking.cancelled") return "CANCELLED";
  if (eventType === "booking.expired") return "EXPIRED";
  return null;
}
