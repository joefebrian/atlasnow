import { prisma } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/roles";
import type { Locale } from "@/lib/i18n/locale";
import {
  activityKind,
  actorLabel,
  humanizeAction,
  type ActivityView,
} from "@/lib/activity";
import type { TenancySession } from "@/lib/tenancy";
import { tenantIdsForNotices } from "@/lib/notices";
import { maybePurgeOldActivity } from "@/lib/activity-purge";

export async function listActivity(
  session: TenancySession,
  locale: Locale,
  take = 80
): Promise<ActivityView[]> {
  void maybePurgeOldActivity();
  const ids = await tenantIdsForNotices(session);
  const where = ids === "all" ? {} : { tenantId: { in: ids } };
  const rows = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      actor: {
        select: {
          name: true,
          email: true,
          memberships: { where: { status: "ACTIVE" }, select: { role: true } },
        },
      },
      tenant: { select: { name: true } },
    },
  });
  return rows.map((r) => {
    const meta = (() => {
      try {
        return r.metaJson ? (JSON.parse(r.metaJson) as Record<string, unknown>) : {};
      } catch {
        return {};
      }
    })();
    const branch = typeof meta.branch === "string" ? meta.branch : "";
    const extra = [r.tenant?.name, branch].filter(Boolean).join(" · ");
    return {
      id: r.id,
      at: r.createdAt.toISOString(),
      action: r.action,
      title: humanizeAction(r.action, locale),
      detail: extra,
      kind: activityKind(r.action),
      actorLabel: actorLabel({
        actorName: r.actor?.name ?? null,
        actorEmail: r.actor?.email ?? null,
        actorIsPlatformAdmin: (r.actor?.memberships || []).some((m) => isPlatformAdmin(m.role)),
        locale,
      }),
      tenantName: r.tenant?.name ?? null,
    };
  });
}
