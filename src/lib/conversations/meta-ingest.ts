import { prisma } from "@/lib/db";
import { logAppError } from "@/lib/error-log";
import { mergeIdentity, resolveIdentity } from "./identity";
import { parseMetaWebhook } from "./meta-parse";
import { previewBody, shouldStartNewConversation } from "./window";
import type { IngestResult } from "./ingest";
import { isSecretCodeMessage } from "./secret-code";
import { lookupMetaPeerLabel, shouldFetchMetaDisplayName } from "./meta-profile";

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

async function resolveLocationForMetaAsset(
  sourceType: "FACEBOOK" | "INSTAGRAM",
  assetId: string
): Promise<{ locationId: string; tenantId: string } | null> {
  const mapping = await prisma.sourceMapping.findFirst({
    where: { sourceType, externalId: assetId, status: "ACTIVE" },
    include: { location: { select: { id: true, tenantId: true, status: true } } },
  });
  if (mapping && mapping.location.status !== "ARCHIVED") {
    return { locationId: mapping.location.id, tenantId: mapping.location.tenantId };
  }
  return null;
}

export async function ingestMetaPayload(input: unknown): Promise<{
  results: IngestResult[];
}> {
  const parsed = parseMetaWebhook(input);
  if ("error" in parsed) return { results: [{ ok: false, error: parsed.error }] };

  const results: IngestResult[] = [];
  for (const ev of parsed.events) {
    results.push(await ingestOne(ev, input));
  }
  if (results.length === 0) {
    results.push({ ok: true, ignored: "skipped_event" });
  }
  return { results };
}

async function ingestOne(
  ev: {
    provider: "FACEBOOK" | "INSTAGRAM";
    assetId: string;
    senderId: string;
    externalId: string;
    body: string;
    fromMe: boolean;
    sentAt: Date;
  },
  rawInput: unknown
): Promise<IngestResult> {
  const existingMsg = await prisma.waMessage.findUnique({
    where: { externalId: ev.externalId },
    select: { conversationId: true },
  });
  if (existingMsg) {
    return { ok: true, conversationId: existingMsg.conversationId, duplicate: true };
  }
  if (!ev.fromMe && isSecretCodeMessage(ev.body)) {
    return { ok: true, ignored: "secret_code" };
  }

  const bound = await resolveLocationForMetaAsset(ev.provider, ev.assetId);
  if (!bound) {
    await logAppError({
      source: "Meta webhook",
      title: "Unmapped Page or Instagram",
      detail: `${ev.provider} asset ${ev.assetId} is not mapped to a branch`,
    });
    return { ok: true, ignored: "unmapped_session" };
  }

  const incoming = resolveIdentity(ev.senderId, null, ev.provider);
  const { tenantId, locationId } = bound;

  const found =
    (incoming.lid
      ? await prisma.waContact.findFirst({ where: { tenantId, lid: incoming.lid } })
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
      },
    });
  } else {
    try {
      contact = await prisma.waContact.create({
        data: {
          tenantId,
          identifier: merged.identifier,
          phone: merged.phone,
          lid: merged.lid,
          identityConfidence: merged.confidence,
        },
      });
    } catch (err) {
      if (!isPrismaP2002(err, "identifier")) throw err;
      const existingByIdent = await prisma.waContact.findUnique({
        where: { tenantId_identifier: { tenantId, identifier: merged.identifier } },
      });
      if (!existingByIdent) throw err;
      contact = existingByIdent;
    }
  }

  if (!ev.fromMe && shouldFetchMetaDisplayName(contact.displayName)) {
    const label = await lookupMetaPeerLabel({
      tenantId,
      provider: ev.provider,
      sessionId: ev.assetId,
      peerId: ev.senderId,
    });
    if (label) {
      contact = await prisma.waContact.update({
        where: { id: contact.id },
        data: { displayName: label },
      });
    }
  }

  const sessionId = ev.assetId;
  const open = await prisma.waConversation.findFirst({
    where: { contactId: contact.id, sessionId, locationId, status: "OPEN" },
    orderBy: { lastMessageAt: "desc" },
  });
  const startNew = shouldStartNewConversation(open?.lastMessageAt ?? null, ev.sentAt);
  const conversation =
    open && !startNew
      ? open
      : await prisma.waConversation.create({
          data: {
            tenantId,
            locationId,
            contactId: contact.id,
            provider: ev.provider,
            sessionId,
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
        rawJson: raw.length > 4000 ? raw.slice(0, 4000) : raw,
      },
    });
  } catch (err) {
    if (!isPrismaP2002(err, "externalId")) throw err;
    const dup = await prisma.waMessage.findUnique({
      where: { externalId: ev.externalId },
      select: { conversationId: true },
    });
    if (dup) return { ok: true, conversationId: dup.conversationId, duplicate: true };
    throw err;
  }

  const continuing = Boolean(open && !startNew);
  await prisma.waConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: ev.sentAt,
      lastPreview: previewBody(ev.body),
      lastInboundAt: direction === "IN" ? ev.sentAt : continuing ? open!.lastInboundAt : null,
      lastOutboundAt: direction === "OUT" ? ev.sentAt : continuing ? open!.lastOutboundAt : null,
    },
  });

  return { ok: true, conversationId: conversation.id };
}
