import { createHash } from "node:crypto";

/** Stable id from caller-supplied material. The result does not contain a phone number. */
export function refFromMaterial(prefix: string, material: string): string {
  const hex = createHash("sha256").update(material).digest("hex").slice(0, 12).toUpperCase();
  return `${prefix}-${hex}`;
}

export function stableHash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

/**
 * Reject using a phone number as the only correlation key.
 * Numeric order and booking references are allowed when they include a prefix.
 */
export function phoneCorrelation(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/[A-Za-z]/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}
