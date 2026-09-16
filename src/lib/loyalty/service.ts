import { prisma } from "@/lib/db";
import { canonPhone } from "@/lib/conversations/identity";
import { getCloudHqConfig } from "@/lib/conversations/cloud-hq";
import { sendCloudHqText } from "@/lib/conversations/cloud-send";
import {
  currentCardStamps,
  formatStampMenuReply,
  formatStampStatusReply,
  lastCardResetAt,
  monthBounds,
  monthPeriodKey,
  normalizeSpenderTiers,
  normalizeStampTiers,
  parseWaReplies,
  spenderRewardForRank,
  spenderTopN,
  staffPhoneBlocked,
  stampCardGoal,
  stampMeetsMin,
  stampTierStates,
  type StampExpiry,
  type SpenderTier,
  type StampTier,
  type WaReplyCopy,
} from "./rules";
import { memberAppUrlFor } from "./card-public";
import { joinUrl, memberState } from "./members";
import { matchReceiptPhoto, parseOcrJson, SYSTEM_OCR_ACTOR } from "./receipt-ocr";
import { ocrReceiptImage } from "./receipt-ocr-run";
import { compressReceiptPhoto } from "./receipt-photo";
import { receiptWaReplyAllowed } from "./receipt-wa-window";
import { assertEarnExclusive } from "./earn-exclusive";
import { normalizeBirthdayVoucherStyle, voucherCodesMatch } from "./birthday-h2";

export function programView(program: {
  stampEnabled: boolean;
  stampGoal: number;
  stampMinAmount: number;
  stampRewardText: string;
  stampTiersJson: string;
  stampExpiry: string;
  pointEnabled?: boolean;
  pointUnitRupiah?: number;
  pointPerUnit?: number;
  spenderEnabled: boolean;
  spenderScope: string;
  spenderLocationId: string | null;
  spenderMinAmount: number;
  spenderTopN: number;
  spenderRewardText: string;
  spenderTiersJson: string;
  joinKey: string;
  qrScope: string;
  birthdayEnabled: boolean;
  birthdayRewardText: string;
  birthdayVoucherPrefix?: string;
  birthdayVoucherYear?: boolean;
  birthdayVoucherSuffixLen?: number;
  waRepliesJson?: string;
  receiptAuditMode?: boolean;
  guestReceiptUpload?: boolean;
}) {
  const stampTiers = normalizeStampTiers(program.stampTiersJson, {
    goal: program.stampGoal,
    reward: program.stampRewardText,
  });
  const spenderTiers = normalizeSpenderTiers(program.spenderTiersJson, {
    topN: program.spenderTopN,
    reward: program.spenderRewardText,
  });
  const blob = (program as { stampCardImage?: Uint8Array | Buffer | null }).stampCardImage;
  const view = {
    ...program,
    stampTiers,
    spenderTiers,
    stampGoal: stampCardGoal(stampTiers) || program.stampGoal,
    stampRewardText: stampTiers[stampTiers.length - 1]?.reward ?? program.stampRewardText,
    spenderTopN: spenderTopN(spenderTiers) || program.spenderTopN,
    spenderRewardText: spenderTiers[0]?.reward ?? program.spenderRewardText,
    joinUrl: joinUrl(program.joinKey),
    qrScope: program.qrScope === "LOCATION" ? "LOCATION" : "BRAND",
    birthdayEnabled: program.birthdayEnabled,
    birthdayRewardText: program.birthdayRewardText,
    birthdayVoucherPrefix: program.birthdayVoucherPrefix || "BDY",
    birthdayVoucherYear: program.birthdayVoucherYear !== false,
    birthdayVoucherSuffixLen: program.birthdayVoucherSuffixLen || 4,
    waReplies: parseWaReplies(program.waRepliesJson),
    hasStampCardImage: Boolean(blob && blob.length),
  };
  delete (view as { stampCardImage?: unknown }).stampCardImage;
  delete (view as { stampCardMime?: unknown }).stampCardMime;
  return view;
}

export async function getOrCreateProgram(tenantId: string) {
  return prisma.loyaltyProgram.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
}

