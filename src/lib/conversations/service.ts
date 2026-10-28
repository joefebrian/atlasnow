import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { lookupMetaPeerLabel, metaPeerIdFromContact, shouldFetchMetaDisplayName } from "./meta-profile";

export type ConversationListItem = {
  id: string;
  lastMessageAt: string;
  contact: {
    displayName: string | null;
    phone: string | null;
    lid: string | null;
    identifier: string;
    confidence: string;
  };
  preview: string;
  location: { id: string; name: string };
  direction: "IN" | "OUT" | "UNREPLIED";
  sessionId: string;
  provider: string;
  /** Mapped Page name, IG handle, or HQ number — what Meta Review calls the asset. */
  assetLabel: string | null;
};

type ListOpts = {
  q?: string;
  filter?: "all" | "unreplied";
  locationId?: string;
  tenantId?: string;
  provider?: string;
};

type ConversationRow = {
  id: string;
  tenantId: string;
  sessionId: string;
  lastMessageAt: Date;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  lastPreview: string;
  provider: string;
  contact: {
    id: string;
    displayName: string | null;
    phone: string | null;
    lid: string | null;
    identifier: string;
    identityConfidence: string;
  };
  location: { id: string; name: string };
};

/** lastInboundAt != null AND (lastOutboundAt == null OR lastInboundAt > lastOutboundAt) */
function isUnreplied(row: {
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
}): boolean {
  return (
    row.lastInboundAt != null &&
    (row.lastOutboundAt == null || row.lastInboundAt > row.lastOutboundAt)
  );
}

function directionOf(row: {
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
}): ConversationListItem["direction"] {
  if (isUnreplied(row)) return "UNREPLIED";
  if (!row.lastInboundAt || (row.lastOutboundAt && row.lastOutboundAt >= row.lastInboundAt)) {
    return "OUT";
  }
  return "IN";
}

function toListItem(row: ConversationRow): ConversationListItem {
  return {
    id: row.id,
    lastMessageAt: row.lastMessageAt.toISOString(),
    contact: {
      displayName: row.contact.displayName,
      phone: row.contact.phone,
      lid: row.contact.lid,
      identifier: row.contact.identifier,
      confidence: row.contact.identityConfidence,
    },
    preview: row.lastPreview,
    location: { id: row.location.id, name: row.location.name },
    direction: directionOf(row),
    sessionId: row.sessionId,
    provider: row.provider,
    assetLabel: null,
  };
}

async function lookupAssetLabels(
  rows: { provider: string; sessionId: string }[]
): Promise<Map<string, string>> {
  const pairs = new Map<string, { sourceType: string; externalId: string }>();
  for (const r of rows) {
    pairs.set(`${r.provider}:${r.sessionId}`, {
      sourceType: r.provider,
      externalId: r.sessionId,
    });
  }
  const list = [...pairs.values()];
  if (list.length === 0) return new Map();
  const found = await prisma.sourceMapping.findMany({
    where: {
      status: "ACTIVE",
      OR: list.map((p) => ({
        sourceType: p.sourceType,
        externalId: p.externalId,
      })),
    },
    select: { sourceType: true, externalId: true, externalLabel: true },
  });
  const out = new Map<string, string>();
  for (const m of found) {
    if (m.externalLabel) out.set(`${m.sourceType}:${m.externalId}`, m.externalLabel);
  }
  return out;
}

function withAssetLabels(
  items: ConversationListItem[],
  labels: Map<string, string>
): ConversationListItem[] {
  return items.map((item) => ({
    ...item,
    assetLabel: labels.get(`${item.provider}:${item.sessionId}`) ?? null,
  }));
}

async function hydrateMetaDisplayNames(rows: ConversationRow[]): Promise<void> {
  const seen = new Set<string>();
  let n = 0;
  for (const row of rows) {
    if (n >= 8) break;
    if (row.provider !== "FACEBOOK" && row.provider !== "INSTAGRAM") continue;
    if (!shouldFetchMetaDisplayName(row.contact.displayName)) continue;
    if (seen.has(row.contact.id)) continue;
    seen.add(row.contact.id);
    const peerId = metaPeerIdFromContact(row.contact);
    if (!peerId) continue;
    n += 1;
    const label = await lookupMetaPeerLabel({
      tenantId: row.tenantId,
      provider: row.provider,
      sessionId: row.sessionId,
      peerId,
    });
    if (!label) continue;
    await prisma.waContact.update({
      where: { id: row.contact.id },
      data: { displayName: label },
    });
    row.contact.displayName = label;
  }
}

