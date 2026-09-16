import { prisma } from "@/lib/db";
import { canonPhone } from "@/lib/conversations/identity";
import { isSecretCodeMessage } from "@/lib/conversations/secret-code";
import { listMembers } from "@/lib/loyalty/members";

export type CustomerBookStatus = "potential" | "prospect" | "member";

export type CustomerBookRow = {
  key: string;
  phone: string;
  name: string;
  email: string;
  birthDate: string | null;
  city: string;
  province: string;
  status: CustomerBookStatus;
  birthdayWaOptIn: boolean;
  signupLocation: { id: string; name: string } | null;
  activatedLocation: { id: string; name: string } | null;
  stampCount: number;
  source: string;
  chatted: boolean;
  chatWhere: "HQ" | "BRANCH" | "BOTH" | null;
  lastChatAt: string | null;
  memberId: string | null;
  createdAt: string;
};

export type CustomerChatThread = {
  conversationId: string;
  locationId: string;
  locationName: string;
  kind: string;
  lastMessageAt: string | null;
};

function lifeToStatus(life: string): CustomerBookStatus {
  return life === "aktif" ? "member" : "prospect";
}

function chatWhereFromKinds(kinds: Set<string>): "HQ" | "BRANCH" | "BOTH" | null {
  const hq = kinds.has("HQ");
  const branch = [...kinds].some((k) => k !== "HQ");
  if (hq && branch) return "BOTH";
  if (hq) return "HQ";
  if (branch) return "BRANCH";
  return null;
}

function sourceFromChat(where: "HQ" | "BRANCH" | "BOTH" | null): string {
  return where === "HQ" || where === "BOTH" ? "CHAT_HQ" : "CHAT_BRANCH";
}

async function loadChats(tenantId: string, phones?: string[]) {
  const wanted = phones?.map((p) => canonPhone(p)).filter((p) => p.length >= 8);
  const contacts = await prisma.waContact.findMany({
    where: {
      tenantId,
      AND: [{ phone: { not: null } }, { phone: { not: "" } }],
    },
    select: {
      phone: true,
      displayName: true,
      updatedAt: true,
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        select: {
          id: true,
          lastMessageAt: true,
          lastPreview: true,
          location: { select: { id: true, name: true, kind: true } },
        },
      },
    },
    take: 800,
  });
  return contacts
    .map((c) => {
    const phone = canonPhone(c.phone || "");
    const kinds = new Set(c.conversations.map((x) => x.location.kind));
    const where = chatWhereFromKinds(kinds);
    const last = c.conversations[0]?.lastMessageAt || c.updatedAt;
    const codeOnly =
      c.conversations.length > 0 &&
      c.conversations.every((x) => isSecretCodeMessage(x.lastPreview || ""));
    return {
      phone,
      displayName: (c.displayName || "").trim(),
      chatWhere: where,
      lastChatAt: last ? last.toISOString() : null,
      codeOnly,
      threads: c.conversations.map((x) => ({
        conversationId: x.id,
        locationId: x.location.id,
        locationName: x.location.name,
        kind: x.location.kind,
        lastMessageAt: x.lastMessageAt ? x.lastMessageAt.toISOString() : null,
      })),
    };
    })
    .filter(
      (c) =>
        c.phone.length >= 8 &&
        !c.codeOnly &&
        c.threads.length > 0 &&
        (!wanted?.length || wanted.includes(c.phone))
    );
}

export async function listCustomerBook(opts: {
  tenantId: string;
  q?: string;
  status?: string;
}): Promise<{
  people: CustomerBookRow[];
  stats: { total: number; potential: number; prospect: number; member: number };
}> {
  const members = await listMembers({ tenantId: opts.tenantId, q: opts.q });
  const chats = await loadChats(opts.tenantId);
  const byPhone = new Map<string, CustomerBookRow>();

  for (const m of members.members) {
    const phone = canonPhone(m.phone);
    byPhone.set(phone, {
      key: phone,
      phone,
      name: m.name || "",
      email: m.email || "",
      birthDate: m.birthDate,
      city: m.city || "",
      province: m.province || "",
      status: lifeToStatus(m.status),
      birthdayWaOptIn: m.birthdayWaOptIn,
      signupLocation: m.signupLocation,
      activatedLocation: m.activatedLocation,
      stampCount: m.stampCount,
      source: m.source,
      chatted: false,
      chatWhere: null,
      lastChatAt: null,
      memberId: m.id,
      createdAt: m.createdAt,
    });
  }

  const q = (opts.q || "").trim().toLowerCase();
  for (const c of chats) {
    const existing = byPhone.get(c.phone);
    if (existing) {
      existing.chatted = true;
      existing.chatWhere = c.chatWhere;
      existing.lastChatAt = c.lastChatAt;
      if (!existing.name && c.displayName) existing.name = c.displayName;
      continue;
    }
    if (
      q &&
      !c.phone.includes(q.replace(/\D/g, "")) &&
      !c.displayName.toLowerCase().includes(q)
    ) {
      continue;
    }
    byPhone.set(c.phone, {
      key: c.phone,
      phone: c.phone,
      name: c.displayName,
      email: "",
      birthDate: null,
      city: "",
      province: "",
      status: "potential",
      birthdayWaOptIn: false,
      signupLocation: null,
      activatedLocation: null,
      stampCount: 0,
      source: sourceFromChat(c.chatWhere),
      chatted: true,
      chatWhere: c.chatWhere,
      lastChatAt: c.lastChatAt,
      memberId: null,
      createdAt: c.lastChatAt || new Date().toISOString(),
    });
  }

  const all = [...byPhone.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const stats = {
    total: all.length,
    potential: all.filter((p) => p.status === "potential").length,
    prospect: all.filter((p) => p.status === "prospect").length,
    member: all.filter((p) => p.status === "member").length,
  };
  const wanted = opts.status || "";
  const people = wanted ? all.filter((p) => p.status === wanted) : all;
  return { people, stats };
}

export async function getCustomerBookDetail(tenantId: string, rawPhone: string) {
  const phone = canonPhone(rawPhone);
  if (phone.length < 8) return null;
  const { people } = await listCustomerBook({ tenantId, q: phone });
  const row = people.find((p) => p.phone === phone) || null;
  if (!row) return null;
  const chats = await loadChats(tenantId, [phone, rawPhone]);
  const threads: CustomerChatThread[] = chats.flatMap((c) => c.threads);
  return { ...row, threads };
}
