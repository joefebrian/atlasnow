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

export type WebhookConnection = {
  providerId: string;
  tenantId: string;
};

export type WebhookAssessment =
  | {
      ok: true;
      duplicate: boolean;
      outOfOrder: boolean;
      eventType: InboundEventType;
      /** Durable dedupe key. Persist it per provider connection, not per JSON tenant. */
      dedupeKey: string;
      tenantId: string;
      providerId: string;
    }
  | {
      ok: false;
      reason:
        | "UNSIGNED"
        | "MISSING_PROVIDER"
        | "MISSING_TENANT"
        | "MISSING_EVENT"
        | "REPLAY"
        | "UNSUPPORTED_EVENT"
        | "TENANT_MISMATCH"
        | "PROVIDER_MISMATCH";
    };

/**
 * Gate for a future provider webhook. No HTTP route calls this.
 *
 * `connection` is the stored provider-to-tenant mapping. A tenant or provider
 * id inside the JSON body is untrusted and must not select the merchant.
 * The HMAC covers the authenticated delivery timestamp and the raw body.
 * `occurredAt` is the business event time. A delayed booking or payment event
 * stays acceptable when the delivery timestamp is fresh.
 * `seenEventIds` must be a durable set for `dedupeKey` before this returns duplicate.
 */
export function assessWebhook(input: {
  connection: WebhookConnection;
  /** Untrusted claim copied from the body. Null when the body has no tenant field. */
  claimedTenantId: string | null;
  claimedProviderId?: string | null;
  eventId: string;
  eventType: string;
  /** Business time. Not the replay clock. */
  occurredAt: string;
  /** Authenticated delivery time. Covered by the HMAC. */
  deliveredAt: string;
  nowIso: string;
  signature: string | null;
  secret: string;
  rawBody: string;
  seenEventIds: readonly string[];
  sequence: number | null;
  lastSequence: number | null;
}): WebhookAssessment {
  if (!input.connection.providerId.trim()) return { ok: false, reason: "MISSING_PROVIDER" };
  if (!input.connection.tenantId.trim()) return { ok: false, reason: "MISSING_TENANT" };
  if (!input.eventId.trim()) return { ok: false, reason: "MISSING_EVENT" };
  if (input.claimedTenantId != null && input.claimedTenantId !== input.connection.tenantId) {
    return { ok: false, reason: "TENANT_MISMATCH" };
  }
  if (input.claimedProviderId != null && input.claimedProviderId !== "" && input.claimedProviderId !== input.connection.providerId) {
    return { ok: false, reason: "PROVIDER_MISMATCH" };
  }
  if (!input.secret || !signatureMatches(input.secret, input.rawBody, input.deliveredAt, input.signature)) {
    return { ok: false, reason: "UNSIGNED" };
  }
  const delivered = Date.parse(input.deliveredAt);
  const now = Date.parse(input.nowIso);
  if (!Number.isFinite(delivered) || !Number.isFinite(now) || Math.abs(now - delivered) > MAX_SKEW_MS) {
    return { ok: false, reason: "REPLAY" };
  }
  if (!Number.isFinite(Date.parse(input.occurredAt))) {
    return { ok: false, reason: "UNSUPPORTED_EVENT" };
  }
  if (!(INBOUND_EVENT_TYPES as readonly string[]).includes(input.eventType)) {
    return { ok: false, reason: "UNSUPPORTED_EVENT" };
  }
  const eventType = input.eventType as InboundEventType;
  const dedupeKey = `${input.connection.providerId}:${input.eventId}`;
  const duplicate = input.seenEventIds.includes(input.eventId) || input.seenEventIds.includes(dedupeKey);
  const outOfOrder =
    input.sequence != null && input.lastSequence != null && input.sequence < input.lastSequence;
  return {
    ok: true,
    duplicate,
    outOfOrder,
    eventType,
    dedupeKey,
    tenantId: input.connection.tenantId,
    providerId: input.connection.providerId,
  };
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
