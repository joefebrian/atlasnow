import { prisma } from "@/lib/db";
import { getCloudHqConfig } from "@/lib/conversations/cloud-hq";
import { sendCloudHqDocument, sendCloudHqImage, sendCloudHqTemplate, sendCloudHqText } from "@/lib/conversations/cloud-send";
import type { BroadcastMediaKind } from "@/lib/broadcast/media";
import { isSecretCodeMessage } from "@/lib/conversations/secret-code";
import { canonPhone } from "@/lib/conversations/identity";
import { CONVERSATION_GAP_MS } from "@/lib/conversations/window";
import { birthdayPeriodKey } from "@/lib/loyalty/rules";
import { BIRTHDAY_TEMPLATE_BODY_ID, BIRTHDAY_TEMPLATE_NAME } from "@/lib/loyalty/birthday-h2";
import { birthdayGreetingFillForMember, markBirthdayGreetingSent } from "@/lib/loyalty/birthday-wa-record";
import { listWabaTemplates } from "@/lib/broadcast/templates";
import { createBroadcastBatch, recordBroadcastSend } from "@/lib/broadcast/history";

export const BROADCAST_MAX = 50;

export type BroadcastPerson = {
  conversationId: string;
  name: string;
  phone: string;
  lastInboundAt: string;
  preview: string;
};

export type BroadcastOptIn = {
  phone: string;
  name: string;
};

export type BroadcastAudience = {
  hqOn: boolean;
  windowCount: number;
  optedInCount: number;
  people: BroadcastPerson[];
  optedIn: BroadcastOptIn[];
};

function windowSince() {
  return new Date(Date.now() - CONVERSATION_GAP_MS);
}

export async function loadBroadcastAudience(tenantId: string): Promise<BroadcastAudience> {
  const since = windowSince();
  const [hq, optedRows, rows] = await Promise.all([
    getCloudHqConfig(tenantId),
    prisma.loyaltyMember.findMany({
      where: { tenantId, birthdayWaOptIn: true },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { phone: true, name: true },
    }),
    prisma.waConversation.findMany({
      where: {
        tenantId,
        provider: "META_CLOUD",
        lastInboundAt: { gte: since },
        location: { kind: "HQ" },
        contact: { AND: [{ phone: { not: null } }, { phone: { not: "" } }] },
      },
      orderBy: { lastInboundAt: "desc" },
      take: 80,
      select: {
        id: true,
        lastInboundAt: true,
        lastPreview: true,
        contact: { select: { displayName: true, phone: true } },
      },
    }),
  ]);

  const seen = new Set<string>();
  const people: BroadcastPerson[] = [];
  for (const row of rows) {
    if (isSecretCodeMessage(row.lastPreview || "")) continue;
    const phone = canonPhone(row.contact.phone || "");
    if (phone.length < 8) continue;
    if (seen.has(phone)) continue;
    seen.add(phone);
    people.push({
      conversationId: row.id,
      name: row.contact.displayName || phone,
      phone,
      lastInboundAt: (row.lastInboundAt || new Date()).toISOString(),
      preview: row.lastPreview || "",
    });
  }

  const optedIn: BroadcastOptIn[] = [];
  const seenOpt = new Set<string>();
  for (const m of optedRows) {
    const phone = canonPhone(m.phone);
    if (phone.length < 8 || seenOpt.has(phone)) continue;
    seenOpt.add(phone);
    optedIn.push({ phone, name: m.name || phone });
  }

  return {
    hqOn: Boolean(hq),
    windowCount: people.length,
    optedInCount: optedIn.length,
    people,
    optedIn,
  };
}

export async function sendBroadcast(opts: {
  tenantId: string;
  createdByUserId?: string | null;
  conversationIds: string[];
  text: string;
  media?: { id: string; kind: BroadcastMediaKind; filename?: string } | null;
}): Promise<{ sent: number; failed: { phone: string; error: string }[] }> {
  const text = opts.text.trim();
  const media = opts.media;
  if (!text && !media?.id) return { sent: 0, failed: [{ phone: "", error: "empty" }] };
  const cfg = await getCloudHqConfig(opts.tenantId);
  if (!cfg) return { sent: 0, failed: [{ phone: "", error: "hq_off" }] };

  const ids = [...new Set(opts.conversationIds)].slice(0, BROADCAST_MAX);
  const since = windowSince();
  const rows = await prisma.waConversation.findMany({
    where: {
      id: { in: ids },
      tenantId: opts.tenantId,
      provider: "META_CLOUD",
      lastInboundAt: { gte: since },
      location: { kind: "HQ" },
    },
    select: {
      id: true,
      lastPreview: true,
      contact: { select: { phone: true } },
    },
  });

  if (!rows.length) return { sent: 0, failed: [] };

  const batch = await createBroadcastBatch({
    tenantId: opts.tenantId,
    createdByUserId: opts.createdByUserId,
    kind: "SESSION",
  });

  let sent = 0;
  const failed: { phone: string; error: string }[] = [];
  for (const row of rows) {
    if (isSecretCodeMessage(row.lastPreview || "")) continue;
    const phone = row.contact.phone || "";
    const result = media?.id
      ? media.kind === "document"
        ? await sendCloudHqDocument({
            config: cfg,
            toPhone: phone,
            mediaId: media.id,
            filename: media.filename,
            caption: text || undefined,
            conversationId: row.id,
          })
        : await sendCloudHqImage({
            config: cfg,
            toPhone: phone,
            mediaId: media.id,
            caption: text || undefined,
            conversationId: row.id,
          })
      : await sendCloudHqText({
          config: cfg,
          toPhone: phone,
          body: text,
          conversationId: row.id,
        });
    if (result.ok) {
      sent += 1;
      await recordBroadcastSend({
        batchId: batch.id,
        tenantId: opts.tenantId,
        phone,
        wamid: result.messageId,
        ok: true,
      });
    } else {
      failed.push({ phone, error: result.error });
      await recordBroadcastSend({
        batchId: batch.id,
        tenantId: opts.tenantId,
        phone,
        ok: false,
        error: result.error,
      });
    }
  }
  return { sent, failed };
}

