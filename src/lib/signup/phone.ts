import { canonPhone } from "@/lib/conversations/identity";

/** Signup WhatsApp: 08 / +62 / 62 → canonical 62… */
export function parseSignupPhone(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  const phone = canonPhone(s);
  if (!/^62[1-9]\d{8,12}$/.test(phone)) return null;
  return phone;
}
