export type ParsedWahaEvent = {
  event: string;
  session: string;
  externalId: string;
  fromMe: boolean;
  body: string;
  sentAt: Date;
  peerRaw: string;
  extraPhone: string | null;
  displayName: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function messageId(payload: Record<string, unknown>): string {
  const id = payload.id;
  if (typeof id === "string" && id) return id;
  const nested = asRecord(id);
  if (nested && typeof nested.id === "string" && nested.id) return nested.id;
  return "";
}

function peerRaw(payload: Record<string, unknown>): string {
  const from = str(payload.from);
  if (from) return from;
  const data = asRecord(payload._data);
  const dataId = data ? asRecord(data.id) : null;
  return dataId ? str(dataId.remote) : "";
}

function extraPhone(payload: Record<string, unknown>): string | null {
  const author = str(payload.author);
  if (/\d{8,}/.test(author) && !author.includes("@lid")) return author;
  return null;
}

export function parseWahaEvent(
  input: unknown
): ParsedWahaEvent | { error: string } {
  const root = asRecord(input);
  if (!root) return { error: "invalid_json" };
  const payload = asRecord(root.payload) ?? {};
  const event = str(root.event || root.type) || "message";
  const session = str(root.session);
  const externalId = messageId(payload);
  if (!session || !externalId) return { error: "missing_session_or_id" };
  const tsRaw = payload.timestamp;
  const tsNum = typeof tsRaw === "number" ? tsRaw : Number(tsRaw);
  const sentAt = Number.isFinite(tsNum)
    ? new Date(tsNum > 1e12 ? tsNum : tsNum * 1000)
    : new Date();
  return {
    event,
    session,
    externalId,
    fromMe: Boolean(payload.fromMe),
    body: str(payload.body),
    sentAt,
    peerRaw: peerRaw(payload) || str(payload.to),
    extraPhone: extraPhone(payload),
    displayName: str(payload.pushName || payload.notifyName) || null,
  };
}