export async function saveProgram(
  tenantId: string,
  data: {
    stampEnabled?: boolean;
    stampGoal?: number;
    stampMinAmount?: number;
    stampRewardText?: string;
    stampTiers?: unknown;
    stampExpiry?: StampExpiry;
    pointEnabled?: boolean;
    pointUnitRupiah?: number;
    pointPerUnit?: number;
    spenderEnabled?: boolean;
    spenderScope?: string;
    spenderLocationId?: string | null;
    spenderMinAmount?: number;
    spenderTopN?: number;
    spenderRewardText?: string;
    spenderTiers?: unknown;
    qrScope?: string;
    birthdayEnabled?: boolean;
    birthdayRewardText?: string;
    birthdayVoucherPrefix?: string;
    birthdayVoucherYear?: boolean;
    birthdayVoucherSuffixLen?: number;
    waReplies?: unknown;
    receiptAuditMode?: boolean;
    guestReceiptUpload?: boolean;
  }
) {
  const stampTiers: StampTier[] | undefined =
    data.stampTiers !== undefined
      ? normalizeStampTiers(data.stampTiers, { goal: data.stampGoal ?? 10, reward: data.stampRewardText ?? "" })
      : data.stampGoal != null || data.stampRewardText != null
        ? normalizeStampTiers([], { goal: data.stampGoal ?? 10, reward: data.stampRewardText ?? "" })
        : undefined;
  const spenderTiers: SpenderTier[] | undefined =
    data.spenderTiers !== undefined
      ? normalizeSpenderTiers(data.spenderTiers, { topN: data.spenderTopN ?? 1, reward: data.spenderRewardText ?? "" })
      : data.spenderTopN != null || data.spenderRewardText != null
        ? normalizeSpenderTiers([], { topN: data.spenderTopN ?? 1, reward: data.spenderRewardText ?? "" })
        : undefined;
  const goal = stampTiers ? stampCardGoal(stampTiers) || 10 : data.stampGoal != null ? Math.max(1, Math.floor(data.stampGoal)) : undefined;
  const topN = spenderTiers ? spenderTopN(spenderTiers) || 1 : data.spenderTopN != null ? Math.max(1, Math.floor(data.spenderTopN)) : undefined;
  const stampRewardText = stampTiers ? stampTiers[stampTiers.length - 1]?.reward ?? "" : data.stampRewardText;
  const spenderRewardText = spenderTiers ? spenderTiers[0]?.reward ?? "" : data.spenderRewardText;
  const qrScope = data.qrScope === "LOCATION" ? "LOCATION" : data.qrScope === "BRAND" ? "BRAND" : undefined;
  const voucherStyle =
    data.birthdayVoucherPrefix != null ||
    data.birthdayVoucherYear != null ||
    data.birthdayVoucherSuffixLen != null
      ? normalizeBirthdayVoucherStyle({
          prefix: data.birthdayVoucherPrefix,
          includeYear: data.birthdayVoucherYear,
          suffixLen: data.birthdayVoucherSuffixLen,
        })
      : undefined;
  const waRepliesJson =
    data.waReplies !== undefined ? JSON.stringify(parseWaReplies(data.waReplies)) : undefined;
  const existing = await prisma.loyaltyProgram.findUnique({ where: { tenantId } });
  assertEarnExclusive({
    stampEnabled: data.stampEnabled ?? existing?.stampEnabled ?? false,
    pointEnabled: data.pointEnabled ?? existing?.pointEnabled ?? false,
    spenderEnabled: data.spenderEnabled ?? existing?.spenderEnabled ?? false,
  });
  const pointUnitRupiah =
    data.pointUnitRupiah != null ? Math.max(1, Math.floor(data.pointUnitRupiah)) : undefined;
  const pointPerUnit =
    data.pointPerUnit != null ? Math.max(1, Math.floor(data.pointPerUnit)) : undefined;
  return prisma.loyaltyProgram.upsert({
    where: { tenantId },
    create: {
      tenantId,
      stampEnabled: data.stampEnabled ?? false,
      stampGoal: goal ?? 10,
      stampMinAmount: data.stampMinAmount ?? 0,
      stampRewardText: stampRewardText ?? "",
      stampTiersJson: JSON.stringify(stampTiers ?? [{ stamps: goal ?? 10, reward: stampRewardText ?? "" }]),
      stampExpiry: data.stampExpiry ?? "lifetime",
      pointEnabled: data.pointEnabled ?? false,
      pointUnitRupiah: pointUnitRupiah ?? 100000,
      pointPerUnit: pointPerUnit ?? 1000,
      spenderEnabled: data.spenderEnabled ?? false,
      spenderScope: data.spenderScope === "LOCATION" ? "LOCATION" : "BRAND",
      spenderLocationId: data.spenderLocationId ?? null,
      spenderMinAmount: data.spenderMinAmount ?? 0,
      spenderTopN: topN ?? 1,
      spenderRewardText: spenderRewardText ?? "",
      spenderTiersJson: JSON.stringify(
        spenderTiers ?? [{ rank: 1, reward: spenderRewardText ?? "" }]
      ),
      qrScope: qrScope ?? "BRAND",
      birthdayEnabled: data.birthdayEnabled ?? false,
      birthdayRewardText: data.birthdayRewardText ?? "",
      birthdayVoucherPrefix: voucherStyle?.prefix ?? "BDY",
      birthdayVoucherYear: voucherStyle?.includeYear ?? true,
      birthdayVoucherSuffixLen: voucherStyle?.suffixLen ?? 4,
      waRepliesJson: waRepliesJson ?? "{}",
      receiptAuditMode: data.receiptAuditMode ?? false,
      guestReceiptUpload: data.guestReceiptUpload ?? false,
    },
    update: {
      ...(data.stampEnabled != null ? { stampEnabled: data.stampEnabled } : {}),
      ...(goal != null ? { stampGoal: goal } : {}),
      ...(data.stampMinAmount != null ? { stampMinAmount: Math.max(0, data.stampMinAmount) } : {}),
      ...(stampRewardText != null ? { stampRewardText } : {}),
      ...(stampTiers ? { stampTiersJson: JSON.stringify(stampTiers) } : {}),
      ...(data.stampExpiry ? { stampExpiry: data.stampExpiry } : {}),
      ...(data.pointEnabled != null ? { pointEnabled: data.pointEnabled } : {}),
      ...(pointUnitRupiah != null ? { pointUnitRupiah } : {}),
      ...(pointPerUnit != null ? { pointPerUnit } : {}),
      ...(data.spenderEnabled != null ? { spenderEnabled: data.spenderEnabled } : {}),
      ...(data.spenderScope ? { spenderScope: data.spenderScope === "LOCATION" ? "LOCATION" : "BRAND" } : {}),
      ...(data.spenderLocationId !== undefined ? { spenderLocationId: data.spenderLocationId } : {}),
      ...(data.spenderMinAmount != null ? { spenderMinAmount: Math.max(0, data.spenderMinAmount) } : {}),
      ...(topN != null ? { spenderTopN: topN } : {}),
      ...(spenderRewardText != null ? { spenderRewardText } : {}),
      ...(spenderTiers ? { spenderTiersJson: JSON.stringify(spenderTiers) } : {}),
      ...(qrScope ? { qrScope } : {}),
      ...(data.birthdayEnabled != null ? { birthdayEnabled: data.birthdayEnabled } : {}),
      ...(data.birthdayRewardText != null ? { birthdayRewardText: data.birthdayRewardText } : {}),
      ...(voucherStyle
        ? {
            birthdayVoucherPrefix: voucherStyle.prefix,
            birthdayVoucherYear: voucherStyle.includeYear,
            birthdayVoucherSuffixLen: voucherStyle.suffixLen,
          }
        : {}),
      ...(waRepliesJson != null ? { waRepliesJson } : {}),
      ...(data.receiptAuditMode != null ? { receiptAuditMode: data.receiptAuditMode } : {}),
      ...(data.guestReceiptUpload != null ? { guestReceiptUpload: data.guestReceiptUpload } : {}),
    },
  });
}

