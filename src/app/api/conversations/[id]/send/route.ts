import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessTenant } from "@/lib/locations/access";
import { cloudSendConfig } from "@/lib/conversations/cloud-hq";
import { sendCloudHqDocument, sendCloudHqImage, sendCloudHqText, sendCloudHqVideo, uploadCloudInboxMedia } from "@/lib/conversations/cloud-send";
import { classifyInboxUpload, dangerousMediaBytes, placeholderBody } from "@/lib/conversations/inbox-media";
import { sendMetaInboxFile, sendMetaInboxText } from "@/lib/conversations/meta-send";
import { markHumanHandoff } from "@/lib/conversations/handoff";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const row = await prisma.waConversation.findUnique({
    where: { id },
    include: { contact: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessTenant(session, row.tenantId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const caption = String(form.get("text") || "").trim();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file_missing" }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    if (dangerousMediaBytes(bytes)) return NextResponse.json({ error: "file_blocked" }, { status: 400 });
    const classified = classifyInboxUpload(file.name, file.type, bytes.length);
    if (!classified.ok) return NextResponse.json({ error: classified.error }, { status: 400 });
    if (classified.kind === "audio") {
      return NextResponse.json({ error: "Voice notes are received, not sent from here." }, { status: 400 });
    }
    if (row.provider === "FACEBOOK" || row.provider === "INSTAGRAM") {
      const sent = await sendMetaInboxFile({
        tenantId: row.tenantId,
        conversationId: row.id,
        provider: row.provider,
        sessionId: row.sessionId,
        contact: row.contact,
        kind: classified.kind,
        bytes,
        mime: classified.mime,
        filename: classified.filename,
        caption,
      });
      if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });
      return NextResponse.json({ ok: true, messageId: sent.messageId });
    }
    if (row.provider !== "META_CLOUD") {
      return NextResponse.json({ error: "This channel cannot send a file." }, { status: 400 });
    }
    const phone = row.contact.phone;
    if (!phone) return NextResponse.json({ error: "This contact has no phone number." }, { status: 400 });
    const cfg = await cloudSendConfig(row.tenantId, row.sessionId, row.businessPhoneNumberId);
    if (!cfg) {
      return NextResponse.json({ error: "This WhatsApp number is not connected for this chat." }, { status: 400 });
    }
    const uploaded = await uploadCloudInboxMedia({
      config: cfg,
      bytes,
      mime: classified.mime,
      filename: classified.filename,
    });
    if (!uploaded.ok) return NextResponse.json({ error: uploaded.error }, { status: 502 });
    const sent =
      classified.kind === "image"
        ? await sendCloudHqImage({
            config: cfg,
            toPhone: phone,
            mediaId: uploaded.mediaId,
            caption,
            conversationId: row.id,
          })
        : classified.kind === "video"
          ? await sendCloudHqVideo({
              config: cfg,
              toPhone: phone,
              mediaId: uploaded.mediaId,
              caption,
              conversationId: row.id,
            })
          : await sendCloudHqDocument({
              config: cfg,
              toPhone: phone,
              mediaId: uploaded.mediaId,
              filename: classified.filename,
              caption,
              conversationId: row.id,
            });
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });
    await prisma.waMessage.update({
      where: { externalId: `wacloud:${sent.messageId}` },
      data: {
        mediaImage: bytes,
        mediaMime: classified.mime,
        mediaFilename: classified.filename,
        mediaCloudId: uploaded.mediaId,
        inboxImage: true,
        body: caption || placeholderBody(classified.kind),
      },
    });
    await markHumanHandoff(row.id, new Date());
    return NextResponse.json({ ok: true, messageId: sent.messageId });
  }

  let body: { text?: string };
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Message required" }, { status: 400 });

  if (row.provider === "FACEBOOK" || row.provider === "INSTAGRAM") {
    const sent = await sendMetaInboxText({
      tenantId: row.tenantId,
      conversationId: row.id,
      provider: row.provider,
      sessionId: row.sessionId,
      contact: row.contact,
      text,
    });
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });
    return NextResponse.json({ ok: true, messageId: sent.messageId });
  }

  if (row.provider !== "META_CLOUD") {
    return NextResponse.json(
      { error: "Branch WhatsApp is watch-only. Reply from WhatsApp HQ." },
      { status: 403 }
    );
  }
  const phone = row.contact.phone;
  if (!phone) {
    return NextResponse.json({ error: "This contact has no phone number." }, { status: 400 });
  }
  const cfg = await cloudSendConfig(row.tenantId, row.sessionId, row.businessPhoneNumberId);
  if (!cfg) {
    return NextResponse.json(
      { error: "This WhatsApp number is not connected for this chat." },
      { status: 400 }
    );
  }
  const sent = await sendCloudHqText({
    config: cfg,
    toPhone: phone,
    body: text,
    conversationId: row.id,
  });
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: 502 });
  }
  await markHumanHandoff(row.id, new Date());
  return NextResponse.json({ ok: true, messageId: sent.messageId });
}
