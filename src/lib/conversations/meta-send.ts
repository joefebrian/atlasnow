import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/google/crypto";
import { META_GRAPH } from "@/lib/meta/oauth";
import { findMetaPageForThread } from "@/lib/meta/service";
import { placeholderBody, type InboxMediaKind } from "./inbox-media";
import { previewBody } from "./window";

function recipientId(contact: { lid: string | null; identifier: string }, provider: string): string {
  if (contact.lid) return contact.lid;
  const ident = contact.identifier || "";
  const prefix = provider === "INSTAGRAM" ? "ig:" : "fb:";
  return ident.startsWith(prefix) ? ident.slice(prefix.length) : ident;
}

export async function sendMetaInboxText(opts: {
  tenantId: string;
  conversationId: string;
  provider: "FACEBOOK" | "INSTAGRAM";
  sessionId: string;
  contact: { lid: string | null; identifier: string };
  text: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const text = opts.text.trim();
  if (!text) return { ok: false, error: "Message required" };
  const to = recipientId(opts.contact, opts.provider);
  if (!to) return { ok: false, error: "No Messenger/Instagram id on this contact." };

  const connector = await prisma.connector.findUnique({
    where: { tenantId_provider_accountKey: { tenantId: opts.tenantId, provider: "META", accountKey: "" } },
  });
  if (!connector || connector.status === "DISCONNECTED") {
    return { ok: false, error: "Meta is not connected for this brand." };
  }
  const page = findMetaPageForThread(connector.metaJson, opts.provider, opts.sessionId);
  if (!page) {
    return { ok: false, error: "This Page / IG is not in the Meta connection. Reconnect Meta." };
  }
  let pageToken: string;
  try {
    pageToken = decryptSecret(page.tokenEnc);
  } catch {
    return { ok: false, error: "Page token unreadable. Reconnect Meta." };
  }

  const url = `${META_GRAPH}/me/messages?access_token=${encodeURIComponent(pageToken)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: to },
      messaging_type: "RESPONSE",
      message: { text },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    message_id?: string;
    error?: { message?: string; error_user_msg?: string };
  };
  if (!res.ok || !data.message_id) {
    const msg = data.error?.error_user_msg || data.error?.message || `Meta send failed (${res.status})`;
    return { ok: false, error: msg };
  }

  const now = new Date();
  const mid = data.message_id;
  try {
    await prisma.waMessage.create({
      data: {
        conversationId: opts.conversationId,
        externalId: `meta:${mid}`,
        direction: "OUT",
        sentAt: now,
        body: text,
        fromMe: true,
        rawJson: "",
      },
    });
  } catch {
    /* echo webhook may have landed first */
  }
  await prisma.waConversation.update({
    where: { id: opts.conversationId },
    data: {
      lastMessageAt: now,
      lastOutboundAt: now,
      lastPreview: previewBody(text),
    },
  });
  return { ok: true, messageId: mid };
}

export async function sendMetaInboxFile(opts: {
  tenantId: string;
  conversationId: string;
  provider: "FACEBOOK" | "INSTAGRAM";
  sessionId: string;
  contact: { lid: string | null; identifier: string };
  kind: InboxMediaKind;
  bytes: Buffer;
  mime: string;
  filename: string;
  caption?: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  if (opts.kind === "audio") return { ok: false, error: "Voice notes are received, not sent from here." };
  if (opts.provider === "INSTAGRAM" && opts.kind === "document") {
    return { ok: false, error: "Instagram cannot send a document. Send a photo or video." };
  }
  const to = recipientId(opts.contact, opts.provider);
  if (!to) return { ok: false, error: "No Messenger/Instagram id on this contact." };
  const connector = await prisma.connector.findUnique({
    where: { tenantId_provider_accountKey: { tenantId: opts.tenantId, provider: "META", accountKey: "" } },
  });
  if (!connector || connector.status === "DISCONNECTED") {
    return { ok: false, error: "Meta is not connected for this brand." };
  }
  const page = findMetaPageForThread(connector.metaJson, opts.provider, opts.sessionId);
  if (!page) return { ok: false, error: "This Page / IG is not in the Meta connection. Reconnect Meta." };
  let pageToken: string;
  try {
    pageToken = decryptSecret(page.tokenEnc);
  } catch {
    return { ok: false, error: "Page token unreadable. Reconnect Meta." };
  }

  const caption = (opts.caption || "").trim();
  if (caption) {
    const textSent = await sendMetaInboxText({ ...opts, text: caption });
    if (!textSent.ok) return textSent;
  }

  const metaType = opts.kind === "document" ? "file" : opts.kind;
  const form = new FormData();
  form.set(
    "message",
    JSON.stringify({ attachment: { type: metaType, payload: { is_reusable: true } } })
  );
  form.set("filedata", new Blob([new Uint8Array(opts.bytes)], { type: opts.mime }), opts.filename);
  const upload = await fetch(`${META_GRAPH}/me/message_attachments?access_token=${encodeURIComponent(pageToken)}`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const uploaded = (await upload.json().catch(() => ({}))) as {
    attachment_id?: string;
    error?: { message?: string; error_user_msg?: string };
  };
  if (!upload.ok || !uploaded.attachment_id) {
    return {
      ok: false,
      error: uploaded.error?.error_user_msg || uploaded.error?.message || `Meta upload failed (${upload.status})`,
    };
  }

  const res = await fetch(`${META_GRAPH}/me/messages?access_token=${encodeURIComponent(pageToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: to },
      messaging_type: "RESPONSE",
      message: { attachment: { type: metaType, payload: { attachment_id: uploaded.attachment_id } } },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    message_id?: string;
    error?: { message?: string; error_user_msg?: string };
  };
  if (!res.ok || !data.message_id) {
    return { ok: false, error: data.error?.error_user_msg || data.error?.message || `Meta send failed (${res.status})` };
  }

  const now = new Date();
  const body = placeholderBody(opts.kind);
  const media = {
    body,
    mediaImage: opts.bytes,
    mediaMime: opts.mime,
    mediaFilename: opts.filename,
    inboxImage: true,
  };
  try {
    await prisma.waMessage.create({
      data: {
        conversationId: opts.conversationId,
        externalId: `meta:${data.message_id}`,
        direction: "OUT",
        sentAt: now,
        fromMe: true,
        rawJson: "",
        ...media,
      },
    });
  } catch {
    await prisma.waMessage.update({ where: { externalId: `meta:${data.message_id}` }, data: media }).catch(() => undefined);
  }
  await prisma.waConversation.update({
    where: { id: opts.conversationId },
    data: { lastMessageAt: now, lastOutboundAt: now, lastPreview: previewBody(body) },
  });
  return { ok: true, messageId: data.message_id };
}
