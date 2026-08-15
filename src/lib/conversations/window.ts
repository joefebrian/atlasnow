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
