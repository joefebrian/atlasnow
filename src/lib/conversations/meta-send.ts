import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/google/crypto";
import { META_GRAPH } from "@/lib/meta/oauth";
import { findMetaPageForThread } from "@/lib/meta/service";
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
    where: { tenantId_provider: { tenantId: opts.tenantId, provider: "META" } },
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
