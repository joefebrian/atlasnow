import { createHash, timingSafeEqual } from "node:crypto";
import { PRODUCT } from "@/lib/yola/catalog";
import { livePaymentsEnabled } from "@/lib/yola/config";

export type PaymentOutcome = "PAID" | "EXPIRED" | "FAILED";

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function tokenMatches(presented: string, expected: string) {
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function paymentMode(): "sandbox" | "live" {
  return livePaymentsEnabled() ? "live" : "sandbox";
}

/** Live Xendit invoice creation is not called. Sandbox is the only mode while the flag is false. */
export function xenditChargeAllowed() {
  return false;
}

export function amountAccepted(amount: number, currency: string) {
  return amount === PRODUCT.priceIdr && currency === PRODUCT.currency;
}

export function mapProviderStatus(status: string): PaymentOutcome | null {
  const value = status.toUpperCase();
  if (value === "PAID" || value === "SUCCEEDED" || value === "SETTLED") return "PAID";
  if (value === "EXPIRED") return "EXPIRED";
  if (value === "FAILED" || value === "VOIDED") return "FAILED";
  return null;
}

export function parseXenditBody(body: unknown): {
  referenceId: string;
  eventId: string;
  outcome: PaymentOutcome | null;
  amount: number;
  currency: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const referenceId = typeof row.reference_id === "string" ? row.reference_id : typeof row.external_id === "string" ? row.external_id : "";
  const eventId = typeof row.id === "string" ? row.id : "";
  const status = typeof row.status === "string" ? row.status : "";
  const amount = typeof row.amount === "number" ? row.amount : Number.NaN;
  const currency = typeof row.currency === "string" ? row.currency : "";
  if (!referenceId || !eventId) return null;
  return { referenceId, eventId, outcome: mapProviderStatus(status), amount, currency };
}
