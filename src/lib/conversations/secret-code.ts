/**
 * WhatsApp pairing / verification copy. If this matches, do not create a
 * customer-book row and do not persist the body. Never log the raw text.
 */
export function isSecretCodeMessage(body: string): boolean {
  const t = (body || "").trim();
  if (t.length < 8) return false;
  const s = t.toLowerCase();
  if (/don['’]?t share (it|this|the code|this code)/i.test(s)) return true;
  if (/do not share (it|this|this code)/i.test(s)) return true;
  if (/jangan (bagikan|sebarkan|share)/i.test(s)) return true;
  if (/is your (whatsapp|facebook|instagram|meta) code/i.test(s)) return true;
  if (/(whatsapp|facebook) code/i.test(s) && /\d{3,}/.test(s)) return true;
  if (/(kode|code)\s+(whatsapp|verifikasi|otp|pairing)/i.test(s)) return true;
  if (/pairing code/i.test(s)) return true;
  if (/\b\d{3}[- ]\d{3}\b/.test(s) && /(code|kode|otp|pin)/i.test(s)) return true;
  return false;
}
