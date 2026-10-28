import { prisma } from "@/lib/db";
import { logAppError } from "@/lib/error-log";
import { canonPhone } from "@/lib/conversations/identity";
import { getCloudHqConfig, listConnectedCloudHq } from "@/lib/conversations/cloud-hq";
import { sendCloudHqTemplate } from "@/lib/conversations/cloud-send";
import { listWabaTemplates } from "@/lib/broadcast/templates";
import { uploadPhoneMedia } from "@/lib/broadcast/media";
import { zonedLocalMidnight, stampMeetsMin, birthdayPeriodKey, parseBirthDate } from "@/lib/loyalty/rules";
import {
  daysUntilNextBirthday,
  fillBirthdayTemplateBody,
  inBirthdayH2SendWindow,
  namedPlaceholders,
  pickBirthdayGreeting,
} from "@/lib/loyalty/birthday-h2";
import {
  claimBirthdayGreetingSlot,
  ensureBirthdayVoucher,
  markBirthdayGreetingSent,
} from "@/lib/loyalty/birthday-wa-record";
import { createBroadcastBatch, recordBroadcastSend } from "@/lib/broadcast/history";

const PER_TENANT_CAP = 200;
const JAKARTA = "Asia/Jakarta";

export type BirthdayH2Result = {
  tenantId: string;
  sent: number;
  failed: number;
  skipped: number;
  reason?: string;
};

let running = false;

export async function runBirthdayH2AllTenants(): Promise<{
  inFlight?: boolean;
  tenants: BirthdayH2Result[];
}> {
  if (running) return { inFlight: true, tenants: [] };
  running = true;
  try {
    const hq = await listConnectedCloudHq();
    const tenants: BirthdayH2Result[] = [];
    const seen = new Set<string>();
    for (const cfg of hq) {
      if (seen.has(cfg.tenantId)) continue;
      seen.add(cfg.tenantId);
      tenants.push(await runBirthdayH2ForTenant(cfg.tenantId));
    }
    await prisma.auditEvent.create({
      data: {
        action: "birthday_h2_run",
        objectType: "LoyaltyBirthdayWaSend",
        metaJson: JSON.stringify({
          tenants: tenants.length,
          sent: tenants.reduce((n, r) => n + r.sent, 0),
          failed: tenants.reduce((n, r) => n + r.failed, 0),
          skipped: tenants.reduce((n, r) => n + r.skipped, 0),
        }),
      },
    }).catch(() => undefined);
    return { tenants };
  } catch (e) {
    await logAppError({
      source: "Birthday H-2",
      title: "H-2 run failed",
      detail: e instanceof Error ? e.message : String(e),
    });
    throw e;
  } finally {
    running = false;
  }
}

