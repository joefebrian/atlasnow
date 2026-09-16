import { LEGAL_CONTACT_EMAIL, LEGAL_PRODUCT } from "@/lib/legal/copy";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function extractEmailAddress(raw: string): string {
  const s = raw.trim();
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  return EMAIL_RE.test(extractEmailAddress(raw));
}

/** Gmail stores mail you send to yourself in Sent, not Inbox. */
export function isSelfSend(fromOrUser: string, to: string): boolean {
  const a = extractEmailAddress(fromOrUser);
  const b = extractEmailAddress(to);
  return Boolean(a && b && a === b);
}

export function formatFromHeader(from: string): string {
  const trimmed = from.trim();
  if (!trimmed) return `${LEGAL_PRODUCT} <${LEGAL_CONTACT_EMAIL}>`;
  if (trimmed.includes("<")) return trimmed;
  if (isValidEmail(trimmed)) return `${LEGAL_PRODUCT} <${trimmed}>`;
  return `${LEGAL_PRODUCT} <${LEGAL_CONTACT_EMAIL}>`;
}

export function resolveContactTo(configuredTo: string | undefined | null): string {
  const to = (configuredTo || "").trim();
  if (to && isValidEmail(to)) return extractEmailAddress(to);
  return LEGAL_CONTACT_EMAIL;
}
