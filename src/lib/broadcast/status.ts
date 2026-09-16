export const ACTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type BroadcastSendStatus = "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
export type MetaStatusName = "sent" | "delivered" | "read" | "failed" | "played" | string;

const RANK: Record<BroadcastSendStatus, number> = {
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 99,
};

export function nextStatus(current: BroadcastSendStatus, incoming: MetaStatusName): BroadcastSendStatus {
  if (current === "FAILED") return "FAILED";
  const mapped = mapIncoming(incoming);
  if (!mapped) return current;
  if (mapped === "FAILED") return "FAILED";
  return RANK[mapped] >= RANK[current] ? mapped : current;
}

function mapIncoming(incoming: MetaStatusName): BroadcastSendStatus | null {
  if (incoming === "sent") return "SENT";
  if (incoming === "delivered") return "DELIVERED";
  if (incoming === "read") return "READ";
  if (incoming === "failed") return "FAILED";
  return null;
}

export type StatusRow = {
  status: BroadcastSendStatus;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  errorCode?: number | null;
  errorTitle?: string | null;
  pricingCategory?: string | null;
  pricingType?: string | null;
};

export type IncomingMetaStatus = {
  status: MetaStatusName;
  at: Date;
  errorCode: number | null;
  errorTitle: string;
  pricingCategory: string | null;
  pricingType: string | null;
};

export function applyMetaStatus(row: StatusRow, incoming: IncomingMetaStatus): StatusRow {
  const status = nextStatus(row.status, incoming.status);
  const out: StatusRow = { ...row, status };
  if (incoming.pricingCategory) out.pricingCategory = incoming.pricingCategory;
  if (incoming.pricingType) out.pricingType = incoming.pricingType;

  if (incoming.status === "failed") {
    out.failedAt = incoming.at;
    out.errorCode = incoming.errorCode;
    out.errorTitle = incoming.errorTitle;
    return out;
  }
  if (incoming.status === "sent" && status === "SENT") {
    return out;
  }
  if (incoming.status === "delivered") {
    if (!out.deliveredAt) out.deliveredAt = incoming.at;
    return out;
  }
  if (incoming.status === "read") {
    if (!out.readAt) out.readAt = incoming.at;
    if (!out.deliveredAt) out.deliveredAt = incoming.at;
    return out;
  }
  return out;
}

const ACTION_TYPES = new Set([
  "text",
  "button",
  "interactive",
  "image",
  "audio",
  "video",
  "document",
  "location",
  "contacts",
  "sticker",
]);

export function isActionInboundType(type: string): boolean {
  return ACTION_TYPES.has((type || "").toLowerCase());
}

export type CloudStatusEvent = {
  phoneNumberId: string;
  wamid: string;
  status: MetaStatusName;
  at: Date;
  recipientId: string;
  errorCode: number | null;
  errorTitle: string;
  pricingCategory: string | null;
  pricingType: string | null;
};
