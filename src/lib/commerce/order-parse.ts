export type ParsedOrderItem = {
  sku: string;
  quantity: number | null;
  itemPrice: number | null;
  currency: string;
};

/** Fields required to resolve a merchant. Profile names and message text are dropped. */
export type ParsedWhatsAppOrder = {
  wabaId: string;
  phoneNumberId: string;
  messageId: string;
  catalogId: string;
  customerWaId: string;
  receivedAt: Date;
  items: ParsedOrderItem[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function wholeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return null;
}

function positiveQuantity(value: unknown): number | null {
  const parsed = wholeNumber(value);
  if (parsed == null || parsed < 1 || parsed > 9999) return null;
  return parsed;
}

function receivedAt(timestamp: unknown): Date {
  const seconds = wholeNumber(timestamp);
  if (seconds == null || seconds < 1_000_000_000 || seconds > 4_000_000_000) return new Date();
  return new Date(seconds * 1000);
}

function parseItems(order: Record<string, unknown>): ParsedOrderItem[] {
  if (!Array.isArray(order.product_items)) return [];
  const items: ParsedOrderItem[] = [];
  for (const raw of order.product_items) {
    const item = asRecord(raw);
    if (!item) continue;
    const sku = asString(item.product_retailer_id);
    if (!sku) continue;
    items.push({
      sku,
      quantity: positiveQuantity(item.quantity),
      itemPrice: wholeNumber(item.item_price),
      currency: asString(item.currency).toUpperCase(),
    });
  }
  return items;
}

/**
 * Reads WhatsApp `messages` events whose `type` is `order`.
 * Product inquiry messages and every other type are ignored.
 * The result has no profile name, message text, or display phone.
 */
export function parseWhatsAppOrders(body: unknown): ParsedWhatsAppOrder[] {
  const root = asRecord(body);
  if (!root || root.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) return [];
  const orders: ParsedWhatsAppOrder[] = [];
  for (const entryRaw of root.entry) {
    const entry = asRecord(entryRaw);
    if (!entry || !Array.isArray(entry.changes)) continue;
    const wabaId = asString(entry.id);
    for (const changeRaw of entry.changes) {
      const change = asRecord(changeRaw);
      if (!change || change.field !== "messages") continue;
      const value = asRecord(change.value);
      if (!value || !Array.isArray(value.messages)) continue;
      const phoneNumberId = asString(asRecord(value.metadata)?.phone_number_id);
      for (const messageRaw of value.messages) {
        const message = asRecord(messageRaw);
        if (!message || message.type !== "order") continue;
        const order = asRecord(message.order);
        if (!order) continue;
        orders.push({
          wabaId,
          phoneNumberId,
          messageId: asString(message.id),
          catalogId: asString(order.catalog_id),
          customerWaId: asString(message.from),
          receivedAt: receivedAt(message.timestamp),
          items: parseItems(order),
        });
      }
    }
  }
  return orders;
}

export type CommerceOrderLineView = {
  sku: string;
  quantity: number;
  currency: string;
  itemPriceEstimate: number | null;
  validation: "MATCHED" | "UNKNOWN_SKU" | "PRICE_MISMATCH" | "REVIEW";
};

export type CommerceOrderView = {
  id: string;
  reference: string;
  receivedAt: string;
  outletName: string | null;
  customerRef: string;
  catalogId: string;
  currency: string;
  estimatedTotal: number | null;
  validation: CommerceOrderLineView["validation"];
  paymentStatus: string;
  status: string;
  lines: CommerceOrderLineView[];
};

export function customerReference(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return last4 ? `•••• ${last4}` : "••••";
}
