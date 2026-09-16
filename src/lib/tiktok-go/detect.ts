/** TikTok GO till QR / payload. Official codes start with TT-. */
export function isTikTokGoPayload(raw: string): boolean {
  const s = (raw || "").trim();
  if (!s) return false;
  if (/^TT-/i.test(s)) return true;
  if (/^tiktok[-_]?go:/i.test(s)) return true;
  return false;
}

export function isGoDemoPayload(raw: string): boolean {
  return /^TT-DEMO-/i.test((raw || "").trim());
}

export function qrInfoFromRaw(raw: string): string {
  return (raw || "").trim();
}
