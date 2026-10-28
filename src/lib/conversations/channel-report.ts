import { prisma } from "@/lib/db";
import { classifyOrderRevenue } from "@/lib/conversations/revenue";

export type ChannelReport = {
  incomingConversations: number;
  attributedReferrals: number;
  paymentInitiated: number;
  paymentPending: number;
  simulatedPaymentsExcluded: number;
  unverifiedPaid: number;
  providerConfirmedPayments: number;
  verifiedPayments: number;
  verifiedRevenueIdr: number;
  byChannel: Array<{ provider: string; conversations: number }>;
  byPhone: Array<{ phoneNumberId: string; conversations: number; attributedReferrals: number }>;
  byLocation: Array<{ locationId: string; conversations: number }>;
};

function referralId(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { source_id?: unknown; ctwa_clid?: unknown };
    const sourceId = typeof parsed.source_id === "string" ? parsed.source_id.trim() : "";
    const ctwa = typeof parsed.ctwa_clid === "string" ? parsed.ctwa_clid.trim() : "";
    return sourceId || ctwa;
  } catch {
    return "";
  }
}

/** Counts stored facts. Simulated payments are excluded. Missing referral ids are not treated as ads. */
export async function workspaceChannelReport(tenantId: string): Promise<ChannelReport> {
  const [grouped, referrals, orders] = await Promise.all([
    prisma.waConversation.groupBy({
      by: ["provider", "businessPhoneNumberId", "locationId"],
      where: { tenantId },
      _count: { _all: true },
    }),
    prisma.waMessage.findMany({
      where: {
        referralJson: { not: "" },
        NOT: { source: { in: ["history", "business_app"] } },
        conversation: { tenantId },
      },
      select: {
        referralJson: true,
        conversation: { select: { businessPhoneNumberId: true } },
      },
    }),
    prisma.yolaOrder.findMany({
      where: { tenantId },
      select: {
        id: true,
        tenantId: true,
        origin: true,
        amountIdr: true,
        currency: true,
        payments: {
          select: {
            tenantId: true,
            orderId: true,
            provider: true,
            mode: true,
            status: true,
            amountIdr: true,
            currency: true,
          },
        },
        events: {
          select: {
            tenantId: true,
            orderId: true,
            eventId: true,
            provider: true,
            outcome: true,
            amountIdr: true,
            currency: true,
            live: true,
          },
        },
      },
    }),
  ]);
  const classes = orders.map((order) =>
    classifyOrderRevenue({ ...order, sessions: order.payments })
  );

  const byChannel = new Map<string, number>();
  const byPhone = new Map<string, { conversations: number; attributedReferrals: number }>();
  const byLocation = new Map<string, number>();
  let incomingConversations = 0;
  for (const row of grouped) {
    const count = row._count._all;
    incomingConversations += count;
    byChannel.set(row.provider, (byChannel.get(row.provider) || 0) + count);
    if (row.businessPhoneNumberId) {
      const current = byPhone.get(row.businessPhoneNumberId) || { conversations: 0, attributedReferrals: 0 };
      current.conversations += count;
      byPhone.set(row.businessPhoneNumberId, current);
    }
    if (row.locationId) byLocation.set(row.locationId, (byLocation.get(row.locationId) || 0) + count);
  }

  let attributedReferrals = 0;
  for (const row of referrals) {
    if (!referralId(row.referralJson)) continue;
    attributedReferrals += 1;
    const phone = row.conversation.businessPhoneNumberId;
    if (!phone) continue;
    const current = byPhone.get(phone) || { conversations: 0, attributedReferrals: 0 };
    current.attributedReferrals += 1;
    byPhone.set(phone, current);
  }

  return {
    incomingConversations,
    attributedReferrals,
    paymentInitiated: classes.reduce((sum, row) => sum + row.initiated, 0),
    paymentPending: classes.reduce((sum, row) => sum + row.pending, 0),
    simulatedPaymentsExcluded: classes.reduce((sum, row) => sum + row.simulated, 0),
    unverifiedPaid: classes.reduce((sum, row) => sum + row.unverifiedPaid, 0),
    providerConfirmedPayments: classes.filter((row) => row.providerConfirmed).length,
    verifiedPayments: classes.filter((row) => row.verifiedRevenueIdr > 0).length,
    verifiedRevenueIdr: classes.reduce((sum, row) => sum + row.verifiedRevenueIdr, 0),
    byChannel: [...byChannel.entries()].map(([provider, conversations]) => ({ provider, conversations })),
    byPhone: [...byPhone.entries()].map(([phoneNumberId, row]) => ({ phoneNumberId, ...row })),
    byLocation: [...byLocation.entries()].map(([locationId, conversations]) => ({ locationId, conversations })),
  };
}
