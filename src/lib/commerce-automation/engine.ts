import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getCloudHqConfig, WHATSAPP_CLOUD_PROVIDER } from "@/lib/conversations/cloud-hq";
import { META_GRAPH } from "@/lib/meta/oauth";
import { readInbound, type InboundEvent } from "@/lib/yola/inbound";
import { yolaPhoneNumberId } from "@/lib/yola/config";
import {
  inboundAt,
  matchesPhrase,
  parsePhrases,
  recipientDigits,
  withinServiceWindow,
  workspaceFlowPayload,
  workspaceTextPayload,
} from "@/lib/commerce-automation/match";
import { purposePermitted, type WorkspaceAutomationState } from "@/lib/commerce-automation/policy";

type AutomationRow = {
  tenantId: string;
  inboundEnabled: boolean;
  paymentFollowUpEnabled: boolean;
  marketingEnabled: boolean;
  marketingAuthorizedAt: Date | null;
  pilotMode: boolean;
  flowId: string | null;
  flowScreen: string | null;
  flowCta: string | null;
  inboundBody: string | null;
  triggerPhrases: string | null;
  paymentTriggerPhrases: string | null;
  paymentMessageText: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  allowlist: { digits: string }[];
};

type Routed =
  | { ok: false; reason: string }
  | { ok: true; config: NonNullable<Awaited<ReturnType<typeof getCloudHqConfig>>>; row: AutomationRow | null };

function isP2002(err: unknown) {
  return Boolean(err && typeof err === "object" && (err as { code?: string }).code === "P2002");
}

function stateOf(row: Pick<AutomationRow, "inboundEnabled" | "paymentFollowUpEnabled" | "marketingEnabled" | "pilotMode"> | null): WorkspaceAutomationState {
  if (!row) {
    return {
      configured: false,
      inboundEnabled: false,
      paymentFollowUpEnabled: false,
      marketingEnabled: false,
      pilotMode: true,
    };
  }
  return {
    configured: true,
    inboundEnabled: row.inboundEnabled,
    paymentFollowUpEnabled: row.paymentFollowUpEnabled,
    marketingEnabled: row.marketingEnabled,
    pilotMode: row.pilotMode,
  };
}

function phoneFromMeta(raw: string | null) {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { phoneNumberId?: unknown };
    return typeof parsed.phoneNumberId === "string" ? parsed.phoneNumberId.trim() : "";
  } catch {
    return "";
  }
}

function allowed(row: AutomationRow, digits: string) {
  if (!row.pilotMode) return true;
  return row.allowlist.some((item) => item.digits === digits);
}

function flowReady(row: AutomationRow) {
  return Boolean(
    row.flowId &&
      row.flowScreen &&
      row.flowCta &&
      row.inboundBody &&
      row.phoneNumberId &&
      parsePhrases(row.triggerPhrases).length
  );
}

async function otherTenantClaimsPhone(phoneNumberId: string, tenantId: string) {
  const rows = await prisma.connector.findMany({
    where: {
      provider: WHATSAPP_CLOUD_PROVIDER,
      status: { not: "DISCONNECTED" },
      NOT: { tenantId },
    },
    select: { metaJson: true },
  });
  return rows.some((row) => phoneFromMeta(row.metaJson) === phoneNumberId);
}

async function resolveWorkspace(phoneNumberId: string): Promise<Routed> {
  const yolaPhone = yolaPhoneNumberId();
  if (yolaPhone && phoneNumberId === yolaPhone) return { ok: false, reason: "yola_isolated" };
  const phone = await prisma.wabaPhone.findUnique({ where: { phoneNumberId } });
  if (!phone || phone.status !== "ACTIVE") return { ok: false, reason: "unrouted" };
  const config = await getCloudHqConfig(phone.tenantId);
  if (!config || config.phoneNumberId !== phoneNumberId || config.tenantId !== phone.tenantId) {
    return { ok: false, reason: "connector_mismatch" };
  }
  if (await otherTenantClaimsPhone(phoneNumberId, phone.tenantId)) {
    return { ok: false, reason: "cross_tenant" };
  }
  const row = await prisma.workspaceAutomation.findUnique({
    where: { tenantId: phone.tenantId },
    include: { allowlist: { select: { digits: true } } },
  });
  return { ok: true, config, row };
}

