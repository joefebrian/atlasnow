import { prisma } from "@/lib/db";
import { canonPhone } from "@/lib/conversations/identity";
import { isValidIdDomicile, phoneLooksIndonesia } from "@/lib/geo/indonesia";
import {
  birthdayPeriodKey,
  birthdayWaAllowed,
  inBirthdayWindow,
  memberLifecycle,
  parseBirthDate,
  receiptAllowed,
  redeemAllowed,
  stampMeetsMin,
  type MemberLifecycle,
} from "./rules";
async function programOf(tenantId: string) {
  return prisma.loyaltyProgram.upsert({ where: { tenantId }, create: { tenantId }, update: {} });
}

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || "https://atlasnow.co").replace(/\/$/, "");
}

export function joinUrl(joinKey: string, outletId?: string | null): string {
  const base = `${appBaseUrl()}/join/${encodeURIComponent(joinKey)}`;
  return outletId ? `${base}?outlet=${encodeURIComponent(outletId)}` : base;
}

export async function registerMember(opts: {
  tenantId: string;
  phone: string;
  name: string;
  email?: string;
  birthDate?: string | null;
  city?: string;
  province?: string;
  birthdayWaOptIn?: boolean;
  locationId?: string | null;
  source?: string;
  qrScope: string;
}) {
  const phone = canonPhone(opts.phone);
  if (phone.length < 8) return { ok: false as const, error: "Nomor HP tidak valid" };
  const name = (opts.name || "").trim();
  if (name.length < 2) return { ok: false as const, error: "Nama wajib diisi" };
  const birthRaw = opts.birthDate?.trim() || "";
  const birth = birthRaw ? parseBirthDate(birthRaw) : null;
  if (!birthRaw || !birth) return { ok: false as const, error: "Tanggal lahir wajib diisi" };
  const email = (opts.email || "").trim().toLowerCase();
  if (!email) return { ok: false as const, error: "Email wajib diisi" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "Email tidak valid" };
  }
  const province = (opts.province || "").trim();
  const city = (opts.city || "").trim();
  if (phoneLooksIndonesia(phone) || phoneLooksIndonesia(opts.phone)) {
    if (!isValidIdDomicile(province, city)) {
      return { ok: false as const, error: "Pilih provinsi dan kota/kabupaten" };
    }
  }

  let signupLocationId = opts.locationId || null;
  if (opts.qrScope === "LOCATION") {
    if (!signupLocationId) return { ok: false as const, error: "Scan QR cabang ini" };
  }
  if (signupLocationId) {
    const loc = await prisma.location.findFirst({
      where: { id: signupLocationId, tenantId: opts.tenantId, status: { not: "ARCHIVED" } },
    });
    if (!loc) return { ok: false as const, error: "Cabang tidak ditemukan" };
  }

  const optIn = Boolean(opts.birthdayWaOptIn);
  const existing = await prisma.loyaltyMember.findUnique({
    where: { tenantId_phone: { tenantId: opts.tenantId, phone } },
  });
  const row = await prisma.loyaltyMember.upsert({
    where: { tenantId_phone: { tenantId: opts.tenantId, phone } },
    create: {
      tenantId: opts.tenantId,
      phone,
      name,
      email,
      birthDate: birth?.iso ?? null,
      city,
      province,
      birthdayWaOptIn: optIn,
      birthdayWaOptInAt: optIn ? new Date() : null,
      signupLocationId,
      source: opts.source || (signupLocationId ? "QR_OUTLET" : "QR"),
    },
    update: {
      name,
      email,
      birthDate: birth?.iso ?? null,
      city,
      province,
      birthdayWaOptIn: optIn,
      birthdayWaOptInAt: optIn ? new Date() : existing?.birthdayWaOptIn ? existing.birthdayWaOptInAt : optIn ? new Date() : null,
      ...(existing?.signupLocationId ? {} : { signupLocationId }),
    },
  });
  return { ok: true as const, member: row, created: !existing };
}

