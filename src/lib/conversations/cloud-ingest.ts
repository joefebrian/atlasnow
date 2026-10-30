import { prisma } from "@/lib/db";
import { canonPhone, mergeIdentity, resolveIdentity } from "./identity";
import { parseCloudWhatsAppWebhook, type CloudAccountNote, type CloudContactTouch, type CloudSyncNote, type CloudWhatsAppEvent } from "./cloud-parse";
import { applyBroadcastStatuses, markBroadcastAction } from "@/lib/broadcast/history";
import { findCloudHqByPhoneNumberId, ensureHqLocation, mergeCloudConnectorMeta, type CloudHqConfig } from "./cloud-hq";
import { resolveYolaTenantId } from "@/lib/yola/access";
import { yolaPhoneNumberId } from "@/lib/yola/config";
import { previewBody, shouldStartNewConversation } from "./window";
import { sendCloudHqImage, sendCloudHqText } from "./cloud-send";
import type { IngestResult } from "./ingest";
import { isStampMenuQuery, isStampStatusQuery } from "@/lib/loyalty/rules";
import { isSecretCodeMessage } from "./secret-code";
import { handoffExpiry, humanHandoffActive } from "./customer-inbound";

function isPrismaP2002(err: unknown, field?: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== "P2002") return false;
  if (!field) return true;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.includes(field);
  if (typeof target === "string") return target.includes(field);
  return true;
}

/** Owned YOLA phone with no workspace connector. Inbound CRM only. No token is copied. */
async function yolaPilotTarget(phoneNumberId: string): Promise<{ tenantId: string; phoneNumberId: string } | null> {
  const configured = yolaPhoneNumberId();
  if (!configured || phoneNumberId !== configured) return null;
  const tenantId = await resolveYolaTenantId(configured);
  if (!tenantId) return null;
  const phone = await prisma.wabaPhone.findUnique({
    where: { phoneNumberId: configured },
    select: { tenantId: true, status: true },
  });
  if (!phone || phone.status === "DISABLED" || phone.tenantId !== tenantId) return null;
  return { tenantId, phoneNumberId: configured };
}

export async function ingestCloudWhatsAppPayload(input: unknown): Promise<{
  results: IngestResult[];
  suppressWamids: string[];
}> {
  const parsed = parseCloudWhatsAppWebhook(input);
  if ("error" in parsed) return { results: [{ ok: false, error: parsed.error }], suppressWamids: [] };
  if (parsed.statuses.length) {
    await applyBroadcastStatuses(parsed.statuses);
    try {
      const { applyCloudServiceStatuses } = await import("@/lib/waba/service-quota");
      await applyCloudServiceStatuses(parsed.statuses);
    } catch {
      /* inbox still lands; retry on next webhook if Meta resends status */
    }
  }
  await applySyncNotes(parsed.sync);
  await applyContactTouches(parsed.contacts);
  await applyAccountNotes(parsed.account);
  const echoKeys = new Set(
    parsed.events.filter((event) => event.source === "business_app").map((event) => `${event.phoneNumberId}:${event.waId}`)
  );
  const results: IngestResult[] = [];
  const suppressWamids: string[] = [];
  const touched = new Set<string>();
  const seenAt = new Date().toISOString();
  for (const ev of parsed.events) {
    if (ev.phoneNumberId && !touched.has(ev.phoneNumberId)) {
      touched.add(ev.phoneNumberId);
      await mergeCloudConnectorMeta({ phoneNumberId: ev.phoneNumberId, patch: { lastWebhookAt: seenAt } });
    }
    const saved = await ingestOne(ev, input, echoKeys.has(`${ev.phoneNumberId}:${ev.waId}`));
    results.push(saved.result);
    if (saved.suppressWamid) suppressWamids.push(saved.suppressWamid);
  }
  if (results.length === 0 && parsed.sync.length + parsed.contacts.length + parsed.account.length > 0) {
    results.push({ ok: true, ignored: "skipped_event" });
  }
  if (results.length === 0) {
    results.push({ ok: true, ignored: "skipped_event" });
  }
  return { results, suppressWamids };
}

