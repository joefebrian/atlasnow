import type { TransactionState } from "./types";

/**
 * Transaction lifecycle. Independent of booking state and payment state.
 * PENDING_RESOLUTION means a provider call timed out and must be resolved before a retry.
 */
export const TRANSACTION_TRANSITIONS: Record<TransactionState, readonly TransactionState[]> = {
  OPEN: ["IN_PROGRESS", "PENDING_RESOLUTION", "COMMITTED", "FAILED", "CLOSED"],
  IN_PROGRESS: ["PENDING_RESOLUTION", "COMMITTED", "FAILED", "CLOSED"],
  PENDING_RESOLUTION: ["IN_PROGRESS", "COMMITTED", "FAILED"],
  COMMITTED: ["CLOSED"],
  CLOSED: [],
  FAILED: [],
};

export type TransactionTransition =
  | { ok: true; from: TransactionState; to: TransactionState }
  | { ok: false; code: "INVALID_TRANSITION" | "TERMINAL"; from: TransactionState; to: TransactionState };

export function transitionTransaction(from: TransactionState, to: TransactionState): TransactionTransition {
  if (from === to) return { ok: false, code: "INVALID_TRANSITION", from, to };
  if (TRANSACTION_TRANSITIONS[from].length === 0) return { ok: false, code: "TERMINAL", from, to };
  if (!TRANSACTION_TRANSITIONS[from].includes(to)) return { ok: false, code: "INVALID_TRANSITION", from, to };
  return { ok: true, from, to };
}