export async function submitIntake(opts: {
  tenantId: string;
  locationId: string;
  phone: string;
  trxId: string;
  amount?: number | null;
  invoiceRef?: string | null;
  source?: string;
  staffPhones?: string[];
  photo?: { bytes: Buffer; mime: string } | null;
  /** Skip a second Tesseract pass when the caller already read the paper. */
  ocrText?: string;
}) {
  const phone = canonPhone(opts.phone);
  const trxId = opts.trxId.trim();
  if (phone.length < 8) return { ok: false as const, error: "Invalid member phone" };
  if (!trxId) return { ok: false as const, error: "Isi No. transaksi / No. Struk / No. Invoice." };
  const amount = opts.amount != null && Number.isFinite(opts.amount) ? Math.round(opts.amount) : null;
  if (amount == null || amount < 0) {
    return { ok: false as const, error: "Nominal wajib. Isi Rp dari kertas kasir." };
  }
  if (!opts.photo?.bytes?.length) {
    return { ok: false as const, error: "Foto struk wajib." };
  }
  const compressed = await compressReceiptPhoto(opts.photo.bytes, opts.photo.mime);
  if (!compressed.ok) return { ok: false as const, error: compressed.error };
  const loc = await prisma.location.findFirst({
    where: { id: opts.locationId, tenantId: opts.tenantId, status: { not: "ARCHIVED" } },
  });
  if (!loc) return { ok: false as const, error: "Outlet not found" };
  if (staffPhoneBlocked(phone, opts.staffPhones || [])) {
    return { ok: false as const, error: "That phone is a staff number for this outlet" };
  }
  const mem = await memberState(opts.tenantId, phone);
  if (!mem.canSubmitReceipt) {
    return { ok: false as const, error: "Membership not valid. Customer must register first (scan QR)." };
  }
  if (!stampMeetsMin(amount, mem.minAmount)) {
    return {
      ok: false as const,
      error: `Below brand minimum (Rp ${mem.minAmount.toLocaleString("id-ID")})`,
    };
  }
  const ocrText = opts.ocrText != null ? opts.ocrText : await ocrReceiptImage(compressed.jpeg);
  const match = matchReceiptPhoto({ typedTrx: trxId, typedAmount: amount, typedPhone: phone, ocrText });
  const ocrJson = JSON.stringify({
    raw: ocrText.slice(0, 4000),
    status: match.status,
    ocrNomor: match.ocrNomor,
    ocrAmount: match.ocrAmount,
    ocrPhone: match.ocrPhone,
  });
  const program = await getOrCreateProgram(opts.tenantId);
  try {
    const row = await prisma.loyaltyIntake.create({
      data: {
        tenantId: opts.tenantId,
        locationId: opts.locationId,
        phone,
        trxId,
        amount,
        invoiceRef: opts.invoiceRef?.trim() || null,
        source: opts.source || "FORM",
        status: "PENDING",
        photoImage: compressed.jpeg,
        photoMime: "image/jpeg",
        ocrJson,
        matchStatus: match.status,
      },
    });
    const canAuto = match.status === "MATCH" && !program.receiptAuditMode;
    if (canAuto) {
      const reviewed = await reviewIntake({
        tenantId: opts.tenantId,
        intakeId: row.id,
        actorId: SYSTEM_OCR_ACTOR,
        action: "approve",
      });
      if (reviewed.ok) {
        return {
          ok: true as const,
          autoApproved: true as const,
          matchStatus: match.status,
          match,
          intake: { id: row.id, status: "APPROVED" as const },
        };
      }
      return {
        ok: true as const,
        autoApproved: false as const,
        matchStatus: match.status,
        match,
        warn: "error" in reviewed ? reviewed.error : "Kartu penuh atau belum bisa stamp. Struk di antrian kantor.",
        intake: { id: row.id, status: "PENDING" as const },
      };
    }
    return {
      ok: true as const,
      autoApproved: false as const,
      matchStatus: match.status,
      match,
      intake: { id: row.id, status: "PENDING" as const },
    };
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "P2002") return { ok: false as const, error: "This transaction number was already submitted" };
    throw e;
  }
}