function assertSessionPayload(payload: { type: string; interactive?: { type: string } }) {
  if (payload.type === "text") return;
  if (payload.type === "interactive" && payload.interactive?.type === "flow") return;
  throw new Error("template_blocked");
}

async function postCloud(
  config: { phoneNumberId: string; accessToken: string },
  payload: ReturnType<typeof workspaceTextPayload> | ReturnType<typeof workspaceFlowPayload>,
  fetchImpl: typeof fetch
) {
  assertSessionPayload(payload);
  const res = await fetchImpl(`${META_GRAPH}/${encodeURIComponent(config.phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as { messages?: Array<{ id?: string }> };
  if (!res.ok || !json.messages?.[0]?.id) return { ok: false as const, status: res.status };
  return { ok: true as const, id: json.messages[0].id };
}

async function claimOutbound(input: {
  tenantId: string;
  dedupeKey: string;
  purpose: string;
  status: string;
  phoneNumberId: string;
  toDigits: string;
  detail: string;
}) {
  try {
    await prisma.workspaceAutomationOutbound.create({ data: input });
    return "claimed" as const;
  } catch (err) {
    if (isP2002(err)) return "duplicate" as const;
    throw err;
  }
}

async function finishOutbound(dedupeKey: string, status: string, detail: string) {
  await prisma.workspaceAutomationOutbound.update({
    where: { dedupeKey },
    data: { status, detail: detail.slice(0, 180) },
  });
}

async function sendPayload(input: {
  config: { phoneNumberId: string; accessToken: string };
  dedupeKey: string;
  tenantId: string;
  purpose: string;
  toDigits: string;
  detail: string;
  payload: ReturnType<typeof workspaceTextPayload> | ReturnType<typeof workspaceFlowPayload>;
  fetchImpl: typeof fetch;
}) {
  const claim = await claimOutbound({
    tenantId: input.tenantId,
    dedupeKey: input.dedupeKey,
    purpose: input.purpose,
    status: "claimed",
    phoneNumberId: input.config.phoneNumberId,
    toDigits: input.toDigits,
    detail: "",
  });
  if (claim === "duplicate") return "duplicate" as const;
  try {
    const posted = await postCloud(input.config, input.payload, input.fetchImpl);
    if (!posted.ok) {
      await finishOutbound(input.dedupeKey, "failed", `http_${posted.status}`);
      return "failed" as const;
    }
    await finishOutbound(input.dedupeKey, "sent", input.detail);
    return "sent" as const;
  } catch {
    await finishOutbound(input.dedupeKey, "failed", "send_failed").catch(() => undefined);
    return "failed" as const;
  }
}

async function releaseHeld(input: {
  row: AutomationRow;
  config: { phoneNumberId: string; accessToken: string };
  digits: string;
  fetchImpl: typeof fetch;
}) {
  if (!purposePermitted({ purpose: "payment_link", legacyFlag: null, workspace: stateOf(input.row) })) return;
  if (!input.row.paymentMessageText || !allowed(input.row, input.digits)) return;
  const held = await prisma.workspaceAutomationOutbound.findMany({
    where: {
      tenantId: input.row.tenantId,
      purpose: "payment_followup",
      status: "held",
      toDigits: input.digits,
    },
    orderBy: { createdAt: "asc" },
    take: 3,
  });
  for (const item of held) {
    const taken = await prisma.workspaceAutomationOutbound.updateMany({
      where: { id: item.id, status: "held" },
      data: { status: "claimed" },
    });
    if (taken.count !== 1) continue;
    const payload = workspaceTextPayload(input.digits, input.row.paymentMessageText);
    try {
      const posted = await postCloud(input.config, payload, input.fetchImpl);
      await finishOutbound(item.dedupeKey, posted.ok ? "sent" : "failed", posted.ok ? "text_sent" : `http_${posted.status}`);
    } catch {
      await finishOutbound(item.dedupeKey, "failed", "send_failed").catch(() => undefined);
    }
  }
}

async function handleEvent(input: { event: InboundEvent; now: Date; fetchImpl: typeof fetch }) {
  const routed = await resolveWorkspace(input.event.phoneNumberId);
  if (!routed.ok) return routed.reason;
  const row = routed.row;
  if (!row || row.phoneNumberId !== input.event.phoneNumberId) return row ? "binding_mismatch" : "not_configured";
  if (row.wabaId && routed.config.wabaId && row.wabaId !== routed.config.wabaId) return "binding_mismatch";
  const digits = recipientDigits(input.event.fromWaId);
  if (!digits) return "invalid_recipient";
  const open = withinServiceWindow(inboundAt(input.event.sentAt, input.now), input.now);
  if (open) {
    await releaseHeld({ row, config: routed.config, digits, fetchImpl: input.fetchImpl });
  }
  if (input.event.kind !== "text") return "ignored";
  let outcome = "skipped";
  const workspace = stateOf(row);
  if (
    purposePermitted({ purpose: "flow_invite", legacyFlag: null, workspace }) &&
    flowReady(row) &&
    matchesPhrase(input.event.body, parsePhrases(row.triggerPhrases))
  ) {
    if (!open) outcome = "outside_window";
    else if (!allowed(row, digits)) outcome = "pilot_allowlist";
    else {
      outcome = await sendPayload({
        config: routed.config,
        tenantId: row.tenantId,
        dedupeKey: `flow:${input.event.phoneNumberId}:${input.event.wamid}`,
        purpose: "inbound_flow",
        toDigits: digits,
        detail: "flow_sent",
        fetchImpl: input.fetchImpl,
        payload: workspaceFlowPayload({
          to: digits,
          flowId: row.flowId || "",
          flowToken: randomBytes(16).toString("base64url"),
          screen: row.flowScreen || "",
          body: row.inboundBody || "",
          cta: row.flowCta || "",
        }),
      });
    }
  }
  if (
    purposePermitted({ purpose: "payment_link", legacyFlag: null, workspace }) &&
    row.paymentMessageText &&
    matchesPhrase(input.event.body, parsePhrases(row.paymentTriggerPhrases))
  ) {
    if (!open) outcome = "outside_window";
    else if (!allowed(row, digits)) outcome = "pilot_allowlist";
    else {
      outcome = await sendPayload({
        config: routed.config,
        tenantId: row.tenantId,
        dedupeKey: `paymsg:${input.event.phoneNumberId}:${input.event.wamid}`,
        purpose: "payment_followup",
        toDigits: digits,
        detail: "text_sent",
        fetchImpl: input.fetchImpl,
        payload: workspaceTextPayload(digits, row.paymentMessageText),
      });
    }
  }
  return outcome;
}

export async function routeWorkspaceAutomation(input: {
  trusted: boolean;
  body: unknown;
  now?: Date;
  fetchImpl?: typeof fetch;
}) {
  if (!input.trusted) return { ran: false, handled: 0, reason: "untrusted" };
  const now = input.now ?? new Date();
  const fetchImpl = input.fetchImpl ?? fetch;
  const events = readInbound(input.body).filter((event) => event.kind !== "status" && event.wamid && event.phoneNumberId);
  if (!events.length) return { ran: false, handled: 0, reason: "no_messages" };
  let handled = 0;
  let isolated = 0;
  for (const event of events) {
    const outcome = await handleEvent({ event, now, fetchImpl });
    if (outcome === "sent" || outcome === "held" || outcome === "failed") handled += 1;
    if (outcome === "yola_isolated") isolated += 1;
  }
  if (isolated === events.length) return { ran: true, handled: 0, reason: "yola_isolated" };
  return { ran: true, handled };
}

export async function deliverPaymentFollowUp(input: {
  tenantId: string;
  phoneNumberId: string;
  toDigits: string;
  orderRef: string;
  lastInboundAt: Date | null;
  now?: Date;
  fetchImpl?: typeof fetch;
}) {
  const digits = recipientDigits(input.toDigits);
  const orderRef = input.orderRef.trim();
  if (!digits || !/^[A-Za-z0-9:_-]{1,80}$/.test(orderRef)) {
    return { status: "skipped", reason: "invalid_recipient" };
  }
  const routed = await resolveWorkspace(input.phoneNumberId);
  if (!routed.ok) return { status: "skipped", reason: routed.reason };
  if (routed.config.tenantId !== input.tenantId) return { status: "skipped", reason: "cross_tenant" };
  const row = routed.row;
  if (!row || row.phoneNumberId !== input.phoneNumberId) {
    return { status: "skipped", reason: row ? "binding_mismatch" : "not_configured" };
  }
  const workspace = stateOf(row);
  if (!purposePermitted({ purpose: "payment_link", legacyFlag: null, workspace })) {
    return { status: "skipped", reason: "payment_disabled" };
  }
  if (!row.paymentMessageText) return { status: "skipped", reason: "missing_message" };
  if (!allowed(row, digits)) return { status: "skipped", reason: "pilot_allowlist" };
  const now = input.now ?? new Date();
  const dedupeKey = `pay:${input.tenantId}:${orderRef}`;
  const payload = workspaceTextPayload(digits, row.paymentMessageText);
  if (!withinServiceWindow(input.lastInboundAt, now)) {
    const existing = await prisma.workspaceAutomationOutbound.findUnique({ where: { dedupeKey } });
    if (existing) return { status: existing.status, reason: "duplicate" };
    await prisma.workspaceAutomationOutbound.create({
      data: {
        tenantId: input.tenantId,
        dedupeKey,
        purpose: "payment_followup",
        status: "held",
        phoneNumberId: input.phoneNumberId,
        toDigits: digits,
        detail: "held_outside_window",
      },
    });
    return { status: "held", reason: "outside_window" };
  }
  const existing = await prisma.workspaceAutomationOutbound.findUnique({ where: { dedupeKey } });
  if (existing?.status === "held") {
    const taken = await prisma.workspaceAutomationOutbound.updateMany({
      where: { id: existing.id, status: "held" },
      data: { status: "claimed" },
    });
    if (taken.count !== 1) return { status: "duplicate", reason: "duplicate" };
    try {
      const posted = await postCloud(routed.config, payload, input.fetchImpl ?? fetch);
      await finishOutbound(dedupeKey, posted.ok ? "sent" : "failed", posted.ok ? "text_sent" : `http_${posted.status}`);
      return { status: posted.ok ? "sent" : "failed", reason: posted.ok ? "sent" : "failed" };
    } catch {
      await finishOutbound(dedupeKey, "failed", "send_failed").catch(() => undefined);
      return { status: "failed", reason: "failed" };
    }
  }
  if (existing) return { status: existing.status, reason: "duplicate" };
  const outcome = await sendPayload({
    config: routed.config,
    tenantId: input.tenantId,
    dedupeKey,
    purpose: "payment_followup",
    toDigits: digits,
    detail: "text_sent",
    fetchImpl: input.fetchImpl ?? fetch,
    payload,
  });
  return { status: outcome === "sent" ? "sent" : outcome, reason: outcome };
}

/** Marketing never sends from this engine. Both switches are required before a later sender may exist. */
export async function requestMarketingSend(input: { tenantId: string; toDigits: string; fetchImpl?: typeof fetch }) {
  void input.fetchImpl;
  void input.toDigits;
  const yolaPhone = yolaPhoneNumberId();
  const config = await getCloudHqConfig(input.tenantId);
  if (yolaPhone && config?.phoneNumberId === yolaPhone) {
    return { ok: false as const, sent: false, reason: "yola_isolated" };
  }
  const row = await prisma.workspaceAutomation.findUnique({ where: { tenantId: input.tenantId } });
  const workspace = stateOf(row);
  if (!purposePermitted({ purpose: "marketing", legacyFlag: null, workspace })) {
    return { ok: false as const, sent: false, reason: "marketing_disabled" };
  }
  if (!row?.marketingAuthorizedAt) {
    return { ok: false as const, sent: false, reason: "marketing_not_authorized" };
  }
  return { ok: false as const, sent: false, reason: "marketing_send_not_activated" };
}
