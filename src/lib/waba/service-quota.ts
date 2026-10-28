import { prisma } from "@/lib/db";
import { INDONESIA, SERVICE_FREE_PER_PHONE_PER_MONTH } from "@/lib/broadcast/rates";
import type { CloudStatusEvent } from "@/lib/broadcast/status";
import type { CloudHqConfig } from "@/lib/conversations/cloud-hq";

export const SERVICE_FREE_CAP = SERVICE_FREE_PER_PHONE_PER_MONTH;

export type ServiceQuotaSnapshot = {
  connected: boolean;
  phoneNumberId: string | null;
  displayPhone: string | null;
  periodKey: string;
  used: number;
  cap: number;
  remaining: number;
  billingOwner: "BRAND" | "P2P";
  paymentMethodOk: boolean;
  timezone: string;
  metaEachIdr: number;
};

function isPrismaP2002(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: string }).code === "P2002");
}

/** Calendar month in the WABA timezone. Resets 00:00 on the 1st. Not daily. */
export function periodKeyInTimezone(at: Date, timeZone: string): string {
  const tz = timeZone.trim() || "Asia/Jakarta";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(at);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    if (y && m) return `${y}-${m}`;
  } catch {
    /* fall through */
  }
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Count a delivered human / session reply toward the 1,000.
 * Skip templates and Meta’s click-to-WhatsApp free entry-point.
 * Count free_customer_service now so October is a preview, not a surprise.
 */
export function shouldCountTowardFreeService(opts: {
  status: string;
  pricingCategory?: string | null;
  pricingType?: string | null;
  outboundKind?: "session" | "template" | null;
}): boolean {
  const status = (opts.status || "").toLowerCase();
  if (status !== "delivered" && status !== "read") return false;
  const type = (opts.pricingType || "").toLowerCase();
  if (type.includes("free_entry")) return false;
  const cat = (opts.pricingCategory || "").toLowerCase();
  if (
    cat === "marketing" ||
    cat === "utility" ||
    cat === "authentication" ||
    cat.startsWith("authentication")
  ) {
    return false;
  }
  if (opts.outboundKind === "template") return false;
  if (cat === "service") return true;
  if (opts.outboundKind === "session") return true;
  return false;
}

export class PhoneOwnedByAnotherWorkspace extends Error {
  readonly code = "phone_owned_by_another_workspace";
  constructor() {
    super("phone_owned_by_another_workspace");
    this.name = "PhoneOwnedByAnotherWorkspace";
  }
}

export function isPhoneOwnershipError(err: unknown) {
  return err instanceof PhoneOwnedByAnotherWorkspace;
}

/**
 * Create or refresh a Cloud phone without moving it between workspaces.
 * A unique phoneNumberId already owned by another tenant is rejected.
 */
export async function ensureWabaPhone(opts: {
  tenantId: string;
  phoneNumberId: string;
  wabaId?: string | null;
  displayPhone?: string | null;
  timezone?: string | null;
}) {
  const phoneNumberId = opts.phoneNumberId.trim();
  if (!phoneNumberId) return null;
  const tenantId = opts.tenantId.trim();
  if (!tenantId) throw new PhoneOwnedByAnotherWorkspace();
  const wabaId = (opts.wabaId || "").trim();
  const displayPhone = (opts.displayPhone || "").trim();
  const timezone = (opts.timezone || "").trim() || "Asia/Jakarta";
  const refresh = {
    ...(wabaId ? { wabaId } : {}),
    ...(displayPhone ? { displayPhone } : {}),
    status: "ACTIVE",
  };
  const existing = await prisma.wabaPhone.findUnique({ where: { phoneNumberId } });
  if (existing) {
    if (existing.tenantId !== tenantId) throw new PhoneOwnedByAnotherWorkspace();
    return prisma.wabaPhone.update({ where: { phoneNumberId }, data: refresh });
  }
  try {
    return await prisma.wabaPhone.create({
      data: {
        tenantId,
        phoneNumberId,
        wabaId,
        displayPhone,
        timezone,
        billingOwner: "BRAND",
        paymentMethodOk: false,
        status: "ACTIVE",
      },
    });
  } catch (err) {
    if (!isPrismaP2002(err)) throw err;
    const winner = await prisma.wabaPhone.findUnique({ where: { phoneNumberId } });
    if (!winner || winner.tenantId !== tenantId) throw new PhoneOwnedByAnotherWorkspace();
    return prisma.wabaPhone.update({ where: { phoneNumberId }, data: refresh });
  }
}

export async function noteCloudOutbound(opts: {
  tenantId: string;
  phoneNumberId: string;
  wamid: string;
  kind: "session" | "template";
  wabaId?: string | null;
  displayPhone?: string | null;
}) {
  const wamid = opts.wamid.trim();
  const phoneNumberId = opts.phoneNumberId.trim();
  if (!wamid || !phoneNumberId) return;
  await ensureWabaPhone({
    tenantId: opts.tenantId,
    phoneNumberId,
    wabaId: opts.wabaId,
    displayPhone: opts.displayPhone,
  });
  try {
    await prisma.wabaOutbound.create({
      data: {
        wamid,
        phoneNumberId,
        tenantId: opts.tenantId,
        kind: opts.kind,
      },
    });
  } catch (err) {
    if (!isPrismaP2002(err)) throw err;
  }
}