export async function listIntakes(tenantId: string, status?: string, locationId?: string | null) {
  const rows = await prisma.loyaltyIntake.findMany({
    where: { tenantId, ...(status ? { status } : {}), ...(locationId ? { locationId } : {}) },
    select: {
      id: true,
      phone: true,
      trxId: true,
      amount: true,
      invoiceRef: true,
      status: true,
      notifyStatus: true,
      matchStatus: true,
      ocrJson: true,
      photoMime: true,
      createdAt: true,
      location: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((row) => {
    const ocr = parseOcrJson(row.ocrJson);
    return {
      id: row.id,
      phone: row.phone,
      trxId: row.trxId,
      amount: row.amount,
      invoiceRef: row.invoiceRef,
      status: row.status,
      notifyStatus: row.notifyStatus,
      matchStatus: row.matchStatus,
      hasPhoto: Boolean(row.photoMime),
      ocrNomor: ocr.ocrNomor,
      ocrAmount: ocr.ocrAmount,
      ocrPhone: ocr.ocrPhone,
      createdAt: row.createdAt,
      location: row.location,
    };
  });
}

export async function reviewIntake(opts: {
  tenantId: string;
  intakeId: string;
  actorId: string;
  action: "approve" | "reject";
  reason?: string;
}) {
  const intake = await prisma.loyaltyIntake.findFirst({
    where: { id: opts.intakeId, tenantId: opts.tenantId },
  });
  if (!intake) return { ok: false as const, error: "Not found" };
  if (intake.status !== "PENDING") return { ok: false as const, error: "Already reviewed" };

  if (opts.action === "reject") {
    const row = await prisma.loyaltyIntake.update({
      where: { id: intake.id },
      data: {
        status: "REJECTED",
        rejectReason: opts.reason?.trim() || "Rejected",
        reviewedById: opts.actorId,
        reviewedAt: new Date(),
        photoImage: null,
        photoMime: "",
      },
    });
    return { ok: true as const, intake: row };
  }

  const program = await getOrCreateProgram(opts.tenantId);
  const mem = await memberState(opts.tenantId, intake.phone);
  if (!mem.registered) {
    return { ok: false as const, error: "Membership not valid. Customer must register first (scan QR)." };
  }
  if (!stampMeetsMin(intake.amount, program.stampMinAmount)) {
    return {
      ok: false as const,
      error: `Below brand minimum (Rp ${program.stampMinAmount.toLocaleString("id-ID")})`,
    };
  }
  if (program.stampEnabled) {
    const status = await memberStampStatus(opts.tenantId, intake.phone);
    if (status.full) {
      return { ok: false as const, error: "Card is full — redeem before adding stamps" };
    }
  }

  const stampedAt = new Date();
  await prisma.$transaction([
    prisma.loyaltyIntake.update({
      where: { id: intake.id },
      data: {
        status: "APPROVED",
        reviewedById: opts.actorId,
        reviewedAt: stampedAt,
        photoImage: null,
        photoMime: "",
      },
    }),
    prisma.loyaltyStamp.create({
      data: {
        tenantId: opts.tenantId,
        memberPhone: intake.phone,
        intakeId: intake.id,
        locationId: intake.locationId,
        amount: intake.amount,
        stampedAt,
      },
    }),
  ]);

  const notify = await notifyMember(opts.tenantId, intake.phone, await memberStampStatus(opts.tenantId, intake.phone));
  await prisma.loyaltyIntake.update({
    where: { id: intake.id },
    data: {
      notifyStatus: notify.status,
      notifyError: notify.error,
    },
  });
  return { ok: true as const, intakeId: intake.id, notify };
}

export async function memberStampStatus(tenantId: string, rawPhone: string) {
  const phone = canonPhone(rawPhone);
  const program = await getOrCreateProgram(tenantId);
  const stampTiers = normalizeStampTiers(program.stampTiersJson, {
    goal: program.stampGoal,
    reward: program.stampRewardText,
  });
  const [stamps, redemptions] = await Promise.all([
    prisma.loyaltyStamp.findMany({
      where: { tenantId, memberPhone: phone },
      orderBy: { stampedAt: "asc" },
    }),
    prisma.loyaltyRedemption.findMany({
      where: { tenantId, memberPhone: phone, kind: "STAMP_CARD" },
      orderBy: { redeemedAt: "desc" },
    }),
  ]);
  const card = currentCardStamps({
    stamps,
    lastStampRedeemAt: lastCardResetAt(redemptions),
    expiry: program.stampExpiry as StampExpiry,
  });
  const count = card.stamps.length;
  const goal = stampCardGoal(stampTiers) || program.stampGoal;
  const startedAt = card.startedAt?.toISOString() ?? null;
  const claimedKeys = redemptions.filter((r) => r.periodKey === startedAt).map((r) => r.tierKey);
  const tiers = stampTierStates({ count, tiers: stampTiers, claimedKeys });
  const full = program.stampEnabled && goal > 0 && count >= goal && !card.expired;
  const next = tiers.find((t) => t.canRedeem);
  return {
    phone,
    enabled: program.stampEnabled,
    goal,
    count,
    full,
    expired: card.expired,
    redeemed: tiers.length > 0 && tiers.every((t) => t.claimed),
    reward: next?.reward || stampTiers[stampTiers.length - 1]?.reward || program.stampRewardText,
    minAmount: program.stampMinAmount,
    canRedeem: program.stampEnabled && !card.expired && tiers.some((t) => t.canRedeem),
    startedAt,
    tiers,
    waReplies: parseWaReplies(program.waRepliesJson),
  };
}

export async function memberSpenderStatus(tenantId: string, rawPhone: string) {
  const phone = canonPhone(rawPhone);
  const program = await getOrCreateProgram(tenantId);
  const tz = (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))
    ?.timezone || "Asia/Jakarta";
  const periodKey = monthPeriodKey(new Date(), tz);
  if (!program.spenderEnabled) {
    return { phone, enabled: false, periodKey, rank: null, spend: 0, canRedeem: false, redeemed: false, reward: "" };
  }
  const { start, endExclusive } = monthBounds(periodKey, tz);
  const whereAmount = {
    tenantId,
    stampedAt: { gte: start, lt: endExclusive },
    amount: { not: null, gte: program.spenderMinAmount || 0 },
    ...(program.spenderScope === "LOCATION" && program.spenderLocationId
      ? { locationId: program.spenderLocationId }
      : {}),
  };
  const grouped = await prisma.loyaltyStamp.groupBy({
    by: ["memberPhone"],
    where: whereAmount,
    _sum: { amount: true },
  });
  const ranked = grouped
    .map((g) => ({ phone: g.memberPhone, spend: g._sum.amount || 0 }))
    .sort((a, b) => b.spend - a.spend);
  const idx = ranked.findIndex((r) => r.phone === phone);
  const spend = idx >= 0 ? ranked[idx].spend : 0;
  const rank = idx >= 0 ? idx + 1 : null;
  const redeemed = Boolean(
    await prisma.loyaltyRedemption.findFirst({
      where: { tenantId, memberPhone: phone, kind: "TOP_SPENDER", periodKey },
    })
  );
  const spenderTiers = normalizeSpenderTiers(program.spenderTiersJson, {
    topN: program.spenderTopN,
    reward: program.spenderRewardText,
  });
  const topN = spenderTopN(spenderTiers) || program.spenderTopN;
  const reward = spenderRewardForRank(rank, spenderTiers);
  const inTop = rank != null && reward != null && spend > 0;
  return {
    phone,
    enabled: true,
    periodKey,
    rank,
    spend,
    topN,
    canRedeem: inTop && !redeemed,
    redeemed,
    reward: reward ?? "",
    tiers: spenderTiers,
  };
}

export async function redeem(opts: {
  tenantId: string;
  phone: string;
  kind: "STAMP_CARD" | "TOP_SPENDER" | "BIRTHDAY";
  actorId: string;
  locationId?: string | null;
  tierKey?: string | null;
  voucherCode?: string | null;
}) {
  const phone = canonPhone(opts.phone);
  if (opts.kind === "STAMP_CARD") {
    const mem = await memberState(opts.tenantId, phone);
    if (!mem.canRedeem) return { ok: false as const, error: "Membership is not active yet" };
    const st = await memberStampStatus(opts.tenantId, phone);
    const wanted = opts.tierKey ? String(opts.tierKey) : "";
    const tier = wanted
      ? st.tiers.find((t) => String(t.stamps) === wanted && t.canRedeem)
      : st.tiers.find((t) => t.canRedeem);
    if (!tier) return { ok: false as const, error: "Nothing to redeem on this stamp card" };
    try {
      await prisma.loyaltyRedemption.create({
        data: {
          tenantId: opts.tenantId,
          memberPhone: phone,
          kind: "STAMP_CARD",
          periodKey: st.startedAt || new Date().toISOString(),
          tierKey: String(tier.stamps),
          resetsCard: tier.isHighest,
          locationId: opts.locationId || null,
          actorId: opts.actorId,
        },
      });
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      if (code === "P2002") return { ok: false as const, error: "That gift was already redeemed" };
      throw e;
    }
    return { ok: true as const, tierKey: String(tier.stamps), resetsCard: tier.isHighest };
  }
  if (opts.kind === "BIRTHDAY") {
    const mem = await memberState(opts.tenantId, phone);
    if (!mem.birthday.canRedeem) return { ok: false as const, error: "Birthday gift is not available" };
    const typed = (opts.voucherCode || "").trim();
    if (!typed) return { ok: false as const, error: "Type the WhatsApp birthday code" };
    const issued = await prisma.loyaltyBirthdayWaSend.findUnique({
      where: {
        tenantId_memberPhone_periodKey: {
          tenantId: opts.tenantId,
          memberPhone: phone,
          periodKey: mem.birthday.periodKey,
        },
      },
      select: { voucherCode: true, status: true },
    });
    if (!issued?.voucherCode || issued.status !== "SENT") {
      return { ok: false as const, error: "No birthday code on WhatsApp yet" };
    }
    if (!voucherCodesMatch(issued.voucherCode, typed)) {
      return { ok: false as const, error: "That code does not match the WhatsApp message" };
    }
    try {
      await prisma.loyaltyRedemption.create({
        data: {
          tenantId: opts.tenantId,
          memberPhone: phone,
          kind: "BIRTHDAY",
          periodKey: mem.birthday.periodKey,
          locationId: opts.locationId || null,
          actorId: opts.actorId,
          voucherCode: issued.voucherCode,
        },
      });
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      if (code === "P2002") return { ok: false as const, error: "Birthday gift already redeemed this year" };
      throw e;
    }
    return { ok: true as const };
  }
  const sp = await memberSpenderStatus(opts.tenantId, phone);
  if (!sp.canRedeem) return { ok: false as const, error: "Not a top spender for this month, or already redeemed" };
  await prisma.loyaltyRedemption.create({
    data: {
      tenantId: opts.tenantId,
      memberPhone: phone,
      kind: "TOP_SPENDER",
      periodKey: sp.periodKey,
      locationId: opts.locationId || null,
      actorId: opts.actorId,
    },
  });
  return { ok: true as const };
}

async function notifyMember(
  tenantId: string,
  phone: string,
  stamp: Awaited<ReturnType<typeof memberStampStatus>>
): Promise<{ status: string; error: string | null }> {
  if (!receiptWaReplyAllowed()) return { status: "SKIPPED", error: null };
  const cfg = await getCloudHqConfig(tenantId);
  if (!cfg) return { status: "SKIPPED", error: null };
  const claimable = stamp.tiers.filter((t) => t.canRedeem);
  const cardUrl = await memberAppUrlFor(tenantId, phone);
  const body = claimable.length
    ? `Stamp ${stamp.count}/${stamp.goal}. Bisa ditukar: ${claimable
        .map((t) => `${t.stamps} stamp (${t.reward || "lihat kasir"})`)
        .join(", ")}. Tunjukkan kartu ke kasir: ${cardUrl}`
    : `Stamp tercatat: ${stamp.count}/${stamp.goal}. Kartu: ${cardUrl}`;
  const sent = await sendCloudHqText({ config: cfg, toPhone: phone, body });
  if (!sent.ok) return { status: "FAILED", error: sent.error };
  return { status: "SENT", error: null };
}

export function stampStatusReply(st: Awaited<ReturnType<typeof memberStampStatus>>): string {
  return formatStampStatusReply(st, st.waReplies as WaReplyCopy);
}

export function stampMenuReply(copy?: WaReplyCopy): string {
  return formatStampMenuReply(copy);
}
