import { prisma } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { hoursFromRow, isSupportDeskOpen } from "./hours";
import {
  AGENT_NAME,
  PRESENCE_TTL_MS,
  canAgentOpenThread,
  canVisitorSend,
  presenceIsActive,
  shouldCloseForSilence,
  silenceDeadline,
  visitorMessageSeen,
  type SupportCloseReason,
} from "./rules";

const PREVIEW = 80;
const BODY_MAX = 4000;

function previewOf(body: string) {
  const t = body.replace(/\s+/g, " ").trim();
  return t.length <= PREVIEW ? t : `${t.slice(0, PREVIEW - 1)}…`;
}

export async function getDeskSettings() {
  return prisma.supportDeskSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}

export async function deskHoursOpen(now = new Date()) {
  const row = await getDeskSettings();
  return { row, hours: hoursFromRow(row), open: isSupportDeskOpen(hoursFromRow(row), now) };
}

export async function touchAgentPresence() {
  return prisma.supportDeskSettings.upsert({
    where: { id: "default" },
    create: { id: "default", agentSeenAt: new Date() },
    update: { agentSeenAt: new Date() },
  });
}

export function deskPresence(agentSeenAt: Date | null, hoursOpen: boolean, now = new Date()) {
  if (!hoursOpen) return "closed" as const;
  if (presenceIsActive(agentSeenAt, now)) return "active" as const;
  return "away" as const;
}

async function activeThreadId() {
  const row = await prisma.supportThread.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function queuePosition(thread: { id: string; status: string; queuedAt: Date }) {
  if (thread.status !== "QUEUED") return 0;
  const ahead = await prisma.supportThread.count({
    where: { status: "QUEUED", queuedAt: { lt: thread.queuedAt } },
  });
  return ahead + 1;
}

function publicMessages(
  openedAt: Date | null,
  rows: { id: string; from: string; body: string; sentAt: Date }[]
) {
  return rows.map((m) => ({
    id: m.id,
    from: m.from,
    body: m.body,
    sentAt: m.sentAt.toISOString(),
    agentName: m.from === "AGENT" ? AGENT_NAME : undefined,
    seen: m.from === "VISITOR" ? visitorMessageSeen(openedAt, m.sentAt) : true,
  }));
}

export async function findVisitorThread(opts: { userId?: string | null; cookieThreadId?: string | null }) {
  if (opts.userId) {
    const live = await prisma.supportThread.findFirst({
      where: { userId: opts.userId, status: { in: ["QUEUED", "ACTIVE"] } },
      orderBy: { queuedAt: "desc" },
    });
    if (live) return live;
  }
  if (opts.cookieThreadId) {
    return prisma.supportThread.findUnique({ where: { id: opts.cookieThreadId } });
  }
  return null;
}

export async function serializeVisitorThread(threadId: string) {
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    include: { messages: { orderBy: { sentAt: "asc" } } },
  });
  if (!thread) return null;
  const position = await queuePosition(thread);
  return {
    id: thread.id,
    status: thread.status,
    queuePosition: position,
    closeReason: thread.closeReason,
    messages: publicMessages(thread.openedAt, thread.messages),
  };
}

export async function widgetSnapshot(opts: {
  userId?: string | null;
  cookieThreadId?: string | null;
  session?: SessionPayload | null;
}) {
  const now = new Date();
  const { row, hours, open } = await deskHoursOpen(now);
  const presence = deskPresence(row.agentSeenAt, open, now);
  const thread = await findVisitorThread({
    userId: opts.userId,
    cookieThreadId: opts.cookieThreadId,
  });
  const live =
    thread && (thread.status === "QUEUED" || thread.status === "ACTIVE")
      ? await serializeVisitorThread(thread.id)
      : thread && thread.status === "CLOSED"
        ? await serializeVisitorThread(thread.id)
        : null;

  const me = opts.session
    ? {
        name: opts.session.name || opts.session.email.split("@")[0],
        email: opts.session.email,
        brand: opts.session.tenantName,
        role: ROLE_LABELS[opts.session.role as Role] || opts.session.role,
      }
    : null;

  return {
    agentName: AGENT_NAME,
    hoursOpen: open,
    presence,
    openHm: hours.openHm,
    closeHm: hours.closeHm,
    me,
    thread: live,
  };
}

