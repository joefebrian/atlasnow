import { canonPhone } from "./identity";
import type { CloudStatusEvent } from "@/lib/broadcast/status";

export type MessageSource = "cloud" | "business_app" | "history";

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
  source: MessageSource;
};

export type CloudSyncNote = {
  phoneNumberId: string;
  wabaId: string;
  syncStatus: "syncing" | "declined" | "error" | "complete";
  syncDetail: string;
};

export type CloudContactTouch = {
  phoneNumberId: string;
  wabaId: string;
  phone: string;
  displayName: string;
  action: "add" | "remove";
};

export type CloudAccountNote = {
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string;
  event: string;
  reason: string;
  connectionStatus: "needs_attention" | "connected" | "";
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
  if (type === "media_placeholder") return "[media_placeholder]";
  return `[${type}]`;
}

function sentAtOf(msg: Record<string, unknown>): Date {
  const ts = Number(str(msg.timestamp) || 0);
  return ts > 0 ? new Date(ts * 1000) : new Date();
}

function pushMessage(
  events: CloudWhatsAppEvent[],
  input: {
    phoneNumberId: string;
    wabaId: string;
    displayPhone: string | null;
    waId: string;
    profileName: string | null;
    msg: Record<string, unknown>;
    fromMe: boolean;
    source: MessageSource;
  }
) {
  const id = str(input.msg.id);
  if (!input.waId || !id) return;
  const image = asRecord(input.msg.image);
  events.push({
    phoneNumberId: input.phoneNumberId,
    wabaId: input.wabaId,
    displayPhone: input.displayPhone,
    waId: input.waId,
    profileName: input.profileName,
    externalId: `wacloud:${id}`,
    body: messageBody(input.msg),
    fromMe: input.fromMe,
    sentAt: sentAtOf(input.msg),
    imageMediaId: str(input.msg.type) === "image" ? str(image?.id) || null : null,
    msgType: str(input.msg.type) || "text",
    source: input.source,
  });
}

function historyNote(phoneNumberId: string, wabaId: string, chunks: Record<string, unknown>[]): CloudSyncNote | null {
  if (!phoneNumberId || !chunks.length) return null;
  let declined = false;
  let errored = "";
  let progress = 0;
  let phase = "";
  for (const chunk of chunks) {
    const metadata = asRecord(chunk.metadata);
    const nextProgress = Number(str(metadata?.progress) || 0);
    if (nextProgress) progress = nextProgress;
    if (metadata?.phase != null && str(metadata.phase)) phase = str(metadata.phase);
    const errors = Array.isArray(chunk.errors) ? chunk.errors : [];
    for (const raw of errors) {
      const err = asRecord(raw);
      const code = Number(str(err?.code) || 0);
      if (code === 2593109) declined = true;
      else if (err) errored = str(err.message || err.title || err.code);
    }
  }
  if (declined) {
    return { phoneNumberId, wabaId, syncStatus: "declined", syncDetail: "history_declined" };
  }
  if (errored) {
    return { phoneNumberId, wabaId, syncStatus: "error", syncDetail: errored.slice(0, 240) };
  }
  if (progress >= 100) {
    return { phoneNumberId, wabaId, syncStatus: "complete", syncDetail: phase ? `phase ${phase}` : "history_complete" };
  }
  return {
    phoneNumberId,
    wabaId,
    syncStatus: "syncing",
    syncDetail: `phase ${phase || "0"} progress ${progress || 0}`,
  };
}

