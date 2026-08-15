import { prisma } from "@/lib/db";
import { mergeIdentity, resolveIdentity } from "./identity";
import { parseWahaEvent } from "./parse";
import { previewBody, shouldStartNewConversation } from "./window";
import { isWahaIngestEnabled } from "./waha-config";

export type IngestResult =
  | { ok: true; conversationId: string; duplicate?: boolean }
  | { ok: true; ignored: true | "unmapped_session" | "kill_switch" | "skipped_event" }
  | { ok: false; error: string };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Lid from payload._data.id.remote when `from` is already a phone (@c.us). */
function lidFromRemote(input: unknown): string | null {
  const root = asRecord(input);
  const payload = root ? asRecord(root.payload) : null;
  const data = payload ? asRecord(payload._data) : null;
  const dataId = data ? asRecord(data.id) : null;
  const remote = dataId && typeof dataId.remote === "string" ? dataId.remote : "";
  const m = remote.match(/^([^@]+)@lid$/i);
  return m ? m[1] : null;
}

export async function ingestWahaPayload(input: unknown): Promise<IngestResult> {
  if (!(await isWahaIngestEnabled())) {
    return { ok: true, ignored: "kill_switch" };
  }
  const parsed = parseWahaEvent(input);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const ev = parsed.event.toLowerCase();
  if (ev !== "message" && ev !== "message.any") {
    return { ok: true, ignored: "skipped_event" };
  }

  const existingMsg = await prisma.waMessage.findUnique({
    where: { externalId: parsed.externalId },
    select: { conversationId: true },
  });
  if (existingMsg) {
    return { ok: true, conversationId: existingMsg.conversationId, duplicate: true };
  }

  const mapping = await prisma.sourceMapping.findFirst({
    where: {
      sourceType: "WAHA",
      externalId: parsed.session,
      status: "ACTIVE",
    },
    include: { location: { select: { id: true, tenantId: true } } },
  });
  if (!mapping) return { ok: true, ignored: "unmapped_session" };

  const tenantId = mapping.location.tenantId;
  const locationId = mapping.location.id;
  const resolved = resolveIdentity(parsed.peerRaw, parsed.extraPhone);
  const remoteLid = lidFromRemote(input);
  const incoming = remoteLid && !resolved.lid ? { ...resolved, lid: remoteLid } : resolved;

  const found =
    (incoming.lid
      ? await prisma.waContact.findFirst({
          where: { tenantId, lid: incoming.lid },
        })
      : null) ||
    (incoming.phone
      ? await prisma.waContact.findFirst({
          where: { tenantId, phone: incoming.phone },
        })
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
            | "UNKNOWN",
        },
        incoming
      )
    : incoming;

  const contact = found
    ? await prisma.waContact.update({
        where: { id: found.id },
        data: {
          identifier: merged.identifier,
          phone: merged.phone,
          lid: merged.lid,
          identityConfidence: merged.confidence,
          displayName: parsed.displayName || found.displayName,
        },
      })
    : await prisma.waContact.create({
        data: {
          tenantId,
          identifier: merged.identifier,
          phone: merged.phone,
          lid: merged.lid,
          identityConfidence: merged.confidence,
          displayName: parsed.displayName,
        },
      });

  const open = await prisma.waConversation.findFirst({
    where: {
      contactId: contact.id,
      sessionId: parsed.session,
      locationId,
      status: "OPEN",
    },
    orderBy: { lastMessageAt: "desc" },
  });

  const startNew = shouldStartNewConversation(open?.lastMessageAt ?? null, parsed.sentAt);
  const conversation =
    open && !startNew
      ? open
      : await prisma.waConversation.create({
          data: {
            tenantId,
            locationId,
            contactId: contact.id,
            provider: "WAHA",
            sessionId: parsed.session,
            status: "OPEN",
            firstMessageAt: parsed.sentAt,
            lastMessageAt: parsed.sentAt,
          },
        });

  const direction = parsed.fromMe ? "OUT" : "IN";
  const raw = JSON.stringify(input);
  await prisma.waMessage.create({
    data: {
      conversationId: conversation.id,
      externalId: parsed.externalId,
      direction,
      sentAt: parsed.sentAt,
      body: parsed.body,
      fromMe: parsed.fromMe,
      rawJson: raw.length > 4000 ? raw.slice(0, 4000) : raw,
    },
  });

  const continuing = Boolean(open && !startNew);
  await prisma.waConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: parsed.sentAt,
      lastPreview: previewBody(parsed.body),
      lastInboundAt: direction === "IN" ? parsed.sentAt : continuing ? open!.lastInboundAt : null,
      lastOutboundAt: direction === "OUT" ? parsed.sentAt : continuing ? open!.lastOutboundAt : null,
    },
  });

  return { ok: true, conversationId: conversation.id };
}