export async function sendTemplateBroadcast(opts: {
  tenantId: string;
  createdByUserId?: string | null;
  phones: string[];
  templateName: string;
  language: string;
  header?: { kind: BroadcastMediaKind; mediaId: string; filename?: string } | null;
}): Promise<{ sent: number; failed: { phone: string; error: string }[] }> {
  const cfg = await getCloudHqConfig(opts.tenantId);
  if (!cfg) return { sent: 0, failed: [{ phone: "", error: "hq_off" }] };
  const name = opts.templateName.trim();
  const language = (opts.language || "id").trim();
  if (!name) return { sent: 0, failed: [{ phone: "", error: "template" }] };

  const allowed = new Set(
    (
      await prisma.loyaltyMember.findMany({
        where: { tenantId: opts.tenantId, birthdayWaOptIn: true },
        select: { phone: true },
      })
    ).map((m) => canonPhone(m.phone))
  );

  const phones = [...new Set(opts.phones.map(canonPhone))]
    .filter((p) => p.length >= 8 && allowed.has(p))
    .slice(0, BROADCAST_MAX);

  let birthdayBody = "";
  if (name === BIRTHDAY_TEMPLATE_NAME) {
    try {
      const tpls = await listWabaTemplates(cfg);
      birthdayBody =
        tpls.find((t) => t.name === name && t.language === language)?.bodyText ||
        tpls.find((t) => t.name === name)?.bodyText ||
        BIRTHDAY_TEMPLATE_BODY_ID;
    } catch {
      birthdayBody = "";
    }
  }

  if (!phones.length) return { sent: 0, failed: [] };

  const batch = await createBroadcastBatch({
    tenantId: opts.tenantId,
    createdByUserId: opts.createdByUserId,
    kind: "TEMPLATE",
    templateName: name,
  });

  let sent = 0;
  const failed: { phone: string; error: string }[] = [];
  for (const phone of phones) {
    const conv = await prisma.waConversation.findFirst({
      where: {
        tenantId: opts.tenantId,
        location: { kind: "HQ" },
        contact: { phone },
      },
      orderBy: { lastMessageAt: "desc" },
      select: { id: true },
    });
    let bodyParams: string[] | undefined;
    let bodyNamedParams: { name: string; text: string }[] | undefined;
    if (name === BIRTHDAY_TEMPLATE_NAME) {
      const filled = await birthdayGreetingFillForMember({
        tenantId: opts.tenantId,
        phone,
        bodyText: birthdayBody,
      });
      if (!filled.ok) {
        failed.push({ phone, error: filled.reason });
        await recordBroadcastSend({
          batchId: batch.id,
          tenantId: opts.tenantId,
          phone,
          ok: false,
          error: filled.reason,
        });
        continue;
      }
      bodyParams = filled.positional;
      bodyNamedParams = filled.named;
    }
    const result = await sendCloudHqTemplate({
      config: cfg,
      toPhone: phone,
      name,
      language,
      header: opts.header || undefined,
      bodyParams,
      bodyNamedParams,
      conversationId: conv?.id,
    });
    if (result.ok) {
      sent += 1;
      await recordBroadcastSend({
        batchId: batch.id,
        tenantId: opts.tenantId,
        phone,
        wamid: result.messageId,
        ok: true,
      });
      if (name === BIRTHDAY_TEMPLATE_NAME) {
        const tz =
          (await prisma.tenant.findUnique({ where: { id: opts.tenantId }, select: { timezone: true } }))?.timezone ||
          "Asia/Jakarta";
        await markBirthdayGreetingSent({
          tenantId: opts.tenantId,
          phone,
          periodKey: birthdayPeriodKey(new Date(), tz),
          status: "SENT",
        });
      }
    } else {
      failed.push({ phone, error: result.error });
      await recordBroadcastSend({
        batchId: batch.id,
        tenantId: opts.tenantId,
        phone,
        ok: false,
        error: result.error,
      });
    }
  }
  return { sent, failed };
}
