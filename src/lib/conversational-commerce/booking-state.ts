import type { BookingState } from "./types";

/**
 * Allowed booking moves.
 * HELD is optional. A provider that cannot hold skips that state.
 * CONFIRMED does not imply a payment status.
 */
export const BOOKING_TRANSITIONS: Record<BookingState, readonly BookingState[]> = {
  REQUESTED: ["HELD", "CONFIRMED", "REJECTED", "EXPIRED", "CANCELLED"],
  HELD: ["CONFIRMED", "REJECTED", "EXPIRED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export type BookingTransition =
  | { ok: true; from: BookingState; to: BookingState }
  | { ok: false; code: "INVALID_TRANSITION" | "HOLD_UNSUPPORTED" | "TERMINAL"; from: BookingState; to: BookingState };

export function transitionBooking(
  from: BookingState,
  to: BookingState,
  capabilities: { supportsHold: boolean },
): BookingTransition {
  if (from === to) {
    return { ok: false, code: "INVALID_TRANSITION", from, to };
  }
  if (BOOKING_TRANSITIONS[from].length === 0) {
    return { ok: false, code: "TERMINAL", from, to };
  }
  if (to === "HELD" && !capabilities.supportsHold) {
    return { ok: false, code: "HOLD_UNSUPPORTED", from, to };
  }
  if (!BOOKING_TRANSITIONS[from].includes(to)) {
    return { ok: false, code: "INVALID_TRANSITION", from, to };
  }
  return { ok: true, from, to };
}

export function bookingOccupiesCapacity(state: BookingState): boolean {
  return state === "HELD" || state === "CONFIRMED";
}
