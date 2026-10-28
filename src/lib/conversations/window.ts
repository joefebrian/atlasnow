export const CONVERSATION_GAP_MS = 24 * 60 * 60 * 1000;

export function shouldStartNewConversation(
  lastMessageAt: Date | null,
  now: Date
): boolean {
  if (!lastMessageAt) return true;
  return now.getTime() - lastMessageAt.getTime() >= CONVERSATION_GAP_MS;
}

export function previewBody(body: string, max = 160): string {
  const t = (body || "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max);
}

const STORED_LABELS: Record<string, string> = {
  "[image]": "Image",
  "[audio]": "Audio",
  "[video]": "Video",
  "[document]": "Document",
  "[sticker]": "Sticker",
  "[location]": "Location",
  "[contacts]": "Contact card",
  "[interactive]": "Button reply",
  "[button]": "Button reply",
  "[reaction]": "Reaction",
  "[unsupported]": "Unsupported WhatsApp message",
  "[unknown]": "Unsupported WhatsApp message",
  "[media_placeholder]": "Media",
};

/** Label a stored placeholder. Customer text is left as stored. */
export function displayStoredBody(body: string): string {
  const trimmed = (body || "").trim();
  return STORED_LABELS[trimmed] || body;
}
