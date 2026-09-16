import { prisma } from "@/lib/db";
import { canonPhone } from "@/lib/conversations/identity";
import { birthdayPeriodKey } from "@/lib/loyalty/rules";
import {
  BIRTHDAY_TEMPLATE_NAME,
  fillBirthdayTemplateBody,
  makeBirthdayVoucherCode,
  normalizeBirthdayVoucherStyle,
  type BirthdayFillOk,
  type BirthdayVoucherStyle,
} from "@/lib/loyalty/birthday-h2";

export async function ensureBirthdayVoucher(opts: {
  tenantId: string;
  phone: string;
  periodKey: string;
  voucherValue: string;
  style?: Partial<BirthdayVoucherStyle> | null;
}): Promise<{ code: string; value: string }> {
  const phone = canonPhone(opts.phone);
  const value = opts.voucherValue.trim().slice(0, 80);
  const existing = await prisma.loyaltyBirthdayWaSend.findUnique({
    where: {
      tenantId_memberPhone_periodKey: {
        tenantId: opts.tenantId,
        memberPhone: phone,
        periodKey: opts.periodKey,
      },
    },
    select: { voucherCode: true, voucherValue: true },
  });
  if (existing?.voucherCode) {
    if (value && value !== existing.voucherValue) {
      await prisma.loyaltyBirthdayWaSend.update({
        where: {
          tenantId_memberPhone_periodKey: {
            tenantId: opts.tenantId,
            memberPhone: phone,
            periodKey: opts.periodKey,
          },
        },
        data: { voucherValue: value },
      });
    }
    return { code: existing.voucherCode, value: value || existing.voucherValue };
  }

  const style = normalizeBirthdayVoucherStyle(opts.style);
  let code = makeBirthdayVoucherCode(opts.periodKey, style);
  for (let i = 0; i < 6; i++) {
    const clash = await prisma.loyaltyBirthdayWaSend.findFirst({
      where: { tenantId: opts.tenantId, periodKey: opts.periodKey, voucherCode: code },
      select: { id: true },
    });
    if (!clash) break;
    code = makeBirthdayVoucherCode(opts.periodKey, style);
  }

  await prisma.loyaltyBirthdayWaSend.upsert({
    where: {
      tenantId_memberPhone_periodKey: {
        tenantId: opts.tenantId,
        memberPhone: phone,
        periodKey: opts.periodKey,
      },
    },
    create: {
      tenantId: opts.tenantId,
      memberPhone: phone,
      periodKey: opts.periodKey,
      templateName: BIRTHDAY_TEMPLATE_NAME,
      status: "PENDING",
      voucherCode: code,
      voucherValue: value,
    },
    update: { voucherCode: code, voucherValue: value },
  });
  return { code, value };
}

export async function birthdayGreetingFillForMember(opts: {
  tenantId: string;
  phone: string;
  bodyText: string;
}): Promise<BirthdayFillOk | { ok: false; reason: string }> {
  const phone = canonPhone(opts.phone);
  const tenant = await prisma.tenant.findUnique({
    where: { id: opts.tenantId },
    select: { timezone: true },
  });
  const periodKey = birthdayPeriodKey(new Date(), tenant?.timezone || "Asia/Jakarta");
  const member = await prisma.loyaltyMember.findUnique({
    where: { tenantId_phone: { tenantId: opts.tenantId, phone } },
    select: { name: true },
  });
  const program = await prisma.loyaltyProgram.findUnique({
    where: { tenantId: opts.tenantId },
    select: {
      birthdayRewardText: true,
      birthdayVoucherPrefix: true,
      birthdayVoucherYear: true,
      birthdayVoucherSuffixLen: true,
    },
  });
  const voucher = await ensureBirthdayVoucher({
    tenantId: opts.tenantId,
    phone,
    periodKey,
    voucherValue: program?.birthdayRewardText || "",
    style: {
      prefix: program?.birthdayVoucherPrefix,
      includeYear: program?.birthdayVoucherYear,
      suffixLen: program?.birthdayVoucherSuffixLen,
    },
  });
  return fillBirthdayTemplateBody(opts.bodyText, {
    customerName: member?.name || phone,
    voucherNumber: voucher.value,
    codeVoucher: voucher.code,
  });
}

export async function claimBirthdayGreetingSlot(opts: {
  tenantId: string;
  phone: string;
  periodKey: string;
}): Promise<boolean> {
  const existing = await prisma.loyaltyBirthdayWaSend.findUnique({
    where: {
      tenantId_memberPhone_periodKey: {
        tenantId: opts.tenantId,
        memberPhone: opts.phone,
        periodKey: opts.periodKey,
      },
    },
    select: { status: true },
  });
  if (existing?.status === "SENT") return false;
  if (existing) return true;
  try {
    await prisma.loyaltyBirthdayWaSend.create({
      data: {
        tenantId: opts.tenantId,
        memberPhone: opts.phone,
        periodKey: opts.periodKey,
        templateName: BIRTHDAY_TEMPLATE_NAME,
        status: "PENDING",
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function markBirthdayGreetingSent(opts: {
  tenantId: string;
  phone: string;
  periodKey: string;
  status: "SENT" | "FAILED";
  error?: string;
}) {
  const phone = canonPhone(opts.phone);
  if (phone.length < 8) return;
  const existing = await prisma.loyaltyBirthdayWaSend.findUnique({
    where: {
      tenantId_memberPhone_periodKey: {
        tenantId: opts.tenantId,
        memberPhone: phone,
        periodKey: opts.periodKey,
      },
    },
    select: { status: true },
  });
  if (existing?.status === "SENT") return;
  await prisma.loyaltyBirthdayWaSend.upsert({
    where: {
      tenantId_memberPhone_periodKey: {
        tenantId: opts.tenantId,
        memberPhone: phone,
        periodKey: opts.periodKey,
      },
    },
    create: {
      tenantId: opts.tenantId,
      memberPhone: phone,
      periodKey: opts.periodKey,
      templateName: BIRTHDAY_TEMPLATE_NAME,
      status: opts.status,
      error: (opts.error || "").slice(0, 500),
    },
    update:
      opts.status === "SENT"
        ? { status: "SENT", error: "", sentAt: new Date(), templateName: BIRTHDAY_TEMPLATE_NAME }
        : { status: "FAILED", error: (opts.error || "").slice(0, 500), sentAt: new Date() },
  });
}