async function ingestOne(
  ev: CloudWhatsAppEvent,
  rawInput: unknown,
  echoInPayload: boolean
): Promise<{ result: IngestResult; suppressWamid?: string }> {
  const existingMsg = await prisma.waMessage.findUnique({
    where: { externalId: ev.externalId },
    select: { conversationId: true },
  });
  if (existingMsg) {
    return { result: { ok: true, conversationId: existingMsg.conversationId, duplicate: true } };
  }
  const history = ev.source === "history";
  if (!history && ev.source !== "business_app" && !ev.fromMe && isSecretCodeMessage(ev.body)) {
    return { result: { ok: true, ignored: "secret_code" } };
  }

  const hq = await findCloudHqByPhoneNumberId(ev.phoneNumberId);
  const pilot = hq ? null : await yolaPilotTarget(ev.phoneNumberId);
  if (!hq && !pilot) return { result: { ok: true, ignored: "unmapped_session" } };
  if (pilot && history) return { result: { ok: true, ignored: "skipped_event" } };
  const ownerTenantId = hq?.tenantId || pilot!.tenantId;
  const ownerPhoneId = hq?.phoneNumberId || pilot!.phoneNumberId;

  const phoneRow = await prisma.wabaPhone.findUnique({
    where: { phoneNumberId: ownerPhoneId },
    select: { tenantId: true, locationId: true, isDefault: true },
  });
  if (phoneRow && phoneRow.tenantId !== ownerTenantId) {
    return { result: { ok: true, ignored: "unmapped_session" } };
  }
  let locationId = "";
  if (phoneRow?.locationId) {
    const assigned = await prisma.location.findFirst({
      where: { id: phoneRow.locationId, tenantId: ownerTenantId, status: { not: "ARCHIVED" } },
      select: { id: true },
    });
    locationId = assigned?.id || "";
  }
  if (!locationId) {
    const hqLocation = await ensureHqLocation(
      ownerTenantId,
      !phoneRow || phoneRow.isDefault ? { phone: ev.displayPhone } : undefined
    );
    locationId = hqLocation.id;
  }
  const incoming = resolveIdentity(ev.waId, ev.waId, "META_CLOUD");
  const tenantId = ownerTenantId;
  const sessionId = `cloud:${ownerPhoneId}`;

  const found =
    (incoming.phone
      ? await prisma.waContact.findFirst({ where: { tenantId, phone: incoming.phone } })
      : null) ||
    (await prisma.waContact.findUnique({
      where: { tenantId_identifier: { tenantId, identifier: incoming.identifier } },
    }));

  const merged = found
    ? mergeIdentity(
        {
          identifier: found.identifier,
          phone: found.phone,
          lid: found.lid,
          confidence: found.identityConfidence as
            | "PHONE_VERIFIED"
            | "LID_RESOLVED"
            | "OPAQUE_LID"
            | "PLATFORM_ID"
            | "UNKNOWN",
        },
        incoming
      )
    : incoming;

  let contact;
  if (found) {
    contact = await prisma.waContact.update({
      where: { id: found.id },
      data: {
        identifier: merged.identifier,
        phone: merged.phone,
        lid: merged.lid,
        identityConfidence: merged.confidence,
        displayName: ev.profileName || found.displayName,
      },
    });
  } else {
    contact = await prisma.waContact.create({
      data: {
        tenantId,
        identifier: merged.identifier,
        phone: merged.phone,
        lid: merged.lid,
        identityConfidence: merged.confidence,
        displayName: ev.profileName,
      },
    });
  }

  const open = await prisma.waConversation.findFirst({
    where: {
      contactId: contact.id,
      sessionId,
      tenantId,
      status: "OPEN",
    },
    orderBy: { lastMessageAt: "desc" },
  });

  const startNew = history ? false : shouldStartNewConversation(open?.lastMessageAt ?? null, ev.sentAt);
  const conversation =
    open && !startNew
      ? open
      : await prisma.waConversation.create({
          data: {
            tenantId,
            locationId,
            contactId: contact.id,
            provider: "META_CLOUD",
            sessionId,
            businessPhoneNumberId: ownerPhoneId,
            status: "OPEN",
            firstMessageAt: ev.sentAt,
            lastMessageAt: ev.sentAt,
          },
        });

  const direction = ev.fromMe ? "OUT" : "IN";
  const raw = JSON.stringify(rawInput);
  try {
    await prisma.waMessage.create({
      data: {
        conversationId: conversation.id,
        externalId: ev.externalId,
        direction,
        sentAt: ev.sentAt,
        body: ev.body,
        fromMe: ev.fromMe,
        source: ev.source,
        referralJson: ev.referralJson || "",
        rawJson: raw.length > 4000 ? raw.slice(0, 4000) : raw,
      },
    });
  } catch (err) {
    if (!isPrismaP2002(err, "externalId")) throw err;
    const dup = await prisma.waMessage.findUnique({
      where: { externalId: ev.externalId },
      select: { conversationId: true },
    });
    if (dup) return { result: { ok: true, conversationId: dup.conversationId, duplicate: true } };
    throw err;
  }

  if (!history && ev.source === "cloud" && ev.inboxMediaId && hq?.accessToken) {
    try {
      const { storeInboxMedia } = await import("./cloud-media");
      await storeInboxMedia({
        externalId: ev.externalId,
        accessToken: hq.accessToken,
        mediaId: ev.inboxMediaId,
        filename: ev.inboxMediaFilename,
      });
    } catch {
      /* the chat row stays; the file can be retried from the media id */
    }
  }

  const advance = !history || ev.sentAt >= conversation.lastMessageAt;
  const staffReply = ev.source === "business_app";
  await prisma.waConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: advance ? ev.sentAt : undefined,
      lastPreview: advance ? previewBody(ev.body) : undefined,
      lastInboundAt: history || ev.fromMe ? undefined : ev.sentAt,
      lastOutboundAt: history || !ev.fromMe ? undefined : ev.sentAt,
      businessPhoneNumberId: conversation.businessPhoneNumberId || ownerPhoneId,
      ...(staffReply
        ? { handoffState: "HUMAN_ACTIVE", handoffUntil: handoffExpiry(ev.sentAt) }
        : {}),
    },
  });

  if (history || staffReply || !hq) {
    return { result: { ok: true, conversationId: conversation.id } };
  }

  let suppressWamid: string | undefined;
  if (!ev.fromMe) {
    const current = await prisma.waConversation.findUnique({
      where: { id: conversation.id },
      select: { handoffState: true, handoffUntil: true },
    });
    let active = humanHandoffActive({
      state: current?.handoffState || "",
      until: current?.handoffUntil ?? null,
      now: ev.sentAt,
    });
    if (!active && echoInPayload) {
      const until = handoffExpiry(ev.sentAt);
      await prisma.waConversation.update({
        where: { id: conversation.id },
        data: { handoffState: "HUMAN_ACTIVE", handoffUntil: until },
      });
      active = humanHandoffActive({ state: "HUMAN_ACTIVE", until, now: ev.sentAt });
    }
    if (active) {
      suppressWamid = ev.externalId.startsWith("wacloud:") ? ev.externalId.slice("wacloud:".length) : ev.externalId;
    }
  }

  if (!ev.fromMe) {
    await markBroadcastAction({
      tenantId: hq.tenantId,
      phone: contact.phone || ev.waId,
      at: ev.sentAt,
      msgType: ev.msgType || "text",
    });
  }

  if (suppressWamid) {
    return { result: { ok: true, conversationId: conversation.id }, suppressWamid };
  }

  if (!ev.fromMe && contact.phone && (await handleBirthdayWaOptKeyword(hq, conversation.id, contact.phone, ev.body))) {
    return { result: { ok: true, conversationId: conversation.id } };
  }

  if (!ev.fromMe && ev.imageMediaId && contact.phone) {
    try {
      const { downloadWhatsAppMedia } = await import("./cloud-media");
      const { processHqReceiptImage } = await import("@/lib/loyalty/wa-receipt-process");
      const media = await downloadWhatsAppMedia(hq.accessToken, ev.imageMediaId);
      if (media) {
        const result = await processHqReceiptImage({
          tenantId: hq.tenantId,
          senderPhone: contact.phone,
          caption: ev.body,
          photo: media,
        });
        const { receiptWaReplyAllowed } = await import("@/lib/loyalty/receipt-wa-window");
        if (receiptWaReplyAllowed()) {
          await sendCloudHqText({
            config: hq,
            toPhone: contact.phone,
            body: result.reply,
            conversationId: conversation.id,
          });
        }
      }
    } catch {
      /* inbox still has the inbound image placeholder */
    }
  } else if (!ev.fromMe && contact.phone && (isStampMenuQuery(ev.body) || isStampStatusQuery(ev.body))) {
    try {
      const { memberStampStatus, stampMenuReply, stampStatusReply } = await import("@/lib/loyalty/service");
      const { memberState } = await import("@/lib/loyalty/members");
      const { signCardToken } = await import("@/lib/loyalty/card-token");
      const { memberAppUrlFor } = await import("@/lib/loyalty/card-public");
      const { stampImagePublicUrl } = await import("@/lib/loyalty/stamp-card-image");
      const st = await memberStampStatus(hq.tenantId, contact.phone);
      if (isStampMenuQuery(ev.body)) {
        await sendCloudHqText({
          config: hq,
          toPhone: contact.phone,
          body: stampMenuReply(st.waReplies),
          conversationId: conversation.id,
        });
      } else {
        const mem = await memberState(hq.tenantId, contact.phone);
        const token = signCardToken(hq.tenantId, mem.phone || contact.phone);
        const caption = stampStatusReply(st);
        const imageUrl = stampImagePublicUrl(token, st.count);
        const sent = await sendCloudHqImage({
          config: hq,
          toPhone: contact.phone,
          imageUrl,
          caption,
          conversationId: conversation.id,
        });
        if (!sent.ok) {
          const extra = mem.registered ? ` Kartu stamp: ${await memberAppUrlFor(hq.tenantId, mem.phone || contact.phone)}` : "";
          await sendCloudHqText({
            config: hq,
            toPhone: contact.phone,
            body: caption + extra,
            conversationId: conversation.id,
          });
        }
      }
    } catch {
      /* inbox still has the inbound */
    }
  }

  return { result: { ok: true, conversationId: conversation.id } };
}

