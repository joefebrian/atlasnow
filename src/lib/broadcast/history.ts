import { prisma } from "@/lib/db";
import { canonPhone } from "@/lib/conversations/identity";
import {
  ACTION_WINDOW_MS,
  applyMetaStatus,
  isActionInboundType,
  type BroadcastSendStatus,
  type CloudStatusEvent,
} from "./status";

export type BroadcastBatchKind = "SESSION" | "TEMPLATE" | "BIRTHDAY_H2";

export async function createBroadcastBatch(opts: {
  tenantId: string;
  createdByUserId?: string | null;
  kind: BroadcastBatchKind;
  templateName?: string | null;
}) {
  return prisma.broadcastBatch.create({
    data: {
      tenantId: opts.tenantId,
      createdByUserId: opts.createdByUserId || null,
      kind: opts.kind,
      templateName: opts.templateName || null,
    },
  });
}

export async function recordBroadcastSend(opts: {
  batchId: string;
  tenantId: string;
  phone: string;
  wamid?: string | null;
  ok: boolean;
  error?: string;
}) {
  const phone = canonPhone(opts.phone);
  const now = new Date();
  await prisma.broadcastSend.create({
    data: {
      batchId: opts.batchId,
      tenantId: opts.tenantId,
      phone,
      wamid: opts.ok && opts.wamid ? opts.wamid : null,
      status: opts.ok ? "SENT" : "FAILED",
      sentAt: opts.ok ? now : null,
      failedAt: opts.ok ? null : now,
      errorTitle: opts.ok ? "" : (opts.error || "send_failed").slice(0, 240),
    },
  });
  await prisma.broadcastBatch.update({
    where: { id: opts.batchId },
    data: { attemptedCount: { increment: 1 } },
  });
}

export async function applyBroadcastStatuses(statuses: CloudStatusEvent[]) {
  let n = 0;
  for (const st of statuses) {
    if (!st.wamid) continue;
    const row = await prisma.broadcastSend.findUnique({ where: { wamid: st.wamid } });
    if (!row) continue;
    const next = applyMetaStatus(
      {
        status: row.status as BroadcastSendStatus,
        deliveredAt: row.deliveredAt,
        readAt: row.readAt,
        failedAt: row.failedAt,
        errorCode: row.errorCode,
        errorTitle: row.errorTitle,
        pricingCategory: row.pricingCategory,
        pricingType: row.pricingType,
      },
      {
        status: st.status,
        at: st.at,
        errorCode: st.errorCode,
        errorTitle: st.errorTitle,
        pricingCategory: st.pricingCategory,
        pricingType: st.pricingType,
      }
    );
    await prisma.broadcastSend.update({
      where: { id: row.id },
      data: {
        status: next.status,
        deliveredAt: next.deliveredAt,
        readAt: next.readAt,
        failedAt: next.failedAt,
        errorCode: next.errorCode ?? row.errorCode,
        errorTitle: next.errorTitle ?? row.errorTitle,
        pricingCategory: next.pricingCategory ?? row.pricingCategory,
        pricingType: next.pricingType ?? row.pricingType,
      },
    });
    n += 1;
  }
  return n;
}

export async function markBroadcastAction(opts: {
  tenantId: string;
  phone: string;
  at: Date;
  msgType: string;
}) {
  if (!isActionInboundType(opts.msgType)) return 0;
  const phone = canonPhone(opts.phone);
  if (phone.length < 8) return 0;
  const since = new Date(opts.at.getTime() - ACTION_WINDOW_MS);
  const row = await prisma.broadcastSend.findFirst({
    where: {
      tenantId: opts.tenantId,
      phone,
      repliedAt: null,
      status: { not: "FAILED" },
      OR: [{ sentAt: { gte: since, lte: opts.at } }, { sentAt: null, createdAt: { gte: since, lte: opts.at } }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return 0;
  await prisma.broadcastSend.update({
    where: { id: row.id },
    data: { repliedAt: opts.at },
  });
  return 1;
}

export async function listBroadcastHistory(tenantId: string) {
  const batches = await prisma.broadcastBatch.findMany({
    where: { tenantId, attemptedCount: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      createdBy: { select: { name: true, email: true } },
      sends: { orderBy: { createdAt: "asc" } },
    },
  });
  return batches.map((b) => {
    const sends = b.sends;
    const sent = sends.filter((s) => ["SENT", "DELIVERED", "READ"].includes(s.status)).length;
    const delivered = sends.filter((s) => s.deliveredAt || s.status === "READ" || s.status === "DELIVERED").length;
    const read = sends.filter((s) => s.readAt || s.status === "READ").length;
    const failed = sends.filter((s) => s.status === "FAILED").length;
    const action = sends.filter((s) => s.repliedAt).length;
    return {
      id: b.id,
      kind: b.kind,
      templateName: b.templateName,
      createdAt: b.createdAt.toISOString(),
      by: b.createdBy?.name || b.createdBy?.email || null,
      attempted: b.attemptedCount,
      sent,
      delivered,
      read,
      failed,
      action,
      rows: sends.map((s) => ({
        id: s.id,
        phone: s.phone,
        status: s.status,
        sentAt: s.sentAt?.toISOString() || null,
        deliveredAt: s.deliveredAt?.toISOString() || null,
        readAt: s.readAt?.toISOString() || null,
        failedAt: s.failedAt?.toISOString() || null,
        errorTitle: s.errorTitle,
        errorCode: s.errorCode,
        pricingCategory: s.pricingCategory,
        repliedAt: s.repliedAt?.toISOString() || null,
      })),
    };
  });
}
