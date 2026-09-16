import { prisma } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth";
import { canonPhone } from "@/lib/conversations/identity";
import { WHATSAPP_CLOUD_PROVIDER } from "@/lib/conversations/cloud-hq";
import { GOOGLE_PROVIDER } from "@/lib/google/config";
import { listAccessibleClientTenants } from "@/lib/locations/access";
import {
  formatRangeLabel,
  resolveDeskRange,
  type DeskRange,
  type DeskRangeQuery,
} from "@/lib/home/range";

export type HomeWaitingChat = {
  id: string;
  name: string;
  preview: string;
  locationName: string;
  brandName: string;
  lastMessageAt: string;
};

export type HomePendingIntake = {
  id: string;
  phone: string;
  trxId: string;
  locationName: string;
  brandName: string;
  createdAt: string;
};

export type HomeBrandRow = {
  id: string;
  name: string;
  slug: string;
  outlets: number;
  unreplied: number;
  pending: number;
  members: number;
  hqOn: boolean;
  stampOn: boolean;
};

export type PeriodStats = {
  stamps: number;
  newMembers: number;
  inboundChats: number;
  newReviews: number;
};

export type HomeDeskData = {
  brandCount: number;
  outlets: number;
  unreplied: number;
  pendingStamps: number;
  members: number;
  prospects: number;
  potential: number;
  unrepliedReviews: number;
  hqOnCount: number;
  stampOnCount: number;
  gbpMapped: number;
  gbpNeedLook: number;
  googleOn: boolean;
  waiting: HomeWaitingChat[];
  pending: HomePendingIntake[];
  brands: HomeBrandRow[];
  rangeFrom: string;
  rangeTo: string;
  rangeLabel: string;
  compare: boolean;
  priorFrom: string;
  priorTo: string;
  priorLabel: string;
  period: PeriodStats;
  prior: PeriodStats | null;
};

const ZERO_PERIOD: PeriodStats = {
  stamps: 0,
  newMembers: 0,
  inboundChats: 0,
  newReviews: 0,
};

function emptyDesk(range: DeskRange, locale: "en" | "id"): HomeDeskData {
  return {
    brandCount: 0,
    outlets: 0,
    unreplied: 0,
    pendingStamps: 0,
    members: 0,
    prospects: 0,
    potential: 0,
    unrepliedReviews: 0,
    hqOnCount: 0,
    stampOnCount: 0,
    gbpMapped: 0,
    gbpNeedLook: 0,
    googleOn: false,
    waiting: [],
    pending: [],
    brands: [],
    rangeFrom: range.from,
    rangeTo: range.to,
    rangeLabel: formatRangeLabel(range.from, range.to, locale),
    compare: range.compare,
    priorFrom: range.priorFrom,
    priorTo: range.priorTo,
    priorLabel: formatRangeLabel(range.priorFrom, range.priorTo, locale),
    period: ZERO_PERIOD,
    prior: range.compare ? ZERO_PERIOD : null,
  };
}

async function loadPeriodStats(
  ids: string[],
  start: Date,
  endExclusive: Date
): Promise<PeriodStats> {
  const [stamps, newMembers, inbound, newReviews] = await Promise.all([
    prisma.loyaltyStamp.count({
      where: { tenantId: { in: ids }, stampedAt: { gte: start, lt: endExclusive } },
    }),
    prisma.loyaltyMember.count({
      where: { tenantId: { in: ids }, createdAt: { gte: start, lt: endExclusive } },
    }),
    prisma.waMessage.groupBy({
      by: ["conversationId"],
      where: {
        direction: "IN",
        sentAt: { gte: start, lt: endExclusive },
        conversation: { tenantId: { in: ids } },
      },
    }),
    prisma.review.count({
      where: {
        location: { tenantId: { in: ids } },
        createTime: { gte: start, lt: endExclusive },
      },
    }),
  ]);
  return {
    stamps,
    newMembers,
    inboundChats: inbound.length,
    newReviews,
  };
}

function isUnreplied(row: {
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
}): boolean {
  return (
    row.lastInboundAt != null &&
    (row.lastOutboundAt == null || row.lastInboundAt > row.lastOutboundAt)
  );
}

