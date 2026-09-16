import { prisma } from "@/lib/db";
import { formatMonthLabel, monthBounds, monthPeriodKey, parseMonthKey, shiftMonthKey } from "./rules";
import { getOrCreateProgram, programView } from "./service";
import {
  summarizeLoyaltyMonth,
  type LoyaltyMonthProgram,
  type LoyaltyMonthStampRow,
  type LoyaltyMonthSummary,
} from "./report-summary";

export type { LoyaltyMonthProgram, LoyaltyMonthSummary } from "./report-summary";
export { summarizeLoyaltyMonth, shortMemberLabel } from "./report-summary";

export type LoyaltyMonthReport = {
  brandName: string;
  timezone: string;
  periodKey: string;
  periodLabelEn: string;
  periodLabelId: string;
  prevMonth: string;
  nextMonth: string | null;
  program: LoyaltyMonthProgram;
  summary: LoyaltyMonthSummary;
};

export async function loadLoyaltyMonthReport(tenantId: string, monthRaw?: string | null): Promise<LoyaltyMonthReport> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, timezone: true },
  });
  const timezone = tenant?.timezone || "Asia/Jakarta";
  const currentKey = monthPeriodKey(new Date(), timezone);
  const wanted = parseMonthKey(monthRaw, currentKey);
  const periodKey = wanted > currentKey ? currentKey : wanted;
  const { start, endExclusive } = monthBounds(periodKey, timezone);
  const view = programView(await getOrCreateProgram(tenantId));
  const program: LoyaltyMonthProgram = {
    stampEnabled: view.stampEnabled,
    spenderEnabled: view.spenderEnabled,
    birthdayEnabled: view.birthdayEnabled,
    stampGoal: view.stampGoal,
    stampTiers: view.stampTiers,
    spenderTiers: view.spenderTiers,
    spenderMinAmount: view.spenderMinAmount,
    spenderTopN: view.spenderTopN,
    spenderScope: view.spenderScope,
    spenderLocationId: view.spenderLocationId,
  };

  const [stampRows, redemptionRows, joinedThisMonth] = await Promise.all([
    prisma.loyaltyStamp.findMany({
      where: { tenantId, stampedAt: { gte: start, lt: endExclusive } },
      select: {
        memberPhone: true,
        locationId: true,
        amount: true,
        stampedAt: true,
        location: { select: { name: true } },
      },
    }),
    prisma.loyaltyRedemption.findMany({
      where: { tenantId, redeemedAt: { gte: start, lt: endExclusive } },
      select: {
        memberPhone: true,
        kind: true,
        voucherCode: true,
        periodKey: true,
        redeemedAt: true,
        location: { select: { name: true } },
      },
    }),
    prisma.loyaltyMember.count({
      where: { tenantId, createdAt: { gte: start, lt: endExclusive } },
    }),
  ]);

  const stampsThisMonth: LoyaltyMonthStampRow[] = stampRows.map((s) => ({
    memberPhone: s.memberPhone,
    locationId: s.locationId,
    locationName: s.location.name,
    amount: s.amount,
    stampedAt: s.stampedAt,
  }));

  const phones = [...new Set(stampsThisMonth.map((s) => s.memberPhone))];
  const priorRows =
    phones.length === 0
      ? []
      : await prisma.loyaltyStamp.findMany({
          where: { tenantId, memberPhone: { in: phones }, stampedAt: { lt: start } },
          distinct: ["memberPhone"],
          select: { memberPhone: true },
        });

  const namePhones = [...new Set([...phones, ...redemptionRows.map((r) => r.memberPhone)])];
  const names =
    namePhones.length === 0
      ? []
      : await prisma.loyaltyMember.findMany({
          where: { tenantId, phone: { in: namePhones } },
          select: { phone: true, name: true },
        });

  const birthdaySends =
    redemptionRows.some((r) => r.kind === "BIRTHDAY")
      ? await prisma.loyaltyBirthdayWaSend.findMany({
          where: {
            tenantId,
            memberPhone: { in: redemptionRows.filter((r) => r.kind === "BIRTHDAY").map((r) => r.memberPhone) },
          },
          select: { memberPhone: true, periodKey: true, voucherValue: true },
        })
      : [];
  const valueByKey = new Map(birthdaySends.map((s) => [`${s.memberPhone}:${s.periodKey}`, s.voucherValue]));

  const summarized = summarizeLoyaltyMonth({
    stampsThisMonth,
    priorStampPhones: priorRows.map((r) => r.memberPhone),
    redemptionsThisMonth: redemptionRows.map((r) => ({
      memberPhone: r.memberPhone,
      kind: r.kind,
      voucherCode: r.voucherCode,
      voucherValue: valueByKey.get(`${r.memberPhone}:${r.periodKey || ""}`) || "",
      locationName: r.location?.name || null,
      redeemedAt: r.redeemedAt,
    })),
    joinedThisMonth,
    names,
    program,
  });

  const next = shiftMonthKey(periodKey, 1);
  return {
    brandName: tenant?.name || "",
    timezone,
    periodKey,
    periodLabelEn: formatMonthLabel(periodKey, "en"),
    periodLabelId: formatMonthLabel(periodKey, "id"),
    prevMonth: shiftMonthKey(periodKey, -1),
    nextMonth: next <= currentKey ? next : null,
    program,
    summary: { periodKey, ...summarized },
  };
}
