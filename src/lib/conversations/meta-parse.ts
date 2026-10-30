import { blockedMediaFilename, safeMediaFilename } from "./inbox-media";

export type MetaInboundEvent = {
  provider: "FACEBOOK" | "INSTAGRAM";
  assetId: string;
  senderId: string;
  externalId: string;
  body: string;
  fromMe: boolean;
  sentAt: Date;
  attachmentUrl: string | null;
  attachmentFilename: string;
};

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function nestedId(v: unknown): string {
  const o = rec(v);
  return o ? str(o.id) : "";
}

/**
 * Flatten a Meta Messenger / Instagram webhook into inbox events.
 * Delivery/read receipts are dropped. Echoes are outbound (fromMe).
 */
export function parseMetaWebhook(
  body: unknown
): { events: MetaInboundEvent[] } | { error: string } {
  const root = rec(body);
  if (!root) return { error: "invalid_json" };
  const object = str(root.object).toLowerCase();
  const provider: "FACEBOOK" | "INSTAGRAM" =
    object === "instagram" ? "INSTAGRAM" : "FACEBOOK";
  if (object && object !== "page" && object !== "instagram") {
    return { events: [] };
  }
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const events: MetaInboundEvent[] = [];

  for (const raw of entries) {
    const entry = rec(raw);
    if (!entry) continue;
    const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
    for (const item of messaging) {
      const m = rec(item);
      if (!m) continue;
      if (m.delivery || m.read) continue;
      const message = rec(m.message);
      if (!message) continue;
      const mid = str(message.mid);
      if (!mid) continue;
      const isEcho = Boolean(message.is_echo);
      const sender = nestedId(m.sender);
      const recipient = nestedId(m.recipient);
      const assetId = isEcho ? sender || str(entry.id) : recipient || str(entry.id);
      const senderId = isEcho ? recipient : sender;
      if (!assetId || !senderId) continue;
      const ts = typeof m.timestamp === "number" ? m.timestamp : Date.now();
      const attachment = firstAttachment(message);
      events.push({
        provider,
        assetId,
        senderId,
        externalId: `meta:${mid}`,
        body: messageBody(message),
        fromMe: isEcho,
        sentAt: new Date(ts < 1e12 ? ts * 1000 : ts),
        attachmentUrl: attachment?.url || null,
        attachmentFilename: attachment?.filename || "",
      });
    }
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const rawChange of changes) {
      const change = rec(rawChange);
      const value = change ? rec(change.value) : null;
      const nested = value && Array.isArray(value.messaging) ? value.messaging : [];
      for (const item of nested) {
        const m = rec(item);
        if (!m || m.delivery || m.read) continue;
        const message = rec(m.message);
        if (!message) continue;
        const mid = str(message.mid);
        if (!mid) continue;
        const isEcho = Boolean(message.is_echo);
        const sender = nestedId(m.sender);
        const recipient = nestedId(m.recipient);
        const assetId = isEcho ? sender || str(entry.id) : recipient || str(entry.id);
        const senderId = isEcho ? recipient : sender;
        if (!assetId || !senderId) continue;
        const ts = typeof m.timestamp === "number" ? m.timestamp : Date.now();
        const attachment = firstAttachment(message);
      events.push({
          provider,
          assetId,
          senderId,
          externalId: `meta:${mid}`,
          body: messageBody(message),
          fromMe: isEcho,
          sentAt: new Date(ts < 1e12 ? ts * 1000 : ts),
          attachmentUrl: attachment?.url || null,
          attachmentFilename: attachment?.filename || "",
        });
      }
    }
  }
  return { events };
}

const META_KIND: Record<string, string> = {
  image: "image",
  video: "video",
  audio: "audio",
  file: "document",
};

function attachmentList(message: Record<string, unknown>): unknown[] {
  if (Array.isArray(message.attachments)) return message.attachments;
  if (message.attachment) return [message.attachment];
  return [];
}

export function isMetaCdnUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return (
    host === "fbcdn.net" ||
    host.endsWith(".fbcdn.net") ||
    host === "fbsbx.com" ||
    host.endsWith(".fbsbx.com") ||
    host === "cdninstagram.com" ||
    host.endsWith(".cdninstagram.com")
  );
}

function firstAttachment(
  message: Record<string, unknown>
): { url: string; filename: string } | null {
  for (const raw of attachmentList(message)) {
    const att = rec(raw);
    if (!att || !META_KIND[str(att.type)]) continue;
    const payload = rec(att.payload);
    const url = str(payload?.url).trim();
    const filename = safeMediaFilename(str(payload?.name) || str(att.title), "");
    if (filename && blockedMediaFilename(filename)) continue;
    if (!isMetaCdnUrl(url)) continue;
    return { url, filename };
  }
  return null;
}

function messageBody(message: Record<string, unknown>): string {
  const text = str(message.text).trim();
  if (text) return text;
  const labels = attachmentList(message)
    .map((raw) => {
      const att = rec(raw);
      const type = str(att?.type);
      const payload = att ? rec(att.payload) : null;
      const filename = safeMediaFilename(str(payload?.name) || str(att?.title), "");
      if (type === "file" && filename && blockedMediaFilename(filename)) return "blocked";
      return META_KIND[type] || type;
    })
    .filter(Boolean);
  if (labels.length) return `[${labels.join(",")}]`;
  return "";
}