export async function visitorSend(opts: {
  name: string;
  email: string;
  body: string;
  locale: string;
  path: string;
  session?: SessionPayload | null;
  cookieThreadId?: string | null;
}) {
  const body = opts.body.trim().slice(0, BODY_MAX);
  const name = opts.name.trim().slice(0, 80);
  const email = opts.email.trim().toLowerCase().slice(0, 120);
  if (!body) return { ok: false as const, error: "message_required" };
  if (!name) return { ok: false as const, error: "name_required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: "email_required" };

  const now = new Date();
  const { open } = await deskHoursOpen(now);
  let thread = await findVisitorThread({
    userId: opts.session?.userId,
    cookieThreadId: opts.cookieThreadId,
  });
  if (thread?.status === "CLOSED") thread = null;

  const gate = canVisitorSend({ hoursOpen: open, threadStatus: thread?.status ?? null });
  if (!gate.ok) return { ok: false as const, error: gate.reason };

  const path = (opts.path || "").trim().slice(0, 200);
  const locale = opts.locale === "id" ? "id" : "en";

  if (!thread) {
    thread = await prisma.supportThread.create({
      data: {
        status: "QUEUED",
        visitorKind: opts.session ? "USER" : "PROSPECT",
        userId: opts.session?.userId || null,
        tenantId: opts.session?.tenantId || null,
        name,
        email,
        locale,
        roleLabel: opts.session ? ROLE_LABELS[opts.session.role as Role] || opts.session.role : "",
        firstPath: path.startsWith("/") ? path : "",
        lastPath: path.startsWith("/") ? path : "",
        lastVisitorAt: now,
        lastPreview: previewOf(body),
      },
    });
  } else {
    await prisma.supportThread.update({
      where: { id: thread.id },
      data: {
        lastVisitorAt: now,
        lastPreview: previewOf(body),
        lastPath: path.startsWith("/") ? path : thread.lastPath,
        silenceDeadlineAt: null,
      },
    });
  }

  await prisma.supportMessage.create({
    data: { threadId: thread.id, from: "VISITOR", body, sentAt: now },
  });

  const serialized = await serializeVisitorThread(thread.id);
  return { ok: true as const, thread: serialized };
}

export async function agentOpen(threadId: string) {
  const now = new Date();
  const { open } = await deskHoursOpen(now);
  const target = await prisma.supportThread.findUnique({ where: { id: threadId } });
  if (!target || target.status === "CLOSED") return { ok: false as const, error: "not_found" };
  const activeId = await activeThreadId();
  if (!canAgentOpenThread({ activeId, targetId: threadId, hoursOpen: open })) {
    return { ok: false as const, error: "queue_blocked" };
  }
  if (target.status === "QUEUED") {
    await prisma.supportThread.update({
      where: { id: threadId },
      data: { status: "ACTIVE", openedAt: now },
    });
  } else {
    await prisma.supportThread.update({
      where: { id: threadId },
      data: { openedAt: now },
    });
  }
  return { ok: true as const, thread: await serializeVisitorThread(threadId) };
}

export async function agentReply(threadId: string, bodyRaw: string) {
  const body = bodyRaw.trim().slice(0, BODY_MAX);
  if (!body) return { ok: false as const, error: "message_required" };
  const thread = await prisma.supportThread.findUnique({ where: { id: threadId } });
  if (!thread || thread.status !== "ACTIVE") return { ok: false as const, error: "not_active" };
  const now = new Date();
  await prisma.supportMessage.create({
    data: { threadId, from: "AGENT", body, sentAt: now },
  });
  await prisma.supportThread.update({
    where: { id: threadId },
    data: {
      lastAgentAt: now,
      lastPreview: previewOf(body),
      openedAt: now,
      silenceDeadlineAt: silenceDeadline(now),
    },
  });
  return { ok: true as const, thread: await serializeVisitorThread(threadId) };
}

export async function closeThread(threadId: string, reason: SupportCloseReason) {
  const thread = await prisma.supportThread.findUnique({ where: { id: threadId } });
  if (!thread || thread.status === "CLOSED") return { ok: false as const, error: "not_found" };
  const now = new Date();
  await prisma.supportThread.update({
    where: { id: threadId },
    data: { status: "CLOSED", closedAt: now, closeReason: reason, silenceDeadlineAt: null },
  });
  return { ok: true as const };
}

export async function closeSilentThreads(now = new Date()) {
  const rows = await prisma.supportThread.findMany({ where: { status: "ACTIVE" } });
  let n = 0;
  for (const row of rows) {
    if (!shouldCloseForSilence(row, now)) continue;
    await closeThread(row.id, "VISITOR_SILENCE");
    n += 1;
  }
  return n;
}

export async function listDesk() {
  const [active, waiting, closed] = await Promise.all([
    prisma.supportThread.findFirst({
      where: { status: "ACTIVE" },
      include: { messages: { orderBy: { sentAt: "asc" } }, tenant: { select: { name: true } } },
    }),
    prisma.supportThread.findMany({
      where: { status: "QUEUED" },
      orderBy: { queuedAt: "asc" },
      take: 50,
      include: { tenant: { select: { name: true } } },
    }),
    prisma.supportThread.findMany({
      where: { status: "CLOSED" },
      orderBy: { closedAt: "desc" },
      take: 40,
      include: { tenant: { select: { name: true } } },
    }),
  ]);
  return {
    agentName: AGENT_NAME,
    presenceTtlMs: PRESENCE_TTL_MS,
    active: active
      ? {
          ...deskThreadCard(active),
          messages: publicMessages(active.openedAt, active.messages),
        }
      : null,
    waiting: waiting.map(deskThreadCard),
    closed: closed.map(deskThreadCard),
  };
}

function deskThreadCard(t: {
  id: string;
  status: string;
  name: string;
  email: string;
  visitorKind: string;
  roleLabel: string;
  lastPreview: string;
  queuedAt: Date;
  lastPath: string;
  firstPath: string;
  locale: string;
  tenant?: { name: string } | null;
  closeReason: string | null;
  lastVisitorAt: Date | null;
  lastAgentAt: Date | null;
}) {
  return {
    id: t.id,
    status: t.status,
    name: t.name,
    email: t.email,
    visitorKind: t.visitorKind,
    roleLabel: t.roleLabel,
    brand: t.tenant?.name || null,
    preview: t.lastPreview,
    queuedAt: t.queuedAt.toISOString(),
    path: t.lastPath || t.firstPath,
    locale: t.locale,
    closeReason: t.closeReason,
    lastVisitorAt: t.lastVisitorAt?.toISOString() || null,
    lastAgentAt: t.lastAgentAt?.toISOString() || null,
  };
}

export async function saveDeskHours(input: {
  enabled: boolean;
  openHm: string;
  closeHm: string;
  daysOfWeek: number[];
}) {
  const days = input.daysOfWeek.filter((n) => n >= 1 && n <= 7);
  return prisma.supportDeskSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      enabled: input.enabled,
      openHm: input.openHm,
      closeHm: input.closeHm,
      daysOfWeek: days.join(",") || "1,2,3,4,5,6,7",
    },
    update: {
      enabled: input.enabled,
      openHm: input.openHm,
      closeHm: input.closeHm,
      daysOfWeek: days.join(",") || "1,2,3,4,5,6,7",
    },
  });
}
