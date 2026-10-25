import type { PaymentState } from "./types";
import { isPaymentState } from "./types";

/**
 * Maps existing commerce payment words onto the orchestrator vocabulary.
 * This does not read or write CommerceOrder. Milestone C capture stays off.
 *
 * CommerceOrder.paymentStatus NOT_INITIATED and the payments-PRD order status OPEN
 * are both "no verified attempt". REVIEW is a catalog validation result, not a payment.
 * Payments-PRD DISPUTED maps to CHARGEBACK. Unpaid CANCELLED maps to FAILED, not a refund.
 */
export function mapCommercePaymentStatus(status: string): PaymentState {
  if (status === "NOT_INITIATED" || status === "OPEN" || status === "REVIEW") return "NOT_STARTED";
  if (status === "LINK_CREATED") return "PENDING";
  if (status === "DISPUTED") return "CHARGEBACK";
  if (status === "CANCELLED") return "FAILED";
  if (isPaymentState(status)) return status;
  return "NOT_STARTED";
}

/** A WhatsApp catalog order is not a booking confirmation. */
export function catalogOrderConfirmsBooking(): false {
  return false;
}
