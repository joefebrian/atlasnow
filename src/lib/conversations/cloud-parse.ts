import { canonPhone } from "./identity";
import type { CloudStatusEvent } from "@/lib/broadcast/status";

export type CloudWhatsAppEvent = {
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string | null;
  waId: string;
  profileName: string | null;
  externalId: string;
  body: string;
  fromMe: boolean;
  sentAt: Date;
  imageMediaId: string | null;
  msgType: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

function messageBody(msg: Record<string, unknown>): string {
  const type = str(msg.type) || "text";
  if (type === "text") {
    const text = asRecord(msg.text);
    return str(text?.body).trim();
  }
  if (type === "button") {
    const button = asRecord(msg.button);
    return str(button?.text || button?.payload).trim() || "[button]";
  }
  if (type === "interactive") {
    const interactive = asRecord(msg.interactive);
    const buttonReply = asRecord(interactive?.button_reply);
    const listReply = asRecord(interactive?.list_reply);
    return str(buttonReply?.title || listReply?.title).trim() || "[interactive]";
  }
  if (type === "image") {
    const image = asRecord(msg.image);
    return str(image?.caption).trim() || "[image]";
  }
  if (type === "audio") return "[audio]";
  if (type === "video") return "[video]";
  if (type === "document") return "[document]";
  if (type === "sticker") return "[sticker]";
  if (type === "location") return "[location]";
  if (type === "contacts") return "[contacts]";
  return `[${type}]`;
}

/** Parse Cloud API webhook. Inbound messages → events. Status callbacks → statuses (not inbox). */
export function parseCloudWhatsAppWebhook(input: unknown): {
  events: CloudWhatsAppEvent[];
  statuses: CloudStatusEvent[];
} | { error: string } {
  const root = asRecord(input);
  if (!root) return { error: "invalid_json" };
  const object = str(root.object);
  if (object && object !== "whatsapp_business_account") {
    return { error: "not_whatsapp" };
  }
  const entry = Array.isArray(root.entry) ? root.entry : [];
  const events: CloudWhatsAppEvent[] = [];
  const statuses: CloudStatusEvent[] = [];

  for (const rawEntry of entry) {
    const e = asRecord(rawEntry);
    if (!e) continue;
    const wabaId = str(e.id);
    const changes = Array.isArray(e.changes) ? e.changes : [];
    for (const rawChange of changes) {
      const change = asRecord(rawChange);
      if (!change) continue;
      const value = asRecord(change.value);
      if (!value) continue;
      const metadata = asRecord(value.metadata);
      const phoneNumberId = str(metadata?.phone_number_id);
      if (!phoneNumberId) continue;
      const displayPhone = str(metadata?.display_phone_number) || null;
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const names = new Map<string, string>();
      for (const c of contacts) {
        const cr = asRecord(c);
        if (!cr) continue;
        const waId = canonPhone(str(cr.wa_id));
        const profile = asRecord(cr.profile);
        const name = str(profile?.name);
        if (waId && name) names.set(waId, name);
      }
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const rawMsg of messages) {
        const msg = asRecord(rawMsg);
        if (!msg) continue;
        const from = canonPhone(str(msg.from));
        const id = str(msg.id);
        if (!from || !id) continue;
        const ts = Number(str(msg.timestamp) || 0);
        const sentAt = ts > 0 ? new Date(ts * 1000) : new Date();
        const image = asRecord(msg.image);
        const imageMediaId = str(msg.type) === "image" ? str(image?.id) || null : null;
        events.push({
          phoneNumberId,
          wabaId,
          displayPhone,
          waId: from,
          profileName: names.get(from) || null,
          externalId: `wacloud:${id}`,
          body: messageBody(msg),
          fromMe: false,
          sentAt,
          imageMediaId,
          msgType: str(msg.type) || "text",
        });
      }
      const echoes = Array.isArray(value.message_echoes) ? value.message_echoes : [];
      for (const rawEcho of echoes) {
        const msg = asRecord(rawEcho);
        if (!msg) continue;
        const to = canonPhone(str(msg.to));
        const id = str(msg.id);
        if (!to || !id) continue;
        const ts = Number(str(msg.timestamp) || 0);
        const sentAt = ts > 0 ? new Date(ts * 1000) : new Date();
        const image = asRecord(msg.image);
        const imageMediaId = str(msg.type) === "image" ? str(image?.id) || null : null;
        events.push({
          phoneNumberId,
          wabaId,
          displayPhone,
          waId: to,
          profileName: names.get(to) || null,
          externalId: `wacloud:${id}`,
          body: messageBody(msg),
          fromMe: true,
          sentAt,
          imageMediaId,
          msgType: str(msg.type) || "text",
        });
      }
      const rawStatuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const rawSt of rawStatuses) {
        const st = asRecord(rawSt);
        if (!st) continue;
        const wamid = str(st.id);
        const status = str(st.status).toLowerCase();
        if (!wamid || !status || status === "played") continue;
        const ts = Number(str(st.timestamp) || 0);
        const errors = Array.isArray(st.errors) ? st.errors : [];
        const err0 = asRecord(errors[0]);
        const pricing = asRecord(st.pricing);
        statuses.push({
          phoneNumberId,
          wamid,
          status,
          at: ts > 0 ? new Date(ts * 1000) : new Date(),
          recipientId: canonPhone(str(st.recipient_id)),
          errorCode: err0 && typeof err0.code === "number" ? err0.code : Number(str(err0?.code)) || null,
          errorTitle: str(err0?.title || err0?.message),
          pricingCategory: str(pricing?.category) || null,
          pricingType: str(pricing?.type) || null,
        });
      }
    }
  }

  return { events, statuses };
}
