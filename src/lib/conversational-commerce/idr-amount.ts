/**
 * Whole-IDR amounts stored as PostgreSQL BIGINT.
 * Writes use the catalog bound from parsePrice (1_000_000_000).
 * Reads reject any bigint that is not a safe integer. They do not coerce.
 */

export class AmountRejected extends Error {
  constructor(message = "Amount is not a safe whole rupiah value.") {
    super(message);
    this.name = "AmountRejected";
  }
}

/** Same ceiling as parsePrice in src/lib/commerce/validate.ts. */
export const MAX_CATALOG_IDR = BigInt(1_000_000_000);
export const MAX_SAFE_IDR = BigInt(Number.MAX_SAFE_INTEGER);

export function idrToBigInt(value: number, bound: "catalog" | "safe" = "catalog"): bigint {
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isSafeInteger(value) || value < 0) {
    throw new AmountRejected();
  }
  const amount = BigInt(value);
  const max = bound === "catalog" ? MAX_CATALOG_IDR : MAX_SAFE_IDR;
  if (amount > max) throw new AmountRejected();
  return amount;
}

export function idrFromBigInt(value: bigint): number {
  if (typeof value !== "bigint" || value < BigInt(0) || value > MAX_SAFE_IDR) throw new AmountRejected();
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || BigInt(amount) !== value) throw new AmountRejected();
  return amount;
}

export function assertSafeSum(value: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isSafeInteger(value) || value < 0) {
    throw new AmountRejected("Amount sum is not a safe whole rupiah value.");
  }
  return value;
}
