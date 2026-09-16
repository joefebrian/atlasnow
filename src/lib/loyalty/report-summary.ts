import { stampMeetsMin, type SpenderTier, type StampTier } from "./rules";

export type LoyaltyMonthStampRow = {
  memberPhone: string;
  locationId: string;
  locationName: string;
  amount: number | null;
  stampedAt: Date;
};

export type LoyaltyMonthRedemptionRow = {
  memberPhone: string;
  kind: string;
  voucherCode?: string;
  voucherValue?: string;
  locationName?: string | null;
  redeemedAt?: Date;
};

export type LoyaltyMonthName = { phone: string; name: string };

export type LoyaltyMonthProgram = {
  stampEnabled: boolean;
  spenderEnabled: boolean;
  birthdayEnabled: boolean;
  stampGoal: number;
  stampTiers: StampTier[];
  spenderTiers: SpenderTier[];
  spenderMinAmount: number;
  spenderTopN: number;
  spenderScope: string;
  spenderLocationId: string | null;
};

export type LoyaltyMonthHero = {
  membersReturned: number;
  uniqueShoppers: number;
  volume: number;
  volumeKind: "stamps" | "receipts";
  rewardsRedeemed: number;
  redemptionByKind: { stamp: number; spender: number; birthday: number };
  topRegular: { label: string; stamps: number; phone: string } | null;
  topSpender: { label: string; spend: number; phone: string } | null;
  joinedThisMonth: number;
  activatedThisMonth: number;
};

export type LoyaltyMonthOutlet = { locationId: string; name: string; stamps: number; shoppers: number };

export type LoyaltyMonthSpender = { rank: number; label: string; phone: string; spend: number; reward: string };

export type LoyaltyMonthStampRank = { rank: number; label: string; phone: string; stamps: number };

export type LoyaltyMonthBirthdayRow = {
  label: string;
  phone: string;
  voucherCode: string;
  voucherValue: string;
  locationName: string;
  redeemedAt: Date;
};

export type LoyaltyMonthSummary = {
  periodKey: string;
  hero: LoyaltyMonthHero;
  outlets: LoyaltyMonthOutlet[];
  stampBoard: LoyaltyMonthStampRank[];
  spenderBoard: LoyaltyMonthSpender[];
  birthdayBoard: LoyaltyMonthBirthdayRow[];
};

export function shortMemberLabel(name: string | null | undefined, phone: string): string {
  const tail = (phone || "").replace(/\D/g, "").slice(-4);
  const n = (name || "").trim();
  const masked = tail ? `•••${tail}` : "member";
  return n ? `${n} · ${masked}` : masked;
}

export function summarizeLoyaltyMonth(opts: {
  stampsThisMonth: LoyaltyMonthStampRow[];
  priorStampPhones: string[];
  redemptionsThisMonth: LoyaltyMonthRedemptionRow[];
  joinedThisMonth: number;
  names: LoyaltyMonthName[];
  program: LoyaltyMonthProgram;
}): Omit<LoyaltyMonthSummary, "periodKey"> {
  const names = new Map(opts.names.map((n) => [n.phone, n.name]));
  const prior = new Set(opts.priorStampPhones);
  const byPhone = new Map<string, number>();
  const byOutlet = new Map<string, { name: string; stamps: number; shoppers: Set<string> }>();
  const spendByPhone = new Map<string, number>();

  for (const row of opts.stampsThisMonth) {
    byPhone.set(row.memberPhone, (byPhone.get(row.memberPhone) || 0) + 1);
    const loc = byOutlet.get(row.locationId) || { name: row.locationName, stamps: 0, shoppers: new Set<string>() };
    loc.stamps += 1;
    loc.shoppers.add(row.memberPhone);
    byOutlet.set(row.locationId, loc);
    if (row.amount != null && stampMeetsMin(row.amount, opts.program.spenderMinAmount)) {
      if (
        opts.program.spenderScope === "LOCATION" &&
        opts.program.spenderLocationId &&
        row.locationId !== opts.program.spenderLocationId
      ) {
        continue;
      }
      spendByPhone.set(row.memberPhone, (spendByPhone.get(row.memberPhone) || 0) + row.amount);
    }
  }

  let membersReturned = 0;
  let activatedThisMonth = 0;
  for (const phone of byPhone.keys()) {
    if (prior.has(phone)) membersReturned += 1;
    else activatedThisMonth += 1;
  }

  let topRegular: LoyaltyMonthHero["topRegular"] = null;
  for (const [phone, stamps] of byPhone) {
    if (!topRegular || stamps > topRegular.stamps) {
      topRegular = { phone, stamps, label: shortMemberLabel(names.get(phone), phone) };
    }
  }

  const spendRanked = [...spendByPhone.entries()].sort((a, b) => b[1] - a[1]);
  const topSpender = spendRanked[0]
    ? {
        phone: spendRanked[0][0],
        spend: spendRanked[0][1],
        label: shortMemberLabel(names.get(spendRanked[0][0]), spendRanked[0][0]),
      }
    : null;

  const redemptionByKind = { stamp: 0, spender: 0, birthday: 0 };
  for (const r of opts.redemptionsThisMonth) {
    if (r.kind === "STAMP_CARD") redemptionByKind.stamp += 1;
    else if (r.kind === "TOP_SPENDER") redemptionByKind.spender += 1;
    else if (r.kind === "BIRTHDAY") redemptionByKind.birthday += 1;
  }

  const rewardByRank = new Map(opts.program.spenderTiers.map((t) => [t.rank, t.reward]));
  const boardLimit = Math.max(opts.program.spenderTopN, 20);
  const spenderBoard: LoyaltyMonthSpender[] = spendRanked.slice(0, boardLimit).map((row, i) => {
    const rank = i + 1;
    return {
      rank,
      phone: row[0],
      spend: row[1],
      label: shortMemberLabel(names.get(row[0]), row[0]),
      reward: rewardByRank.get(rank) || "",
    };
  });

  const stampRanked = [...byPhone.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const stampBoard: LoyaltyMonthStampRank[] = stampRanked.slice(0, 20).map((row, i) => ({
    rank: i + 1,
    phone: row[0],
    stamps: row[1],
    label: shortMemberLabel(names.get(row[0]), row[0]),
  }));

  return {
    hero: {
      membersReturned,
      uniqueShoppers: byPhone.size,
      volume: opts.stampsThisMonth.length,
      volumeKind: opts.program.stampEnabled ? "stamps" : "receipts",
      rewardsRedeemed: opts.redemptionsThisMonth.length,
      redemptionByKind,
      topRegular,
      topSpender,
      joinedThisMonth: opts.joinedThisMonth,
      activatedThisMonth,
    },
    outlets: [...byOutlet.entries()]
      .map(([locationId, v]) => ({
        locationId,
        name: v.name,
        stamps: v.stamps,
        shoppers: v.shoppers.size,
      }))
      .sort((a, b) => b.stamps - a.stamps),
    stampBoard,
    spenderBoard,
    birthdayBoard: opts.redemptionsThisMonth
      .filter((r) => r.kind === "BIRTHDAY")
      .map((r) => ({
        phone: r.memberPhone,
        label: shortMemberLabel(names.get(r.memberPhone), r.memberPhone),
        voucherCode: r.voucherCode || "",
        voucherValue: r.voucherValue || "",
        locationName: r.locationName || "—",
        redeemedAt: r.redeemedAt || new Date(0),
      }))
      .sort((a, b) => b.redeemedAt.getTime() - a.redeemedAt.getTime()),
  };
}