async function applySyncNotes(notes: CloudSyncNote[]) {
  const at = new Date().toISOString();
  for (const note of notes) {
    await mergeCloudConnectorMeta({
      phoneNumberId: note.phoneNumberId,
      patch: {
        syncStatus: note.syncStatus,
        syncDetail: note.syncDetail,
        lastWebhookAt: at,
      },
    });
  }
}

async function applyContactTouches(touches: CloudContactTouch[]) {
  const counts = new Map<string, { add: number; remove: number }>();
  for (const touch of touches) {
    const hq = await findCloudHqByPhoneNumberId(touch.phoneNumberId);
    if (!hq) continue;
    const bucket = counts.get(touch.phoneNumberId) || { add: 0, remove: 0 };
    if (touch.action === "remove") bucket.remove += 1;
    else bucket.add += 1;
    counts.set(touch.phoneNumberId, bucket);
    if (touch.action !== "add" || !touch.displayName) continue;
    const found = await prisma.waContact.findFirst({
      where: { tenantId: hq.tenantId, phone: touch.phone },
      select: { id: true },
    });
    if (!found) continue;
    await prisma.waContact.update({
      where: { id: found.id },
      data: { displayName: touch.displayName },
    });
  }
  const at = new Date().toISOString();
  for (const [phoneNumberId, count] of counts) {
    await mergeCloudConnectorMeta({
      phoneNumberId,
      patch: {
        contactSync: `add=${count.add} remove=${count.remove}`,
        lastWebhookAt: at,
      },
    });
  }
}