export async function runBirthdayH2ForTenant(tenantId: string): Promise<BirthdayH2Result> {
  const empty: BirthdayH2Result = { tenantId, sent: 0, failed: 0, skipped: 0 };
  const cfg = await getCloudHqConfig(tenantId);
  if (!cfg) return { ...empty, skipped: 1, reason: "hq_off" };

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, timezone: true, logoImage: true, logoMime: true, status: true },
  });
  if (!tenant || tenant.status === "ARCHIVED") return { ...empty, skipped: 1, reason: "tenant" };

  const tz = tenant.timezone || JAKARTA;
  const periodKey = birthdayPeriodKey(new Date(), tz);
  const program = await prisma.loyaltyProgram.findUnique({
    where: { tenantId },
    select: {
      stampMinAmount: true,
      birthdayRewardText: true,
      birthdayVoucherPrefix: true,
      birthdayVoucherYear: true,
      birthdayVoucherSuffixLen: true,
    },
  });

  let templates;
  try {
    templates = await listWabaTemplates(cfg);
  } catch (e) {
    return { ...empty, skipped: 1, reason: e instanceof Error ? e.message : "templates" };
  }
  const tpl = pickBirthdayGreeting(templates);
  if (!tpl) return { ...empty, skipped: 1, reason: "no_approved_template" };
  if (tpl.headerFormat === "DOCUMENT" || tpl.headerFormat === "TEXT") {
    return { ...empty, skipped: 1, reason: "header_unsupported" };
  }

  let header: { kind: "image"; mediaId: string } | null = null;
  if (tpl.headerFormat === "IMAGE") {
    if (!tenant.logoImage?.length) return { ...empty, skipped: 1, reason: "no_header_image" };
    try {
      const media = await uploadPhoneMedia(cfg, {
        bytes: Buffer.from(tenant.logoImage),
        mime: tenant.logoMime || "image/webp",
        filename: tenant.logoMime?.includes("png") ? "logo.png" : "logo.webp",
      });
      header = { kind: "image", mediaId: media.id };
    } catch (e) {
      return { ...empty, skipped: 1, reason: e instanceof Error ? e.message : "header_upload" };
    }
  }

  const reward = program?.birthdayRewardText?.trim() || "";
  const needed = namedPlaceholders(tpl.bodyText);
  if (needed.includes("voucher_number") && !reward) {
    return { ...empty, skipped: 1, reason: "no_reward" };
  }

  const members = await prisma.loyaltyMember.findMany({
    where: { tenantId, birthdayWaOptIn: true, birthDate: { not: null } },
    select: { phone: true, name: true, birthDate: true },
  });

  const due: { phone: string; name: string }[] = [];
  for (const m of members) {
    const birth = parseBirthDate(m.birthDate || "");
    if (!birth) continue;
    const days = daysUntilNextBirthday({ month: birth.month, day: birth.day, timeZone: tz });
    if (!inBirthdayH2SendWindow(days)) continue;
    const phone = canonPhone(m.phone);
    if (phone.length < 8) continue;
    due.push({ phone, name: m.name || phone });
  }

  if (!due.length) return empty;

  const already = await prisma.loyaltyBirthdayWaSend.findMany({
    where: {
      tenantId,
      periodKey,
      status: "SENT",
      memberPhone: { in: due.map((d) => d.phone) },
    },
    select: { memberPhone: true },
  });
  const sentSet = new Set(already.map((r) => r.memberPhone));
  const remaining = due.filter((d) => !sentSet.has(d.phone)).slice(0, PER_TENANT_CAP);
  if (!remaining.length) return { ...empty, skipped: due.length };

  const intakes = await prisma.loyaltyIntake.findMany({
    where: { tenantId, status: "APPROVED", phone: { in: remaining.map((d) => d.phone) } },
    select: { phone: true, amount: true },
  });
  const min = program?.stampMinAmount ?? 0;
  const qualifying = new Set<string>();
  for (const row of intakes) {
    if (!stampMeetsMin(row.amount, min)) continue;
    qualifying.add(canonPhone(row.phone));
  }

  let sent = 0;
  let failed = 0;
  let skipped = due.length - remaining.length;

  const batch = await createBroadcastBatch({
    tenantId,
    kind: "BIRTHDAY_H2",
    templateName: tpl.name,
  });

  for (const person of remaining) {
    if (!qualifying.has(person.phone)) {
      skipped += 1;
      continue;
    }
    const voucher = await ensureBirthdayVoucher({
      tenantId,
      phone: person.phone,
      periodKey,
      voucherValue: reward,
      style: {
        prefix: program?.birthdayVoucherPrefix,
        includeYear: program?.birthdayVoucherYear,
        suffixLen: program?.birthdayVoucherSuffixLen,
      },
    });
    const filled = fillBirthdayTemplateBody(tpl.bodyText, {
      customerName: person.name,
      voucherNumber: voucher.value,
      codeVoucher: voucher.code,
    });
    if (!filled.ok) {
      skipped += 1;
      continue;
    }
    const claimed = await claimBirthdayGreetingSlot({ tenantId, phone: person.phone, periodKey });
    if (!claimed) {
      skipped += 1;
      continue;
    }
    const conv = await prisma.waConversation.findFirst({
      where: { tenantId, location: { kind: "HQ" }, contact: { phone: person.phone } },
      orderBy: { lastMessageAt: "desc" },
      select: { id: true },
    });
    const result = await sendCloudHqTemplate({
      config: cfg,
      toPhone: person.phone,
      name: tpl.name,
      language: tpl.language,
      header: header || undefined,
      bodyParams: filled.positional,
      bodyNamedParams: filled.named,
      bodyPreview: `[template:${tpl.name}] ${voucher.code}`,
      conversationId: conv?.id,
    });
    if (result.ok) {
      sent += 1;
      await recordBroadcastSend({
        batchId: batch.id,
        tenantId,
        phone: person.phone,
        wamid: result.messageId,
        ok: true,
      });
      await markBirthdayGreetingSent({ tenantId, phone: person.phone, periodKey, status: "SENT" });
    } else {
      failed += 1;
      await recordBroadcastSend({
        batchId: batch.id,
        tenantId,
        phone: person.phone,
        ok: false,
        error: result.error,
      });
      await markBirthdayGreetingSent({
        tenantId,
        phone: person.phone,
        periodKey,
        status: "FAILED",
        error: result.error,
      });
    }
  }

  return { tenantId, sent, failed, skipped };
}

export function msUntilNextJakarta(hour: number, minute: number, now = new Date()): number {
  const t = jakartaYmd(now);
  let target = zonedLocalMidnight(t.y, t.m, t.d, JAKARTA).getTime() + (hour * 60 + minute) * 60_000;
  if (target <= now.getTime() + 5000) {
    const later = new Date(zonedLocalMidnight(t.y, t.m, t.d, JAKARTA).getTime() + 36 * 3600_000);
    const n = jakartaYmd(later);
    target = zonedLocalMidnight(n.y, n.m, n.d, JAKARTA).getTime() + (hour * 60 + minute) * 60_000;
  }
  return Math.max(1000, target - now.getTime());
}

function jakartaYmd(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const num = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: num("year"), m: num("month"), d: num("day") };
}

export function startBirthdayH2Scheduler() {
  const tick = () => {
    void runBirthdayH2AllTenants().catch(() => undefined);
  };
  const arm = () => {
    setTimeout(() => {
      tick();
      arm();
    }, msUntilNextJakarta(0, 20));
  };
  arm();
  setTimeout(tick, 90_000);
}
