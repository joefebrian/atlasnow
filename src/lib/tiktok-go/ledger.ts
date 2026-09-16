import { prisma } from "@/lib/db";

export async function recordGoEvent(opts: {
  tenantId: string;
  locationId: string;
  kind: "QUERY" | "REDEEM" | "DENY";
  demo: boolean;
  title: string;
  detail?: string;
  codeHint?: string;
  shopOrderId?: string | null;
}) {
  return prisma.loyaltyGoEvent.create({
    data: {
      tenantId: opts.tenantId,
      locationId: opts.locationId,
      kind: opts.kind,
      demo: opts.demo,
      title: opts.title.slice(0, 180),
      detail: (opts.detail || "").slice(0, 400),
      codeHint: (opts.codeHint || "").slice(0, 40),
      shopOrderId: opts.shopOrderId || null,
    },
  });
}

export async function listGoEvents(tenantId: string, take = 40) {
  return prisma.loyaltyGoEvent.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take,
    include: { location: { select: { name: true } } },
  });
}
