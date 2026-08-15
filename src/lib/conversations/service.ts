import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ConversationListItem = {
  id: string;
  lastMessageAt: string;
  contact: {
    displayName: string | null;
    phone: string | null;
    lid: string | null;
    confidence: string;
  };
  preview: string;
  location: { id: string; name: string };
  direction: "IN" | "OUT" | "UNREPLIED";
  sessionId: string;
};

type ListOpts = {
  q?: string;
  filter?: "all" | "unreplied";
  locationId?: string;
};

type ConversationRow = {
  id: string;
  tenantId: string;
  sessionId: string;
  lastMessageAt: Date;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  lastPreview: string;
  contact: {
    displayName: string | null;
    phone: string | null;
    lid: string | null;
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
      confidence: row.contact.identityConfidence,
    },
    preview: row.lastPreview,
    location: { id: row.location.id, name: row.location.name },
    direction: directionOf(row),
    sessionId: row.sessionId,
  };
}

const includeList = {
  contact: true,
  location: { select: { id: true, name: true } },
} as const;

function listWhere(opts: ListOpts): Prisma.WaConversationWhereInput {
  const q = opts.q?.trim() || undefined;
  const locationId = opts.locationId || undefined;
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
    ...(locationId ? { locationId } : {}),
    ...(clauses.length ? { AND: clauses } : {}),
  };
}

export async function listConversations(opts: ListOpts = {}): Promise<{
  conversations: ConversationListItem[];
  stats: { total: number; unreplied: number; open: number; mappings: number };
}> {
  const locationId = opts.locationId || undefined;
  const q = opts.q?.trim() || undefined;
  const baseWhere = listWhere({ q, locationId, filter: "all" });
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
      where: { status: "OPEN", ...(locationId ? { locationId } : {}) },
    }),
    prisma.waConversation.findMany({
      where: { ...baseWhere, lastInboundAt: { not: null } },
      select: { lastInboundAt: true, lastOutboundAt: true },
    }),
    prisma.sourceMapping.count({
      where: { sourceType: "WAHA", status: "ACTIVE" },
    }),
  ]);

  const conversations = (
    opts.filter === "unreplied" ? rows.filter(isUnreplied) : rows
  ).map(toListItem);

  return {
    conversations,
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

  return {
    conversation: { ...toListItem(row), tenantId: row.tenantId },
    messages: row.messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      sentAt: m.sentAt.toISOString(),
      fromMe: m.fromMe,
    })),
  };
}
