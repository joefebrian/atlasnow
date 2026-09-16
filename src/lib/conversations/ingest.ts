import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/auth";
import { recordNotice } from "@/lib/notices";
import { mergeIdentity, resolveIdentity, samePhone } from "./identity";
import { parseWahaEvent, parseWahaSessionStatus } from "./parse";
import { previewBody, shouldStartNewConversation } from "./window";
import { isWahaIngestEnabled } from "./waha-config";
import { resolveLidToPhone } from "./waha-lids";
import { isSecretCodeMessage } from "./secret-code";

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

export type IngestResult =
  | { ok: true; conversationId: string; duplicate?: boolean }
  | { ok: true; ignored: true | "unmapped_session" | "kill_switch" | "skipped_event" | "secret_code" }
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

/** Session name = SourceMapping.externalId (legacy) or Location.atlasLocationId. */
export async function resolveLocationForWahaSession(
  session: string
): Promise<{ locationId: string; tenantId: string } | null> {
  const mapping = await prisma.sourceMapping.findFirst({
    where: {
      sourceType: "WAHA",
      externalId: session,
      status: "ACTIVE",
    },
    include: { location: { select: { id: true, tenantId: true, status: true } } },
  });
  if (mapping && mapping.location.status !== "ARCHIVED") {
    return { locationId: mapping.location.id, tenantId: mapping.location.tenantId };
  }

  const byAtlasId = await prisma.location.findUnique({
    where: { atlasLocationId: session },
    select: { id: true, tenantId: true, status: true },
  });
  if (byAtlasId && byAtlasId.status !== "ARCHIVED") {
    return { locationId: byAtlasId.id, tenantId: byAtlasId.tenantId };
  }
  return null;
}

async function ingestSessionStatus(input: unknown): Promise<IngestResult | null> {
  const st = parseWahaSessionStatus(input);
  if (st === null) return null;
  if ("error" in st) return { ok: false, error: st.error };
  const loc = await resolveLocationForWahaSession(st.session);
  if (!loc) return { ok: true, ignored: "unmapped_session" };
  const down = st.status === "FAILED" || st.status === "STOPPED";
  const up = st.status === "WORKING";
  if (!down && !up) return { ok: true, ignored: "skipped_event" };
  const location = await prisma.location.findUnique({
    where: { id: loc.locationId },
    select: { name: true, atlasLocationId: true },
  });
  const branch = location?.name || st.session;
  const action = down ? "WAHA_SESSION_DOWN" : "WAHA_SESSION_UP";
  await writeAudit({
    tenantId: loc.tenantId,
    action,
    objectType: "location",
    objectId: loc.locationId,
    meta: { session: st.session, status: st.status, branch },
  });
  await recordNotice({
    tenantId: loc.tenantId,
    kind: down ? "waha_down" : "waha_up",
    title: down ? `WhatsApp disconnected · ${branch}` : `WhatsApp connected · ${branch}`,
    body: down
      ? `Session ${st.session} is ${st.status}. Scan QR again on the outlet if chats should keep landing.`
      : `Session ${st.session} is WORKING again.`,
    href: `/locations/${loc.locationId}`,
  });
  return { ok: true, ignored: "skipped_event" };
}

export async function ingestWahaPayload(input: unknown): Promise<IngestResult> {
  const statusResult = await ingestSessionStatus(input);
  if (statusResult) return statusResult;
  if (!(await isWahaIngestEnabled())) {
    return { ok: true, ignored: "kill_switch" };
  }
  const parsed = parseWahaEvent(input);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const ev = parsed.event.toLowerCase();
  if (ev !== "message" && ev !== "message.any") {
    return { ok: true, ignored: "skipped_event" };
  }
  if (!parsed.fromMe && isSecretCodeMessage(parsed.body)) {
    return { ok: true, ignored: "secret_code" };
  }

  const existingMsg = await prisma.waMessage.findUnique({
    where: { externalId: parsed.externalId },
    select: { conversationId: true },
  });
  if (existingMsg) {
    return { ok: true, conversationId: existingMsg.conversationId, duplicate: true };
  }

  const bound = await resolveLocationForWahaSession(parsed.session);
  if (!bound) return { ok: true, ignored: "unmapped_session" };

  const tenantId = bound.tenantId;
  const locationId = bound.locationId;
  let resolved = resolveIdentity(parsed.peerRaw, parsed.extraPhone);
  const remoteLid = lidFromRemote(input);
  if (remoteLid && !resolved.lid) {
    resolved = { ...resolved, lid: remoteLid };
  }
  if (!resolved.phone && resolved.lid) {
    const pn = await resolveLidToPhone(parsed.session, resolved.lid);
    if (pn) {
      resolved = mergeIdentity(resolved, resolveIdentity(`${pn}@c.us`));
    }
  }
  const incoming = resolved;

  const branch = await prisma.location.findUnique({
    where: { id: locationId },
    select: { phone: true },
  });
  if (incoming.phone && samePhone(incoming.phone, branch?.phone)) {
    return { ok: true, ignored: "skipped_event" };
  }

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

  const contactPatch = {
    phone: merged.phone,
    lid: merged.lid,
    identityConfidence: merged.confidence,
    displayName: parsed.displayName || found?.displayName || null,
  };

  let contact;
  if (found) {
    try {
      contact = await prisma.waContact.update({
        where: { id: found.id },
        data: { identifier: merged.identifier, ...contactPatch },
      });
    } catch (err) {
      if (!isPrismaP2002(err, "identifier")) throw err;
      const existingByIdent = await prisma.waContact.findUnique({
        where: { tenantId_identifier: { tenantId, identifier: merged.identifier } },
      });
      if (existingByIdent && existingByIdent.id !== found.id) {
        contact = await prisma.waContact.update({
          where: { id: existingByIdent.id },
          data: {
            phone: merged.phone ?? existingByIdent.phone,
            lid: existingByIdent.lid ?? merged.lid,
            identityConfidence: merged.confidence,
            displayName: parsed.displayName || existingByIdent.displayName,
          },
        });
      } else {
        contact = await prisma.waContact.update({
          where: { id: found.id },
          data: contactPatch,
        });
      }
    }
  } else {
    try {
      contact = await prisma.waContact.create({
        data: {
          tenantId,
          identifier: merged.identifier,
          phone: merged.phone,
          lid: merged.lid,
          identityConfidence: merged.confidence,
          displayName: parsed.displayName,
        },
      });
    } catch (err) {
      if (!isPrismaP2002(err, "identifier")) throw err;
      const existingByIdent = await prisma.waContact.findUnique({
        where: { tenantId_identifier: { tenantId, identifier: merged.identifier } },
      });
      if (!existingByIdent) throw err;
      contact = await prisma.waContact.update({
        where: { id: existingByIdent.id },
        data: {
          phone: merged.phone ?? existingByIdent.phone,
          lid: existingByIdent.lid ?? merged.lid,
          identityConfidence: merged.confidence,
          displayName: parsed.displayName || existingByIdent.displayName,
        },
      });
    }
  }

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
  try {
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
  } catch (err) {
    if (!isPrismaP2002(err, "externalId")) throw err;
    const dup = await prisma.waMessage.findUnique({
      where: { externalId: parsed.externalId },
      select: { conversationId: true },
    });
    if (dup) {
      return { ok: true, conversationId: dup.conversationId, duplicate: true };
    }
    throw err;
  }

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
