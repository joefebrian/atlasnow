export type ConversationClient = { id: string; name: string; slug: string };

export type ConversationClientSummary = {
  id: string;
  name: string;
  slug: string;
  branchCount: number;
  conversationCount: number;
  unrepliedCount: number;
};

function isUnreplied(row: {
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
}): boolean {
  return (
    row.lastInboundAt != null &&
    (row.lastOutboundAt == null || row.lastInboundAt > row.lastOutboundAt)
  );
}

export function summarizeClientsForConversations(
  clients: ConversationClient[],
  locations: { tenantId: string }[],
  conversations: {
    tenantId: string;
    lastInboundAt: Date | null;
    lastOutboundAt: Date | null;
  }[]
): ConversationClientSummary[] {
  return clients
    .map((c) => {
      const convs = conversations.filter((x) => x.tenantId === c.id);
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        branchCount: locations.filter((l) => l.tenantId === c.id).length,
        conversationCount: convs.length,
        unrepliedCount: convs.filter(isUnreplied).length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type CustomerClientSummary = {
  id: string;
  name: string;
  slug: string;
  branchCount: number;
  customerCount: number;
  withPhone: number;
};

export type ReviewClientSummary = {
  id: string;
  name: string;
  slug: string;
  branchCount: number;
  reviewCount: number;
  unrepliedCount: number;
};

export function summarizeClientsForReviews(
  clients: ConversationClient[],
  locations: { tenantId: string }[],
  reviews: { tenantId: string; replied: boolean }[]
): ReviewClientSummary[] {
  return clients
    .map((c) => {
      const rows = reviews.filter((r) => r.tenantId === c.id);
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        branchCount: locations.filter((l) => l.tenantId === c.id).length,
        reviewCount: rows.length,
        unrepliedCount: rows.filter((r) => !r.replied).length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function summarizeClientsForCustomers(
  clients: ConversationClient[],
  locations: { tenantId: string }[],
  contacts: { tenantId: string; phone: string | null }[]
): CustomerClientSummary[] {
  return clients
    .map((c) => {
      const phones = new Set(
        contacts
          .filter((x) => x.tenantId === c.id && x.phone?.trim())
          .map((x) => (x.phone || "").replace(/\D/g, ""))
          .filter((p) => p.length >= 8)
      );
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        branchCount: locations.filter((l) => l.tenantId === c.id).length,
        customerCount: phones.size,
        withPhone: phones.size,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