export async function loadHomeDesk(
  session: SessionPayload,
  locale: "en" | "id",
  query: DeskRangeQuery = {}
): Promise<HomeDeskData> {
  const range = resolveDeskRange(query);
  const clients = await listAccessibleClientTenants(session);
  const ids = clients.map((c) => c.id);
  if (ids.length === 0) return emptyDesk(range, locale);

  const brandName = new Map(clients.map((c) => [c.id, c.name]));

  const [
    locations,
    programs,
    pendingIntakes,
    stampPhones,
    members,
    contacts,
    conversations,
    reviews,
    connectors,
    gbpMapped,
    gbpNeedLook,
    googleConnector,
    periodStats,
    priorStats,
  ] = await Promise.all([
    prisma.location.findMany({
      where: { tenantId: { in: ids }, status: { not: "ARCHIVED" }, kind: { not: "HQ" } },
      select: { tenantId: true },
    }),
    prisma.loyaltyProgram.findMany({
      where: { tenantId: { in: ids } },
      select: { tenantId: true, stampEnabled: true },
    }),
    prisma.loyaltyIntake.findMany({
      where: { tenantId: { in: ids }, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tenantId: true,
        phone: true,
        trxId: true,
        createdAt: true,
        location: { select: { name: true } },
      },
    }),
    prisma.loyaltyStamp.groupBy({
      by: ["tenantId", "memberPhone"],
      where: { tenantId: { in: ids } },
    }),
    prisma.loyaltyMember.findMany({
      where: { tenantId: { in: ids } },
      select: { tenantId: true, phone: true },
    }),
    prisma.waContact.findMany({
      where: {
        tenantId: { in: ids },
        AND: [{ phone: { not: null } }, { phone: { not: "" } }],
      },
      select: { tenantId: true, phone: true },
    }),
    prisma.waConversation.findMany({
      where: { tenantId: { in: ids }, status: "OPEN" },
      orderBy: { lastMessageAt: "desc" },
      select: {
        id: true,
        tenantId: true,
        lastInboundAt: true,
        lastOutboundAt: true,
        lastPreview: true,
        lastMessageAt: true,
        location: { select: { name: true } },
        contact: { select: { displayName: true, phone: true } },
      },
    }),
    prisma.review.findMany({
      where: { location: { tenantId: { in: ids } } },
      select: { replyComment: true, location: { select: { tenantId: true } } },
    }),
    prisma.connector.findMany({
      where: {
        tenantId: { in: ids },
        provider: WHATSAPP_CLOUD_PROVIDER,
        status: "CONNECTED",
      },
      select: { tenantId: true },
    }),
    prisma.sourceMapping.count({
      where: {
        sourceType: "GOOGLE_BUSINESS_PROFILE",
        status: "ACTIVE",
        location: { tenantId: { in: ids }, status: { not: "ARCHIVED" }, kind: { not: "HQ" } },
      },
    }),
    prisma.location.count({
      where: {
        tenantId: { in: ids },
        status: { not: "ARCHIVED" },
        kind: { not: "HQ" },
        OR: [{ readiness: "BLOCKED" }, { readiness: "PARTIAL" }, { readiness: "DRAFT" }],
      },
    }),
    prisma.connector.findFirst({
      where: {
        provider: GOOGLE_PROVIDER,
        status: "CONNECTED",
        tenantId: {
          in: [...ids, session.tenantId, session.agencyId].filter((x): x is string => Boolean(x)),
        },
      },
      select: { id: true },
    }),
    loadPeriodStats(ids, range.start, range.endExclusive),
    range.compare
      ? loadPeriodStats(ids, range.priorStart, range.priorEndExclusive)
      : Promise.resolve(null),
  ]);

  const stamped = new Set(stampPhones.map((s) => `${s.tenantId}:${canonPhone(s.memberPhone)}`));
  const registered = new Set(members.map((m) => `${m.tenantId}:${canonPhone(m.phone)}`));
  const contactKeys = new Set(
    contacts
      .map((c) => `${c.tenantId}:${canonPhone(c.phone || "")}`)
      .filter((k) => k.split(":")[1]?.length >= 8)
  );

  let potential = 0;
  for (const key of contactKeys) {
    if (!registered.has(key)) potential += 1;
  }

  const waitingAll = conversations.filter(isUnreplied);
  const unrepliedReviews = reviews.filter((r) => !r.replyComment?.trim()).length;

  const brands: HomeBrandRow[] = clients.map((c) => {
    const memberCount = stampPhones.filter((s) => s.tenantId === c.id).length;
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      outlets: locations.filter((l) => l.tenantId === c.id).length,
      unreplied: waitingAll.filter((x) => x.tenantId === c.id).length,
      pending: pendingIntakes.filter((x) => x.tenantId === c.id).length,
      members: memberCount,
      hqOn: connectors.some((x) => x.tenantId === c.id),
      stampOn: programs.some((p) => p.tenantId === c.id && p.stampEnabled),
    };
  });

  return {
    brandCount: clients.length,
    outlets: locations.length,
    unreplied: waitingAll.length,
    pendingStamps: pendingIntakes.length,
    members: stamped.size,
    prospects: Math.max(0, registered.size - stamped.size),
    potential,
    unrepliedReviews,
    hqOnCount: connectors.length,
    stampOnCount: programs.filter((p) => p.stampEnabled).length,
    gbpMapped,
    gbpNeedLook,
    googleOn: Boolean(googleConnector),
    waiting: waitingAll.slice(0, 6).map((row) => ({
      id: row.id,
      name: row.contact.displayName || row.contact.phone || "WhatsApp",
      preview: row.lastPreview || "",
      locationName: row.location.name,
      brandName: brandName.get(row.tenantId) || "",
      lastMessageAt: row.lastMessageAt.toISOString(),
    })),
    pending: pendingIntakes.slice(0, 6).map((row) => ({
      id: row.id,
      phone: row.phone,
      trxId: row.trxId,
      locationName: row.location.name,
      brandName: brandName.get(row.tenantId) || "",
      createdAt: row.createdAt.toISOString(),
    })),
    brands,
    rangeFrom: range.from,
    rangeTo: range.to,
    rangeLabel: formatRangeLabel(range.from, range.to, locale),
    compare: range.compare,
    priorFrom: range.priorFrom,
    priorTo: range.priorTo,
    priorLabel: formatRangeLabel(range.priorFrom, range.priorTo, locale),
    period: periodStats,
    prior: priorStats,
  };
}
