import { META_GRAPH } from "@/lib/meta/oauth";
import { prisma } from "@/lib/db";
import { previewBody } from "./window";
import type { CloudHqConfig } from "./cloud-hq";

async function postCloudMessage(
  opts: {
    config: CloudHqConfig;
    toPhone: string;
    conversationId?: string;
  },
  payload: Record<string, unknown>,
  preview: string
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const to = opts.toPhone.replace(/\D/g, "");
  if (to.length < 8) return { ok: false, error: "invalid_phone" };
  const res = await fetch(`${META_GRAPH}/${encodeURIComponent(opts.config.phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      ...payload,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  if (!res.ok || !json.messages?.[0]?.id) {
    return { ok: false, error: json.error?.message || `Cloud API send failed (${res.status})` };
  }
  const messageId = json.messages[0].id;
  const kind = payload.type === "template" ? "template" : "session";
  try {
    const { noteCloudOutbound } = await import("@/lib/waba/service-quota");
    await noteCloudOutbound({
      tenantId: opts.config.tenantId,
      phoneNumberId: opts.config.phoneNumberId,
      wamid: messageId,
      kind,
      wabaId: opts.config.wabaId,
      displayPhone: opts.config.displayPhone,
    });
  } catch {
    /* send already accepted — quota row must not fail the merchant */
  }
  if (opts.conversationId) {
    const now = new Date();
    await prisma.waMessage.create({
      data: {
        conversationId: opts.conversationId,
        externalId: `wacloud:${messageId}`,
        direction: "OUT",
        sentAt: now,
        body: preview,
        fromMe: true,
      },
    });
    await prisma.waConversation.update({
      where: { id: opts.conversationId },
      data: {
        lastMessageAt: now,
        lastOutboundAt: now,
        lastPreview: previewBody(preview),
      },
    });
  }
  return { ok: true, messageId };
}

export async function sendCloudHqText(opts: {
  config: CloudHqConfig;
  toPhone: string;
  body: string;
  conversationId?: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const text = opts.body.trim();
  if (!text) return { ok: false, error: "empty" };
  return postCloudMessage(opts, { type: "text", text: { body: text, preview_url: false } }, text);
}

export async function sendCloudHqTemplate(opts: {
  config: CloudHqConfig;
  toPhone: string;
  name: string;
  language: string;
  bodyPreview?: string;
  conversationId?: string;
  header?: { kind: "image" | "document"; mediaId: string; filename?: string };
  bodyParams?: string[];
  bodyNamedParams?: { name: string; text: string }[];
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const name = opts.name.trim();
  const language = (opts.language || "id").trim();
  if (!name) return { ok: false, error: "template_name" };
  const template: Record<string, unknown> = {
    name,
    language: { code: language },
  };
  const components: Array<Record<string, unknown>> = [];
  if (opts.header?.mediaId) {
    const param =
      opts.header.kind === "document"
        ? { type: "document", document: { id: opts.header.mediaId, filename: opts.header.filename || "file.pdf" } }
        : { type: "image", image: { id: opts.header.mediaId } };
    components.push({ type: "header", parameters: [param] });
  }
  if (opts.bodyNamedParams?.length) {
    components.push({
      type: "body",
      parameters: opts.bodyNamedParams.map((row) => ({
        type: "text",
        parameter_name: row.name,
        text: (row.text || " ").slice(0, 1024),
      })),
    });
  } else if (opts.bodyParams?.length) {
    components.push({
      type: "body",
      parameters: opts.bodyParams.map((text) => ({
        type: "text",
        text: (text || " ").slice(0, 1024),
      })),
    });
  }
  if (components.length) template.components = components;
  return postCloudMessage(opts, { type: "template", template }, opts.bodyPreview || `[template:${name}]`);
}

export async function sendCloudHqImage(opts: {
  config: CloudHqConfig;
  toPhone: string;
  imageUrl?: string;
  mediaId?: string;
  caption?: string;
  conversationId?: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const caption = (opts.caption || "").trim().slice(0, 1024);
  const image: { link?: string; id?: string; caption?: string } = {};
  if (opts.mediaId) image.id = opts.mediaId;
  else if (opts.imageUrl) image.link = opts.imageUrl;
  else return { ok: false, error: "image_missing" };
  if (caption) image.caption = caption;
  return postCloudMessage(opts, { type: "image", image }, caption || "[image]");
}

export async function sendCloudHqDocument(opts: {
  config: CloudHqConfig;
  toPhone: string;
  mediaId: string;
  filename?: string;
  caption?: string;
  conversationId?: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const caption = (opts.caption || "").trim().slice(0, 1024);
  const document: { id: string; filename?: string; caption?: string } = {
    id: opts.mediaId,
    filename: opts.filename || "file.pdf",
  };
  if (caption) document.caption = caption;
  return postCloudMessage(opts, { type: "document", document }, caption || opts.filename || "[pdf]");
}
