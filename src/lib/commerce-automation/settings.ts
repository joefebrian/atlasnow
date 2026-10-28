import { prisma } from "@/lib/db";
import { getCloudHqConfig } from "@/lib/conversations/cloud-hq";
import { yolaPhoneNumberId } from "@/lib/yola/config";
import {
  maskDigits,
  parseAllowlist,
  parsePhrases,
  validateAutomationInput,
  type AutomationInput,
} from "@/lib/commerce-automation/match";

const disabled = {
  inboundEnabled: false,
  paymentFollowUpEnabled: false,
  marketingEnabled: false,
  pilotMode: true,
};

export async function readAutomationSettings(tenantId: string) {
  const [row, config] = await Promise.all([
    prisma.workspaceAutomation.findUnique({
      where: { tenantId },
      include: {
        allowlist: { select: { digits: true }, orderBy: { createdAt: "asc" } },
        audits: { orderBy: { createdAt: "desc" }, take: 20 },
        outbounds: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    }),
    getCloudHqConfig(tenantId),
  ]);
  const yolaPhone = yolaPhoneNumberId();
  return {
    configured: Boolean(row),
    connected: Boolean(config),
    yolaIsolated: Boolean(yolaPhone && config?.phoneNumberId === yolaPhone),
    phoneNumberId: config?.phoneNumberId || null,
    inboundEnabled: row?.inboundEnabled ?? false,
    paymentFollowUpEnabled: row?.paymentFollowUpEnabled ?? false,
    marketingEnabled: row?.marketingEnabled ?? false,
    marketingAuthorized: Boolean(row?.marketingAuthorizedAt),
    pilotMode: row?.pilotMode ?? true,
    flowId: row?.flowId ?? "",
    flowScreen: row?.flowScreen ?? "",
    flowCta: row?.flowCta ?? "",
    inboundBody: row?.inboundBody ?? "",
    triggerPhrases: row?.triggerPhrases ?? "",
    paymentTriggerPhrases: row?.paymentTriggerPhrases ?? "",
    paymentMessageText: row?.paymentMessageText ?? "",
    allowlistMasked: (row?.allowlist ?? []).map((item) => maskDigits(item.digits)),
    allowlistCount: row?.allowlist.length ?? 0,
    activity: (row?.outbounds ?? []).map((item) => ({
      id: item.id,
      purpose: item.purpose,
      status: item.status,
      to: maskDigits(item.toDigits),
      detail: item.detail,
      at: item.createdAt.toISOString(),
    })),
    history: (row?.audits ?? []).map((item) => ({
      id: item.id,
      action: item.action,
      summary: item.summary,
      at: item.createdAt.toISOString(),
    })),
  };
}

function summaryOf(input: AutomationInput, allowlistCount: number) {
  return [
    `inbound=${input.inboundEnabled}`,
    `payment=${input.paymentFollowUpEnabled}`,
    `marketing=${input.marketingEnabled}`,
    `pilot=${input.pilotMode}`,
    `flow=${input.flowId ? "set" : "unset"}`,
    `triggers=${parsePhrases(input.triggerPhrases).length}`,
    `allowlist=${allowlistCount}`,
  ].join(" ");
}

export async function saveAutomationSettings(input: {
  tenantId: string;
  actorUserId: string;
  patch: AutomationInput;
  allowlist?: string[];
}) {
  const validated = validateAutomationInput(input.patch);
  if (!validated.ok) return validated;
  const allow = input.allowlist ? parseAllowlist(input.allowlist) : null;
  if (allow && !allow.ok) return allow;
  const config = await getCloudHqConfig(input.tenantId);
  const yolaPhone = yolaPhoneNumberId();
  const isolated = Boolean(yolaPhone && config?.phoneNumberId === yolaPhone);
  const next = validated.value;
  if (isolated && (next.inboundEnabled || next.paymentFollowUpEnabled || next.marketingEnabled)) {
    return {
      ok: false as const,
      error: "This WhatsApp number stays on its own workspace flags. Generic automation cannot turn it on.",
    };
  }
  const existing = await prisma.workspaceAutomation.findUnique({ where: { tenantId: input.tenantId } });
  const before = existing
    ? {
        inboundEnabled: existing.inboundEnabled,
        paymentFollowUpEnabled: existing.paymentFollowUpEnabled,
        marketingEnabled: existing.marketingEnabled,
        pilotMode: existing.pilotMode,
      }
    : disabled;
  const data = {
    inboundEnabled: next.inboundEnabled,
    paymentFollowUpEnabled: next.paymentFollowUpEnabled,
    marketingEnabled: next.marketingEnabled,
    marketingAuthorizedAt: next.marketingEnabled ? existing?.marketingAuthorizedAt ?? null : null,
    pilotMode: next.pilotMode,
    flowId: next.flowId || null,
    flowScreen: next.flowScreen || null,
    flowCta: next.flowCta || null,
    inboundBody: next.inboundBody || null,
    triggerPhrases: input.patch.triggerPhrases.trim() || null,
    paymentTriggerPhrases: input.patch.paymentTriggerPhrases.trim() || null,
    paymentMessageText: next.paymentMessageText || null,
    phoneNumberId: config?.phoneNumberId || null,
    wabaId: config?.wabaId || null,
  };
  await prisma.$transaction(async (tx) => {
    await tx.workspaceAutomation.upsert({
      where: { tenantId: input.tenantId },
      create: { tenantId: input.tenantId, ...data },
      update: data,
    });
    let allowlistCount = existing
      ? await tx.workspaceAutomationAllowlist.count({ where: { tenantId: input.tenantId } })
      : 0;
    if (allow?.ok) {
      await tx.workspaceAutomationAllowlist.deleteMany({ where: { tenantId: input.tenantId } });
      if (allow.digits.length) {
        await tx.workspaceAutomationAllowlist.createMany({
          data: allow.digits.map((digits) => ({ tenantId: input.tenantId, digits })),
        });
      }
      allowlistCount = allow.digits.length;
    }
    await tx.workspaceAutomationAudit.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "config_saved",
        summary: summaryOf(next, allowlistCount),
      },
    });
    const changes = (Object.keys(before) as Array<keyof typeof before>)
      .filter((key) => before[key] !== next[key])
      .map((key) => `${key}:${before[key]}->${next[key]}`);
    if (!next.marketingEnabled && existing?.marketingAuthorizedAt) changes.push("marketing_authorized:cleared");
    if (changes.length) {
      await tx.workspaceAutomationAudit.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          action: "activation",
          summary: changes.join(" "),
        },
      });
    }
  });
  return { ok: true as const };
}

export async function authorizeMarketing(input: { tenantId: string; actorUserId: string }) {
  const config = await getCloudHqConfig(input.tenantId);
  const yolaPhone = yolaPhoneNumberId();
  if (yolaPhone && config?.phoneNumberId === yolaPhone) {
    return {
      ok: false as const,
      error: "This WhatsApp number stays on its own workspace flags. Generic automation cannot turn it on.",
    };
  }
  const row = await prisma.workspaceAutomation.findUnique({ where: { tenantId: input.tenantId } });
  if (!row?.marketingEnabled) {
    return { ok: false as const, error: "Turn on Outbound Marketing and save it before authorizing." };
  }
  await prisma.$transaction([
    prisma.workspaceAutomation.update({
      where: { tenantId: input.tenantId },
      data: { marketingAuthorizedAt: new Date() },
    }),
    prisma.workspaceAutomationAudit.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "marketing_authorized",
        summary: "marketing_authorized",
      },
    }),
  ]);
  return { ok: true as const };
}
