import { prisma } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const SWEEP_MS = 6 * 60 * 60 * 1000;
let lastSweep = 0;

export async function purgeExpiredInboxFiles(now = new Date(), tenantId?: string): Promise<{ purged: number }> {
  let purged = 0;
  for (const days of [7, 14, 30] as const) {
    const before = new Date(now.getTime() - days * DAY_MS);
    const result = await prisma.waMessage.updateMany({
      where: {
        mediaPurgedAt: null,
        sentAt: { lt: before },
        conversation: {
          ...(tenantId ? { tenantId } : {}),
          tenant: { inboxImageRetentionDays: days },
        },
        OR: [{ inboxImage: true }, { mediaMime: { not: "" } }, { mediaCloudId: { not: "" } }],
      },
      data: { mediaImage: null, mediaMime: "", mediaCloudId: "", mediaPurgedAt: now },
    });
    purged += result.count;
  }
  return { purged };
}

export async function maybePurgeExpiredInboxFiles(tenantId?: string): Promise<void> {
  const now = Date.now();
  if (now - lastSweep < SWEEP_MS) return;
  try {
    await purgeExpiredInboxFiles(new Date(), tenantId);
    lastSweep = Date.now();
  } catch (error) {
    console.warn("[inbox-media-purge]", error);
  }
}
