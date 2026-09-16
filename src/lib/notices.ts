import { prisma } from "@/lib/db";
import type { TenancySession } from "@/lib/tenancy";
import { brandWhereForSession, isPlatformMode } from "@/lib/tenancy";

const DEDUPE_MS = 30 * 60 * 1000;

export async function tenantIdsForNotices(session: TenancySession): Promise<string[] | "all"> {
  if (isPlatformMode(session)) return "all";
  if (session.tenantType === "AGENCY") {
    const brands = await prisma.tenant.findMany({
      where: brandWhereForSession(session),
      select: { id: true },
    });
    return [session.tenantId, ...brands.map((b) => b.id)];
  }
  return [session.tenantId];
}

export async function recordNotice(input: {
  tenantId: string;
  kind: string;
  title: string;
  body?: string;
  href?: string;
}): Promise<void> {
  const since = new Date(Date.now() - DEDUPE_MS);
  const dup = await prisma.inboxNotice.findFirst({
    where: {
      tenantId: input.tenantId,
      kind: input.kind,
      title: input.title,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  if (dup) return;
  await prisma.inboxNotice.create({
    data: {
      tenantId: input.tenantId,
      kind: input.kind,
      title: input.title.slice(0, 200),
      body: input.body ? input.body.slice(0, 500) : null,
      href: input.href || null,
    },
  });
}

export async function listNoticesForSession(
  session: TenancySession,
  seenAt: Date | null,
  take = 20
) {
  const ids = await tenantIdsForNotices(session);
  const where = ids === "all" ? {} : { tenantId: { in: ids } };
  const rows = await prisma.inboxNotice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: { tenant: { select: { name: true, slug: true } } },
  });
  const unread = seenAt
    ? rows.filter((r) => r.createdAt > seenAt).length
    : rows.length;
  return { rows, unread };
}