const includeList = {
  contact: true,
  location: { select: { id: true, name: true } },
} as const;

function listWhere(opts: ListOpts): Prisma.WaConversationWhereInput {
  const q = opts.q?.trim() || undefined;
  const locationId = opts.locationId || undefined;
  const provider = opts.provider?.trim() || undefined;
  const clauses: Prisma.WaConversationWhereInput[] = [];

  if (q) {
    clauses.push({
      OR: [
        { lastPreview: { contains: q } },
        { contact: { phone: { contains: q } } },
        { contact: { lid: { contains: q } } },
        { contact: { displayName: { contains: q } } },
        { contact: { identifier: { contains: q } } },
      ],
    });
  }

  // SQL superset only — do not AND lastOutboundAt == null (would drop
  // inbound-after-outbound). Full predicate applied in JS via isUnreplied().
  if (opts.filter === "unreplied") {
    clauses.push({ lastInboundAt: { not: null } });
  }

  return {
    status: "OPEN",
    ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
    ...(locationId ? { locationId } : {}),
    ...(provider ? { provider } : {}),
    ...(clauses.length ? { AND: clauses } : {}),
  };
}

export async function listConversations(opts: ListOpts = {}): Promise<{
  conversations: ConversationListItem[];
  stats: { total: number; unreplied: number; open: number; mappings: number };
}> {
  const locationId = opts.locationId || undefined;
  const q = opts.q?.trim() || undefined;
  const tenantId = opts.tenantId || undefined;
  const provider = opts.provider || undefined;
  const baseWhere = listWhere({ q, locationId, tenantId, provider, filter: "all" });
  const listFilter = listWhere(opts);

  const [rows, total, open, unrepliedCandidates, mappings] = await Promise.all([
    prisma.waConversation.findMany({
      where: listFilter,
      include: includeList,
      orderBy: { lastMessageAt: "desc" },
      take: 200,
    }),
    prisma.waConversation.count({ where: baseWhere }),
    prisma.waConversation.count({
      where: {
        status: "OPEN",
        ...(tenantId ? { tenantId } : {}),
        ...(locationId ? { locationId } : {}),
      },
    }),
    prisma.waConversation.findMany({
      where: { ...baseWhere, lastInboundAt: { not: null } },
      select: { lastInboundAt: true, lastOutboundAt: true },
    }),
    prisma.sourceMapping.count({
      where: {
        status: "ACTIVE",
        sourceType: provider
          ? provider
          : { in: ["WAHA", "FACEBOOK", "INSTAGRAM", "TIKTOK", "META_CLOUD"] },
        ...(tenantId ? { location: { tenantId } } : {}),
      },
    }),
  ]);

  const filtered = opts.filter === "unreplied" ? rows.filter(isUnreplied) : rows;
  await hydrateMetaDisplayNames(filtered);
  const conversations = filtered.map(toListItem);
  const labels = await lookupAssetLabels(conversations);

  return {
    conversations: withAssetLabels(conversations, labels),
    stats: {
      total,
      unreplied: unrepliedCandidates.filter(isUnreplied).length,
      open,
      mappings,
    },
  };
}