export async function memberState(tenantId: string, rawPhone: string) {
  const phone = canonPhone(rawPhone);
  const program = await programOf(tenantId);
  const member = await prisma.loyaltyMember.findUnique({
    where: { tenantId_phone: { tenantId, phone } },
    include: { signupLocation: { select: { id: true, name: true } } },
  });
  const approved = await prisma.loyaltyIntake.findMany({
    where: { tenantId, phone, status: "APPROVED" },
    orderBy: { reviewedAt: "asc" },
    select: { amount: true, locationId: true, reviewedAt: true, location: { select: { id: true, name: true } } },
  });
  const qualifying = approved.filter((r) => stampMeetsMin(r.amount, program.stampMinAmount));
  const life: MemberLifecycle = memberLifecycle({
    registered: Boolean(member),
    qualifyingApprovedCount: qualifying.length,
  });
  const first = qualifying[0];
  const tz = (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || "Asia/Jakarta";
  const birth = member?.birthDate ? parseBirthDate(member.birthDate) : null;
  const inWindow = birth
    ? inBirthdayWindow({ month: birth.month, day: birth.day, timeZone: tz })
    : false;
  const yearKey = birthdayPeriodKey(new Date(), tz);
  const birthdayRedeemed = Boolean(
    await prisma.loyaltyRedemption.findFirst({
      where: { tenantId, memberPhone: phone, kind: "BIRTHDAY", periodKey: yearKey },
    })
  );
  return {
    phone,
    registered: Boolean(member),
    life,
    canSubmitReceipt: receiptAllowed(life),
    canRedeem: redeemAllowed(life),
    canBirthdayWa: birthdayWaAllowed(life, Boolean(member?.birthdayWaOptIn)),
    member,
    qualifyingCount: qualifying.length,
    activatedLocation: first?.location ?? null,
    minAmount: program.stampMinAmount,
    birthday: {
      enabled: program.birthdayEnabled,
      reward: program.birthdayRewardText,
      inWindow,
      canRedeem: program.birthdayEnabled && redeemAllowed(life) && inWindow && !birthdayRedeemed,
      redeemed: birthdayRedeemed,
      periodKey: yearKey,
      waSent: Boolean(
        (
          await prisma.loyaltyBirthdayWaSend.findUnique({
            where: {
              tenantId_memberPhone_periodKey: { tenantId, memberPhone: phone, periodKey: yearKey },
            },
            select: { voucherCode: true, status: true },
          })
        )?.status === "SENT"
      ),
    },
  };
}

export async function listMembers(opts: {
  tenantId: string;
  q?: string;
  locationId?: string;
  status?: string;
}) {
  const program = await programOf(opts.tenantId);
  const members = await prisma.loyaltyMember.findMany({
    where: {
      tenantId: opts.tenantId,
      ...(opts.q
        ? {
            OR: [
              { phone: { contains: opts.q } },
              { name: { contains: opts.q, mode: "insensitive" } },
              { email: { contains: opts.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { signupLocation: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const phones = members.map((m) => m.phone);
  const intakes = phones.length
    ? await prisma.loyaltyIntake.findMany({
        where: { tenantId: opts.tenantId, phone: { in: phones }, status: "APPROVED" },
        orderBy: { reviewedAt: "asc" },
        select: { phone: true, amount: true, locationId: true, location: { select: { id: true, name: true } } },
      })
    : [];
  const firstByPhone = new Map<string, { id: string; name: string }>();
  const countByPhone = new Map<string, number>();
  for (const row of intakes) {
    if (!stampMeetsMin(row.amount, program.stampMinAmount)) continue;
    countByPhone.set(row.phone, (countByPhone.get(row.phone) || 0) + 1);
    if (!firstByPhone.has(row.phone) && row.location) firstByPhone.set(row.phone, row.location);
  }
  const stamps = phones.length
    ? await prisma.loyaltyStamp.groupBy({
        by: ["memberPhone"],
        where: { tenantId: opts.tenantId, memberPhone: { in: phones } },
        _count: { _all: true },
      })
    : [];
  const stampCount = new Map(stamps.map((s) => [s.memberPhone, s._count._all]));

  const rows = members
    .map((m) => {
      const life = memberLifecycle({
        registered: true,
        qualifyingApprovedCount: countByPhone.get(m.phone) || 0,
      });
      return {
        id: m.id,
        phone: m.phone,
        name: m.name,
        email: m.email,
        birthDate: m.birthDate,
        city: m.city,
        province: m.province,
        status: life,
        birthdayWaOptIn: m.birthdayWaOptIn,
        signupLocation: m.signupLocation,
        activatedLocation: firstByPhone.get(m.phone) || null,
        stampCount: stampCount.get(m.phone) || 0,
        source: m.source,
        createdAt: m.createdAt.toISOString(),
      };
    })
    .filter((r) => {
      if (opts.status && r.status !== opts.status) return false;
      if (
        opts.locationId &&
        r.signupLocation?.id !== opts.locationId &&
        r.activatedLocation?.id !== opts.locationId
      ) {
        return false;
      }
      return true;
    });

  return {
    members: rows,
    stats: {
      total: rows.length,
      calon: rows.filter((r) => r.status === "calon").length,
      aktif: rows.filter((r) => r.status === "aktif").length,
    },
  };
}
