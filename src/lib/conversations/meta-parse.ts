export type MetaInboundEvent = {
  provider: "FACEBOOK" | "INSTAGRAM";
  assetId: string;
  senderId: string;
  externalId: string;
  body: string;
  fromMe: boolean;
  sentAt: Date;
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
      events.push({
        provider,
        assetId,
        senderId,
        externalId: `meta:${mid}`,
        body: messageBody(message),
        fromMe: isEcho,
        sentAt: new Date(ts < 1e12 ? ts * 1000 : ts),
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
        events.push({
          provider,
          assetId,
          senderId,
          externalId: `meta:${mid}`,
          body: messageBody(message),
          fromMe: isEcho,
          sentAt: new Date(ts < 1e12 ? ts * 1000 : ts),
        });
      }
    }
  }
  return { events };
}

function messageBody(message: Record<string, unknown>): string {
  const text = str(message.text).trim();
  if (text) return text;
  const atts = Array.isArray(message.attachments) ? message.attachments : [];
  const types = atts
    .map((a) => str(rec(a)?.type))
    .filter(Boolean);
  if (types.length) return `[${types.join(",")}]`;
  return "";
}