export async function getConversationThread(
  id: string,
  actorUserId: string
): Promise<null | {
  conversation: ConversationListItem & { tenantId: string };
  messages: Array<{
    id: string;
    direction: string;
    body: string;
    sentAt: string;
    fromMe: boolean;
    source: string;
  }>;
}> {
  const row = await prisma.waConversation.findUnique({
    where: { id },
    include: {
      ...includeList,
      messages: { orderBy: { sentAt: "asc" } },
    },
  });
  if (!row) return null;

  if (
    (row.provider === "FACEBOOK" || row.provider === "INSTAGRAM") &&
    shouldFetchMetaDisplayName(row.contact.displayName)
  ) {
    const label = await lookupMetaPeerLabel({
      tenantId: row.tenantId,
      provider: row.provider,
      sessionId: row.sessionId,
      peerId: metaPeerIdFromContact(row.contact),
    });
    if (label) {
      row.contact.displayName = label;
      await prisma.waContact.update({
        where: { id: row.contact.id },
        data: { displayName: label },
      });
    }
  }

  await prisma.auditEvent.create({
    data: {
      tenantId: row.tenantId,
      actorId: actorUserId,
      action: "conversation.thread_opened",
      objectType: "WaConversation",
      objectId: id,
      metaJson: JSON.stringify({ conversationId: id }),
    },
  });

  const item = toListItem(row);
  const labels = await lookupAssetLabels([item]);
  const labeled = withAssetLabels([item], labels)[0] ?? item;

  return {
    conversation: { ...labeled, tenantId: row.tenantId },
    messages: row.messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      sentAt: m.sentAt.toISOString(),
      fromMe: m.fromMe,
      source: m.source || "",
    })),
  };
}

export type CustomerListItem = {
  id: string;
  phone: string | null;
  lid: string | null;
  displayName: string | null;
  confidence: string;
  lastSeenAt: string | null;
  conversationCount: number;
  client: { id: string; name: string } | null;
  locations: { id: string; name: string }[];
};

export type CustomerFilterOptions = {
  clients: { id: string; name: string }[];
  locations: { id: string; name: string; tenantId: string }[];
};

export async function listCustomers(opts: {
  isAgencyStaff: boolean;
  tenantId: string;
  q?: string;
  clientId?: string;
  locationId?: string;
}): Promise<{
  customers: CustomerListItem[];
  stats: { total: number; withPhone: number };
  filters: CustomerFilterOptions;
}> {
  const q = opts.q?.trim() || undefined;
  const scopedTenantId = opts.isAgencyStaff
    ? opts.clientId || undefined
    : opts.tenantId;
  const locationId = opts.locationId || undefined;

  const [clients, locations] = await Promise.all([
    opts.isAgencyStaff
      ? prisma.tenant.findMany({
          where: { type: "CLIENT", status: { not: "ARCHIVED" }, agencyId: opts.tenantId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : prisma.tenant.findMany({
          where: { id: opts.tenantId },
          select: { id: true, name: true },
        }),
    prisma.location.findMany({
      where: {
        status: { not: "ARCHIVED" },
        ...(opts.isAgencyStaff
          ? scopedTenantId
            ? { tenantId: scopedTenantId }
            : { tenant: { type: "CLIENT", agencyId: opts.tenantId } }
          : { tenantId: opts.tenantId }),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, tenantId: true },
    }),
  ]);

  if (locationId && !locations.some((l) => l.id === locationId)) {
    return {
      customers: [],
      stats: { total: 0, withPhone: 0 },
      filters: { clients, locations },
    };
  }

  const rows = await prisma.waContact.findMany({
    where: {
      AND: [{ phone: { not: null } }, { phone: { not: "" } }],
      ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
      ...(locationId ? { conversations: { some: { locationId } } } : {}),
      ...(q
        ? {
            OR: [
              { phone: { contains: q } },
              { lid: { contains: q } },
              { displayName: { contains: q } },
              { identifier: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      tenant: { select: { id: true, name: true } },
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        select: {
          lastMessageAt: true,
          locationId: true,
          location: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const customers: CustomerListItem[] = rows.map((c) => {
    const locMap = new Map<string, { id: string; name: string }>();
    for (const conv of c.conversations) {
      if (locationId && conv.locationId !== locationId) continue;
      locMap.set(conv.location.id, conv.location);
    }
    const last = c.conversations[0]?.lastMessageAt ?? c.updatedAt;
    return {
      id: c.id,
      phone: c.phone,
      lid: c.lid,
      displayName: c.displayName,
      confidence: c.identityConfidence,
      lastSeenAt: last ? last.toISOString() : null,
      conversationCount: locationId
        ? c.conversations.filter((x) => x.locationId === locationId).length
        : c.conversations.length,
      client: c.tenant ? { id: c.tenant.id, name: c.tenant.name } : null,
      locations: [...locMap.values()],
    };
  });

  return {
    customers,
    stats: {
      total: customers.length,
      withPhone: customers.filter((c) => Boolean(c.phone)).length,
    },
    filters: { clients, locations },
  };
}
