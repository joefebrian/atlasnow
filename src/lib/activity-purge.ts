import { prisma } from "@/lib/db";

/** Default: keep change log 14 days. Env ACTIVITY_RETENTION_DAYS overrides (min 1). */
export const ACTIVITY_RETENTION_DAYS_DEFAULT = 14;

export function activityRetentionDays(): number {
  const raw = Number.parseInt(process.env.ACTIVITY_RETENTION_DAYS || "", 10);
  if (Number.isFinite(raw) && raw >= 1) return Math.min(raw, 3650);
  return ACTIVITY_RETENTION_DAYS_DEFAULT;
}

export function activityCutoff(now = new Date(), days = activityRetentionDays()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function purgeOldActivity(now = new Date()): Promise<{ audit: number; notices: number; days: number }> {
  const days = activityRetentionDays();
  const before = activityCutoff(now, days);
  const [audit, notices] = await Promise.all([
    prisma.auditEvent.deleteMany({ where: { createdAt: { lt: before } } }),
    prisma.inboxNotice.deleteMany({ where: { createdAt: { lt: before } } }),
  ]);
  return { audit: audit.count, notices: notices.count, days };
}

const DAY_MS = 24 * 60 * 60 * 1000;
let lastSweep = 0;

/** At most once per 6 hours per process — used when someone opens Change log. */
export async function maybePurgeOldActivity(): Promise<void> {
  const now = Date.now();
  if (now - lastSweep < 6 * 60 * 60 * 1000) return;
  try {
    const r = await purgeOldActivity();
    lastSweep = now;
    if (r.audit || r.notices) {
      console.info(`[activity-purge] dropped audit=${r.audit} notices=${r.notices} older than ${r.days}d`);
    }
  } catch (e) {
    console.warn("[activity-purge]", e);
  }
}

export function startActivityPurgeScheduler() {
  const tick = () => {
    void maybePurgeOldActivity();
  };
  setTimeout(tick, 45_000);
  setInterval(tick, DAY_MS);
}