export async function applyCloudServiceStatuses(statuses: CloudStatusEvent[]) {
  for (const st of statuses) {
    await applyOneServiceStatus(st);
  }
}

async function applyOneServiceStatus(st: CloudStatusEvent) {
  const wamid = st.wamid.trim();
  const phoneNumberId = st.phoneNumberId.trim();
  if (!wamid || !phoneNumberId) return;
  const outbound = await prisma.wabaOutbound.findUnique({ where: { wamid } });
  const outboundKind =
    outbound?.kind === "template" || outbound?.kind === "session" ? outbound.kind : null;
  if (
    !shouldCountTowardFreeService({
      status: st.status,
      pricingCategory: st.pricingCategory,
      pricingType: st.pricingType,
      outboundKind,
    })
  ) {
    return;
  }
  let phone = await prisma.wabaPhone.findUnique({ where: { phoneNumberId } });
  if (!phone) {
    const { findCloudHqByPhoneNumberId } = await import("@/lib/conversations/cloud-hq");
    const hq = await findCloudHqByPhoneNumberId(phoneNumberId);
    if (hq) {
      phone = await ensureWabaPhone({
        tenantId: hq.tenantId,
        phoneNumberId,
        wabaId: hq.wabaId,
        displayPhone: hq.displayPhone,
      });
    }
  }
  if (!phone) return;
  const periodKey = periodKeyInTimezone(st.at, phone.timezone);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.wabaServiceDelivery.create({
        data: { phoneNumberId, periodKey, wamid },
      });
      await tx.wabaServiceMonth.upsert({
        where: { phoneNumberId_periodKey: { phoneNumberId, periodKey } },
        create: {
          phoneNumberId,
          periodKey,
          serviceCount: 1,
          freeCap: SERVICE_FREE_CAP,
        },
        update: { serviceCount: { increment: 1 } },
      });
    });
  } catch (err) {
    if (isPrismaP2002(err)) return;
    throw err;
  }
}

export async function serviceQuotaForTenant(tenantId: string, cfg?: CloudHqConfig | null): Promise<ServiceQuotaSnapshot> {
  const periodKey = periodKeyInTimezone(new Date(), "Asia/Jakarta");
  const empty = (extra?: Partial<ServiceQuotaSnapshot>): ServiceQuotaSnapshot => ({
    connected: false,
    phoneNumberId: null,
    displayPhone: null,
    periodKey,
    used: 0,
    cap: SERVICE_FREE_CAP,
    remaining: SERVICE_FREE_CAP,
    billingOwner: "BRAND",
    paymentMethodOk: false,
    timezone: "Asia/Jakarta",
    metaEachIdr: INDONESIA.service,
    ...extra,
  });
  if (!cfg?.phoneNumberId) return empty();
  let phone;
  try {
    phone = await ensureWabaPhone({
      tenantId,
      phoneNumberId: cfg.phoneNumberId,
      wabaId: cfg.wabaId,
      displayPhone: cfg.displayPhone,
    });
  } catch (err) {
    if (isPhoneOwnershipError(err)) return empty();
    throw err;
  }
  if (!phone) return empty();
  const month = await prisma.wabaServiceMonth.findUnique({
    where: {
      phoneNumberId_periodKey: {
        phoneNumberId: phone.phoneNumberId,
        periodKey: periodKeyInTimezone(new Date(), phone.timezone),
      },
    },
  });
  const cap = month?.freeCap || SERVICE_FREE_CAP;
  const used = month?.serviceCount || 0;
  const remaining = Math.max(0, cap - used);
  return {
    connected: true,
    phoneNumberId: phone.phoneNumberId,
    displayPhone: phone.displayPhone || cfg.displayPhone,
    periodKey: periodKeyInTimezone(new Date(), phone.timezone),
    used,
    cap,
    remaining,
    billingOwner: phone.billingOwner === "P2P" ? "P2P" : "BRAND",
    paymentMethodOk: phone.paymentMethodOk,
    timezone: phone.timezone,
    metaEachIdr: INDONESIA.service,
  };
}

export async function patchWabaPhoneOps(
  phoneNumberId: string,
  patch: { paymentMethodOk?: boolean; billingOwner?: "BRAND" | "P2P" }
) {
  const data: { paymentMethodOk?: boolean; billingOwner?: string } = {};
  if (typeof patch.paymentMethodOk === "boolean") data.paymentMethodOk = patch.paymentMethodOk;
  if (patch.billingOwner === "BRAND" || patch.billingOwner === "P2P") data.billingOwner = patch.billingOwner;
  if (!Object.keys(data).length) return;
  await prisma.wabaPhone.update({ where: { phoneNumberId }, data });
}