/** Parse Cloud API webhook. Inbound messages → events. Status callbacks → statuses (not inbox). */
export function parseCloudWhatsAppWebhook(input: unknown): {
  events: CloudWhatsAppEvent[];
  statuses: CloudStatusEvent[];
  sync: CloudSyncNote[];
  contacts: CloudContactTouch[];
  account: CloudAccountNote[];
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
  const sync: CloudSyncNote[] = [];
  const contacts: CloudContactTouch[] = [];
  const account: CloudAccountNote[] = [];

  for (const rawEntry of entry) {
    const e = asRecord(rawEntry);
    if (!e) continue;
    const wabaId = str(e.id);
    const changes = Array.isArray(e.changes) ? e.changes : [];
    for (const rawChange of changes) {
      const change = asRecord(rawChange);
      if (!change) continue;
      const field = str(change.field);
      const value = asRecord(change.value);
      if (!value) continue;
      const metadata = asRecord(value.metadata);
      const phoneNumberId = str(metadata?.phone_number_id);
      const displayPhone = str(metadata?.display_phone_number) || null;

      if (field === "history") {
        const chunks = (Array.isArray(value.history) ? value.history : [])
          .map((item) => asRecord(item))
          .filter((item): item is Record<string, unknown> => Boolean(item));
        const note = historyNote(phoneNumberId, wabaId, chunks);
        if (note) sync.push(note);
        if (note?.syncStatus === "declined" || note?.syncStatus === "error") continue;
        for (const chunk of chunks) {
          const threads = Array.isArray(chunk.threads) ? chunk.threads : [];
          for (const rawThread of threads) {
            const thread = asRecord(rawThread);
            if (!thread) continue;
            const threadId = canonPhone(str(thread.id));
            const messages = Array.isArray(thread.messages) ? thread.messages : [];
            for (const rawMsg of messages) {
              const msg = asRecord(rawMsg);
              if (!msg) continue;
              const from = canonPhone(str(msg.from));
              const to = canonPhone(str(msg.to));
              const business = canonPhone(displayPhone || "");
              const fromMe = Boolean(from && ((business && from === business) || (to && threadId && to === threadId && from !== threadId)));
              const waId = fromMe ? to || threadId : from || threadId;
              if (waId.length < 8) continue;
              pushMessage(events, {
                phoneNumberId,
                wabaId,
                displayPhone,
                waId,
                profileName: null,
                msg,
                fromMe,
                source: "history",
              });
            }
          }
        }
        continue;
      }

      if (field === "smb_app_state_sync") {
        const rows = Array.isArray(value.state_sync) ? value.state_sync : [];
        for (const rawRow of rows) {
          const row = asRecord(rawRow);
          const contact = asRecord(row?.contact);
          if (!row || str(row.type) !== "contact" || !contact || !phoneNumberId) continue;
          const phone = canonPhone(str(contact.phone_number));
          if (phone.length < 8) continue;
          const action = str(row.action) === "remove" ? "remove" : "add";
          contacts.push({
            phoneNumberId,
            wabaId,
            phone,
            displayName: str(contact.full_name || contact.first_name).slice(0, 120),
            action,
          });
        }
        continue;
      }

      if (field === "account_update") {
        const event = str(value.event);
        const info = asRecord(value.disconnection_info);
        const reason = str(info?.reason || value.reason);
        const wabaInfo = asRecord(value.waba_info);
        const connectionStatus =
          event === "PARTNER_REMOVED" || event === "ACCOUNT_OFFBOARDED"
            ? "needs_attention"
            : event === "ACCOUNT_RECONNECTED"
              ? "connected"
              : "";
        if (!event) continue;
        account.push({
          phoneNumberId,
          wabaId: str(wabaInfo?.waba_id) || wabaId,
          displayPhone: str(value.phone_number || displayPhone),
          event,
          reason,
          connectionStatus,
        });
        continue;
      }

      if (!phoneNumberId) continue;
      const names = new Map<string, string>();
      const contactRows = Array.isArray(value.contacts) ? value.contacts : [];
      for (const c of contactRows) {
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
        pushMessage(events, {
          phoneNumberId,
          wabaId,
          displayPhone,
          waId: from,
          profileName: names.get(from) || null,
          msg,
          fromMe: false,
          source: "cloud",
        });
      }
      const echoes = Array.isArray(value.message_echoes) ? value.message_echoes : [];
      for (const rawEcho of echoes) {
        const msg = asRecord(rawEcho);
        if (!msg) continue;
        const to = canonPhone(str(msg.to));
        pushMessage(events, {
          phoneNumberId,
          wabaId,
          displayPhone,
          waId: to,
          profileName: names.get(to) || null,
          msg,
          fromMe: true,
          source: "business_app",
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

  return { events, statuses, sync, contacts, account };
}