async function applyAccountNotes(notes: CloudAccountNote[]) {
  const at = new Date().toISOString();
  for (const note of notes) {
    const patch: Record<string, string> = { accountEvent: note.event, lastWebhookAt: at };
    if (note.reason) patch.syncDetail = note.reason.slice(0, 240);
    if (note.connectionStatus) patch.connectionStatus = note.connectionStatus;
    const attention = note.connectionStatus === "needs_attention";
    if (attention) patch.automationPaused = "true";
    if (note.connectionStatus === "connected") patch.automationPaused = "false";
    await mergeCloudConnectorMeta({
      phoneNumberId: note.phoneNumberId || undefined,
      wabaId: note.phoneNumberId ? undefined : note.wabaId || undefined,
      displayPhone: note.phoneNumberId ? undefined : note.displayPhone || undefined,
      patch,
      lastError: attention ? `${note.event}${note.reason ? `: ${note.reason}` : ""}` : undefined,
      clearError: note.connectionStatus === "connected",
    });
  }
}

async function handleBirthdayWaOptKeyword(
  hq: CloudHqConfig,
  conversationId: string,
  rawPhone: string,
  body: string
): Promise<boolean> {
  const { isWaOptOutMessage, isWaOptInResumeMessage, WA_OPT_OUT_REPLY, WA_OPT_IN_RESUME_REPLY } = await import(
    "@/lib/loyalty/birthday-h2"
  );
  const phone = canonPhone(rawPhone);
  if (phone.length < 8) return false;
  if (isWaOptOutMessage(body)) {
    const n = await prisma.loyaltyMember.updateMany({
      where: { tenantId: hq.tenantId, phone },
      data: { birthdayWaOptIn: false },
    });
    if (n.count) {
      try {
        await sendCloudHqText({ config: hq, toPhone: phone, body: WA_OPT_OUT_REPLY, conversationId });
      } catch {
        /* opt-out already saved */
      }
    }
    return true;
  }
  if (isWaOptInResumeMessage(body)) {
    const n = await prisma.loyaltyMember.updateMany({
      where: { tenantId: hq.tenantId, phone },
      data: { birthdayWaOptIn: true, birthdayWaOptInAt: new Date() },
    });
    if (n.count) {
      try {
        await sendCloudHqText({ config: hq, toPhone: phone, body: WA_OPT_IN_RESUME_REPLY, conversationId });
      } catch {
        /* opt-in already saved */
      }
    }
    return true;
  }
  return false;
}
