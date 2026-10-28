import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEMO_TICKET_PHRASE, PRODUCT } from "@/lib/yola/catalog";
import { demoCheckoutUrl, newCheckoutToken, paymentLinkMessage, tryDeliverPaymentLink } from "@/lib/yola/checkout";
import { flowSendEnabled, recipientAllowed, ticketLiveIssuanceEnabled, yolaAccessToken, yolaPhoneNumberId, yolaPublishedFlowId } from "@/lib/yola/config";
import { readInbound, type InboundEvent } from "@/lib/yola/inbound";
import { resolveYolaTenantId } from "@/lib/yola/access";
import {
  OFFER,
  classifyIntent,
  insideServiceWindow,
  jakartaDay,
  parseFlowForm,
  phonesDiffer,
  presaleStillOpen,
  referralMatchesCampaign,
  sourceFromReferral,
  toE164,
  visitChoiceOk,
} from "@/lib/yola/policy";
import { hashSecret, amountAccepted, type PaymentOutcome } from "@/lib/yola/payments";
import { flowInvitePayload, type VerifiedTemplate } from "@/lib/yola/template";

type Tx = Prisma.TransactionClient;

export type EngineResult = {
  action: string;
  reason?: string;
  duplicate?: boolean;
  orderId?: string;
  flowToken?: string;
  paymentNonce?: string;
  ticketToken?: string;
  remaining?: number;
  errors?: string[];
};

function randomId() {
  return randomBytes(16).toString("hex");
}

function flowToken() {
  return `yf_${randomBytes(18).toString("base64url")}`;
}

function parseSaved(detail: string): { flowToken?: string; orderId?: string } {
  try {
    const row = JSON.parse(detail) as { flowToken?: string; orderId?: string };
    return row && typeof row === "object" ? row : {};
  } catch {
    return {};
  }
}

async function claim(tx: Tx, tenantId: string, dedupeKey: string, kind: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "YolaAutomationEvent" ("id", "tenantId", "kind", "dedupeKey", "detail", "createdAt")
    VALUES (${randomId()}, ${tenantId}, ${kind}, ${dedupeKey}, '', NOW())
    ON CONFLICT ("tenantId", "dedupeKey") DO NOTHING
    RETURNING "id"
  `;
  return rows.length > 0;
}

async function remember(tx: Tx, tenantId: string, dedupeKey: string, detail: { flowToken?: string; orderId?: string }) {
  await tx.yolaAutomationEvent.update({
    where: { tenantId_dedupeKey: { tenantId, dedupeKey } },
    data: { detail: JSON.stringify(detail) },
  });
}

async function nextHumanId(tx: Tx, tenantId: string, now: Date) {
  const day = jakartaDay(now).replaceAll("-", "");
  const rows = await tx.$queryRaw<Array<{ next: number }>>`
    INSERT INTO "YolaOrderDaySeq" ("id", "tenantId", "dayKey", "next")
    VALUES (${randomId()}, ${tenantId}, ${day}, 1)
    ON CONFLICT ("tenantId", "dayKey")
    DO UPDATE SET "next" = "YolaOrderDaySeq"."next" + 1
    RETURNING "next"
  `;
  const next = Number(rows[0]?.next);
  if (!Number.isInteger(next) || next < 1) throw new Error("yola_seq_failed");
  return `YOLA-${day}-${String(next).padStart(6, "0")}`;
}

async function touchCustomer(tx: Tx, tenantId: string, waId: string, now: Date) {
  const rows = await tx.$queryRaw<Array<{ id: string; optedOut: boolean }>>`
    INSERT INTO "YolaCustomer" ("id", "tenantId", "waId", "phoneE164", "name", "optedOut", "lastInboundAt", "createdAt", "updatedAt")
    VALUES (${randomId()}, ${tenantId}, ${waId}, '', '', false, ${now}, NOW(), NOW())
    ON CONFLICT ("tenantId", "waId")
    DO UPDATE SET "lastInboundAt" = ${now}, "updatedAt" = NOW()
    RETURNING "id", "optedOut"
  `;
  const row = rows[0];
  if (!row) throw new Error("yola_customer_failed");
  return row;
}

async function holdOutbound(tx: Tx, input: {
  tenantId: string;
  waId: string;
  kind: string;
  body: string;
  payload: unknown;
}) {
  await tx.yolaOutboundMessage.create({
    data: {
      tenantId: input.tenantId,
      waId: input.waId,
      kind: input.kind,
      status: "held",
      body: input.body,
      payloadJson: JSON.stringify(input.payload),
    },
  });
}

async function loadTemplate(tx: Tx, tenantId: string): Promise<VerifiedTemplate | null> {
  const row = await tx.yolaAutomationEvent.findUnique({
    where: { tenantId_dedupeKey: { tenantId, dedupeKey: "template:verified" } },
  });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.detail) as VerifiedTemplate;
    if (parsed.verified !== true || parsed.status !== "APPROVED" || parsed.category !== "MARKETING" || parsed.source !== "meta_api") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function queueInvite(tx: Tx, input: {
  tenantId: string;
  customerId: string;
  waId: string;
  phoneNumberId: string;
  source: string;
  kind: "flow_invite" | "marketing_template";
  now: Date;
}) {
  const token = flowToken();
  await tx.yolaFlowSession.create({
    data: {
      tenantId: input.tenantId,
      customerId: input.customerId,
      waId: input.waId,
      flowToken: token,
      status: "invited",
      source: input.source,
      phoneNumberId: input.phoneNumberId,
    },
  });
  const flowId = yolaPublishedFlowId();
  const payload = flowId
    ? flowInvitePayload({ to: input.waId, flowId, flowToken: token, screen: "OFFER" })
    : { held: true, reason: "flow_id_unconfigured" };
  await holdOutbound(tx, {
    tenantId: input.tenantId,
    waId: input.waId,
    kind: input.kind,
    body: "YOLA FUN Kartu Presale. Jam pilihan adalah preferensi, bukan slot yang dijamin.",
    payload,
  });
  return token;
}

async function dispatchHeld(input: { to: string; payload: unknown; fetchImpl?: typeof fetch }) {
  if (!recipientAllowed(input.to)) return { sent: false, reason: "not_allowlisted" };
  if (!flowSendEnabled()) return { sent: false, reason: "send_disabled" };
  const token = yolaAccessToken();
  const phoneNumberId = yolaPhoneNumberId();
  const flowId = yolaPublishedFlowId();
  if (!token || !phoneNumberId || !flowId) return { sent: false, reason: "send_unconfigured" };
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`https://graph.facebook.com/v25.0/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input.payload),
  });
  if (!response.ok) return { sent: false, reason: "graph_rejected" };
  return { sent: true, reason: "sent" };
}

export async function handleYolaEvent(input: {
  tenantId: string;
  phoneNumberId: string;
  event: InboundEvent;
  now: Date;
  fetchImpl?: typeof fetch;
}): Promise<EngineResult> {
  if (input.event.phoneNumberId !== input.phoneNumberId) {
    return { action: "ignored", reason: "phone_number_not_yola" };
  }
  return prisma.$transaction(async (tx) => {
    if (input.event.kind === "status") {
      if (input.event.deliveryStatus) {
        await tx.yolaOutboundMessage.updateMany({
          where: { tenantId: input.tenantId, providerWamid: input.event.wamid },
          data: { deliveryStatus: input.event.deliveryStatus },
        });
      }
      return { action: "ignored", reason: "status" };
    }
    const dedupeKey = `msg:${input.event.wamid}`;
    const won = await claim(tx, input.tenantId, dedupeKey, "seen");
    if (!won) {
      const prior = await tx.yolaAutomationEvent.findUnique({
        where: { tenantId_dedupeKey: { tenantId: input.tenantId, dedupeKey } },
      });
      const saved = parseSaved(prior?.detail || "");
      const order = await tx.yolaOrder.findFirst({
        where: {
          tenantId: input.tenantId,
          OR: [{ wamid: input.event.wamid }, ...(saved.flowToken ? [{ flowToken: saved.flowToken }] : [])],
        },
        select: { humanId: true },
      });
      return { action: "duplicate", duplicate: true, orderId: order?.humanId, flowToken: saved.flowToken };
    }
    if (input.event.kind === "nfm") return handleSubmission(tx, input, dedupeKey);
    if (input.event.kind !== "text") {
      await remember(tx, input.tenantId, dedupeKey, {});
      return { action: "ignored", reason: "not_text" };
    }
    return handleText(tx, input, dedupeKey);
  }).then(async (result) => {
    if (result.action === "flow_invited" && result.flowToken && flowSendEnabled() && yolaPublishedFlowId()) {
      const payload = flowInvitePayload({
        to: input.event.fromWaId,
        flowId: yolaPublishedFlowId(),
        flowToken: result.flowToken,
        screen: "OFFER",
      });
      await dispatchHeld({ to: input.event.fromWaId, payload, fetchImpl: input.fetchImpl });
    }
    if (result.action === "order_created" && result.orderId) {
      await tryDeliverPaymentLink({
        tenantId: input.tenantId,
        waId: input.event.fromWaId,
        orderId: result.orderId,
        now: input.now,
        fetchImpl: input.fetchImpl,
      });
    }
    return result;
  });
}

async function handleText(
  tx: Tx,
  input: { tenantId: string; phoneNumberId: string; event: InboundEvent; now: Date; fetchImpl?: typeof fetch },
  dedupeKey: string,
): Promise<EngineResult> {
  const customer = await touchCustomer(tx, input.tenantId, input.event.fromWaId, input.now);
  const intent = classifyIntent(input.event.body);
  if (intent === "opt_out") {
    await tx.yolaCustomer.update({ where: { id: customer.id }, data: { optedOut: true } });
    await remember(tx, input.tenantId, dedupeKey, {});
    return { action: "opt_out" };
  }
  if (customer.optedOut) {
    await remember(tx, input.tenantId, dedupeKey, {});
    return { action: "ignored", reason: "opted_out" };
  }
  if (intent === "ambiguous") {
    await holdOutbound(tx, {
      tenantId: input.tenantId,
      waId: input.event.fromWaId,
      kind: "handoff",
      body: "Tim kami akan membalas percakapan ini.",
      payload: { held: true },
    });
    await remember(tx, input.tenantId, dedupeKey, {});
    return { action: "handoff" };
  }
  if (intent !== "yola") {
    await remember(tx, input.tenantId, dedupeKey, {});
    return { action: "ignored", reason: "unrelated" };
  }
  if (!presaleStillOpen(input.now)) {
    await remember(tx, input.tenantId, dedupeKey, {});
    return { action: "ignored", reason: "presale_closed" };
  }
  const open = await tx.yolaFlowSession.findFirst({
    where: { tenantId: input.tenantId, waId: input.event.fromWaId, status: "invited" },
    orderBy: { createdAt: "desc" },
  });
  if (open) {
    await remember(tx, input.tenantId, dedupeKey, { flowToken: open.flowToken });
    return { action: "duplicate", duplicate: true, flowToken: open.flowToken };
  }
  if (!insideServiceWindow(input.event.sentAt, input.now)) {
    const template = await loadTemplate(tx, input.tenantId);
    if (!template) {
      await remember(tx, input.tenantId, dedupeKey, {});
      return { action: "suppressed_outside_window" };
    }
    const optIn = await tx.yolaAutomationEvent.findUnique({
      where: { tenantId_dedupeKey: { tenantId: input.tenantId, dedupeKey: `optin:${input.event.fromWaId}` } },
    });
    if (!optIn) {
      await remember(tx, input.tenantId, dedupeKey, {});
      return { action: "suppressed_no_opt_in" };
    }
    const since = new Date(input.now.getTime() - 24 * 60 * 60 * 1000);
    const recent = await tx.yolaOutboundMessage.findFirst({
      where: { tenantId: input.tenantId, waId: input.event.fromWaId, kind: "marketing_template", createdAt: { gte: since } },
    });
    if (recent) {
      await remember(tx, input.tenantId, dedupeKey, {});
      return { action: "frequency_limited" };
    }
    const token = await queueInvite(tx, {
      tenantId: input.tenantId,
      customerId: customer.id,
      waId: input.event.fromWaId,
      phoneNumberId: input.phoneNumberId,
      source: "marketing_template",
      kind: "marketing_template",
      now: input.now,
    });
    await remember(tx, input.tenantId, dedupeKey, { flowToken: token });
    return { action: "template_held", flowToken: token };
  }
  const source = sourceFromReferral(input.event.referral, "yola");
  const attributed = referralMatchesCampaign(input.event.referral) ? source : source === "ctwa" ? "direct" : source;
  const token = await queueInvite(tx, {
    tenantId: input.tenantId,
    customerId: customer.id,
    waId: input.event.fromWaId,
    phoneNumberId: input.phoneNumberId,
    source: attributed,
    kind: "flow_invite",
    now: input.now,
  });
  await remember(tx, input.tenantId, dedupeKey, { flowToken: token });
  return { action: "flow_invited", flowToken: token };
}

async function handleSubmission(
  tx: Tx,
  input: { tenantId: string; phoneNumberId: string; event: InboundEvent; now: Date },
  dedupeKey: string,
): Promise<EngineResult> {
  const parsed = parseFlowForm(input.event.responseJson);
  if (!parsed.form) {
    await remember(tx, input.tenantId, dedupeKey, {});
    return { action: "rejected", errors: parsed.errors, reason: parsed.errors[0] };
  }
  const existing = await tx.yolaOrder.findUnique({
    where: { tenantId_flowToken: { tenantId: input.tenantId, flowToken: parsed.form.flowToken } },
  });
  if (existing) {
    await remember(tx, input.tenantId, dedupeKey, { flowToken: parsed.form.flowToken, orderId: existing.humanId });
    return { action: "duplicate", duplicate: true, orderId: existing.humanId, flowToken: parsed.form.flowToken };
  }
  const session = await tx.yolaFlowSession.findUnique({
    where: { tenantId_flowToken: { tenantId: input.tenantId, flowToken: parsed.form.flowToken } },
  });
  if (!session || session.status !== "invited" || session.waId !== input.event.fromWaId) {
    await remember(tx, input.tenantId, dedupeKey, { flowToken: parsed.form.flowToken });
    return { action: "rejected", reason: "unknown_flow_token" };
  }
  if (!presaleStillOpen(input.now)) {
    await remember(tx, input.tenantId, dedupeKey, { flowToken: parsed.form.flowToken });
    return { action: "rejected", reason: "presale_closed" };
  }
  if (!visitChoiceOk(parsed.form.visitDate, parsed.form.visitTime)) {
    await remember(tx, input.tenantId, dedupeKey, { flowToken: parsed.form.flowToken });
    return { action: "rejected", reason: "visit_time" };
  }
  const e164 = toE164(parsed.form.buyerPhone);
  if (!e164) {
    await remember(tx, input.tenantId, dedupeKey, { flowToken: parsed.form.flowToken });
    return { action: "rejected", reason: "buyer_phone" };
  }
  const customer = await touchCustomer(tx, input.tenantId, input.event.fromWaId, input.now);
  await tx.yolaCustomer.update({
    where: { id: customer.id },
    data: { name: parsed.form.buyerName, phoneE164: e164 },
  });
  const humanId = await nextHumanId(tx, input.tenantId, input.now);
  const mismatch = phonesDiffer(input.event.fromWaId, e164);
  const order = await tx.yolaOrder.create({
    data: {
      tenantId: input.tenantId,
      humanId,
      customerId: customer.id,
      sessionId: session.id,
      waId: input.event.fromWaId,
      wamid: input.event.wamid,
      flowToken: parsed.form.flowToken,
      buyerName: parsed.form.buyerName,
      buyerPhoneE164: e164,
      phoneMismatch: mismatch,
      visitDate: parsed.form.visitDate,
      visitTime: parsed.form.visitTime,
      amountIdr: OFFER.amountIdr,
      currency: OFFER.currency,
      status: "PENDING_PAYMENT",
      origin: parsed.form.buyerName === "TEST SYNTHETIC" ? "synthetic" : "pilot",
      preferenceNote: OFFER.preferenceNote,
    },
  });
  await tx.yolaFlowSession.update({ where: { id: session.id }, data: { status: "completed" } });
  const checkoutToken = newCheckoutToken();
  await tx.yolaPaymentSession.create({
    data: {
      tenantId: input.tenantId,
      orderId: order.id,
      provider: "sandbox",
      mode: "sandbox",
      status: "PENDING",
      amountIdr: OFFER.amountIdr,
      currency: OFFER.currency,
      nonceHash: hashSecret(checkoutToken),
      expiresAt: new Date(input.now.getTime() + 24 * 60 * 60 * 1000),
    },
  });
  await holdOutbound(tx, {
    tenantId: input.tenantId,
    waId: input.event.fromWaId,
    kind: "payment_link",
    body: paymentLinkMessage({ orderId: humanId, url: demoCheckoutUrl(checkoutToken) }),
    payload: { held: true, orderId: humanId, mode: "sandbox" },
  });
  await remember(tx, input.tenantId, dedupeKey, { flowToken: parsed.form.flowToken, orderId: humanId });
  return { action: "order_created", orderId: humanId, flowToken: parsed.form.flowToken, paymentNonce: checkoutToken };
}

export async function applyPaymentEvent(input: {
  tenantId: string;
  humanId: string;
  eventId: string;
  provider: "sandbox" | "xendit";
  outcome: PaymentOutcome;
  amountIdr: number;
  currency: string;
  nonce?: string;
  now: Date;
}): Promise<EngineResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.yolaOrder.findUnique({
      where: { tenantId_humanId: { tenantId: input.tenantId, humanId: input.humanId } },
      include: { payments: true, tickets: true },
    });
    if (!order) return { action: "unmatched" };
    if (input.provider === "sandbox") {
      const session = order.payments[0];
      if (!input.nonce || !session || hashSecret(input.nonce) !== session.nonceHash) {
        return { action: "rejected", reason: "nonce", orderId: order.humanId };
      }
    }
    const claimed = await claim(tx, input.tenantId, `pay:${input.eventId}`, "payment_event");
    if (!claimed) return { action: "duplicate", duplicate: true, orderId: order.humanId };
    await tx.yolaPaymentEvent.create({
      data: {
        tenantId: input.tenantId,
        orderId: order.id,
        eventId: input.eventId,
        provider: input.provider,
        outcome: input.outcome,
        amountIdr: input.amountIdr,
        currency: input.currency,
        live: false,
      },
    });
    if (order.status === "TICKET_ISSUED" || order.status === "PAID") {
      return { action: "duplicate", duplicate: true, orderId: order.humanId };
    }
    if (order.status !== "PENDING_PAYMENT") {
      return { action: "rejected", reason: "terminal", orderId: order.humanId };
    }
    if (!amountAccepted(input.amountIdr, input.currency)) {
      return { action: "rejected", reason: "amount", orderId: order.humanId };
    }
    if (input.outcome !== "PAID") {
      const status = input.outcome === "EXPIRED" ? "EXPIRED" : "PAYMENT_FAILED";
      await tx.yolaOrder.update({ where: { id: order.id }, data: { status } });
      await tx.yolaPaymentSession.updateMany({
        where: { orderId: order.id },
        data: { status: input.outcome },
      });
      return { action: "payment_updated", orderId: order.humanId };
    }
    const mode = ticketLiveIssuanceEnabled() ? "LIVE" : "TEST";
    const token = randomBytes(18).toString("base64url");
    await tx.yolaOrder.update({ where: { id: order.id }, data: { status: "TICKET_ISSUED" } });
    await tx.yolaPaymentSession.updateMany({ where: { orderId: order.id }, data: { status: "PAID" } });
    await tx.yolaTicket.create({
      data: {
        tenantId: input.tenantId,
        orderId: order.id,
        publicId: `TKT-${order.humanId}`,
        tokenHash: hashSecret(token),
        remaining: PRODUCT.entries,
        issuanceMode: mode,
        validFrom: PRODUCT.visitsBegin,
        validUntil: PRODUCT.lastValidity,
      },
    });
    await holdOutbound(tx, {
      tenantId: input.tenantId,
      waId: order.waId,
      kind: "ticket",
      body: mode === "TEST" ? `${DEMO_TICKET_PHRASE} ${order.humanId}` : order.humanId,
      payload: { held: true, orderId: order.humanId, issuanceMode: mode },
    });
    return { action: "ticket_issued", orderId: order.humanId, ticketToken: token };
  });
}

export async function redeemTicket(input: {
  tenantId: string;
  token: string;
  key: string;
  now: Date;
  visitDate: string;
}): Promise<EngineResult> {
  const tokenHash = hashSecret(input.token);
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.yolaTicket.findUnique({
      where: { tokenHash },
      include: { order: true },
    });
    if (!ticket || ticket.tenantId !== input.tenantId) return { action: "rejected", reason: "unknown_ticket" };
    if (ticket.order.status !== "TICKET_ISSUED" && ticket.order.status !== "PAID") {
      return { action: "rejected", reason: "unpaid_order" };
    }
    const day = jakartaDay(input.now);
    if (day < ticket.validFrom || day > ticket.validUntil) return { action: "rejected", reason: "expired_ticket" };
    if (!input.visitDate) return { action: "rejected", reason: "missing_scheduled_visit" };
    if (input.visitDate !== ticket.order.visitDate) return { action: "rejected", reason: "wrong_visit_date" };
    const prior = await tx.yolaRedemption.findUnique({
      where: { ticketId_idempotencyKey: { ticketId: ticket.id, idempotencyKey: input.key } },
    });
    if (prior) return { action: "duplicate", duplicate: true, remaining: prior.remainingAfter, orderId: ticket.order.humanId };
    const updated = await tx.$queryRaw<Array<{ remaining: number }>>`
      UPDATE "YolaTicket" SET "remaining" = "remaining" - 1
      WHERE "id" = ${ticket.id} AND "remaining" > 0
      RETURNING "remaining"
    `;
    if (!updated[0]) return { action: "rejected", reason: "no_entries_left", remaining: 0 };
    await tx.yolaRedemption.create({
      data: {
        tenantId: input.tenantId,
        ticketId: ticket.id,
        idempotencyKey: input.key,
        result: ticket.issuanceMode === "TEST" ? "ACCEPTED_TEST" : "ACCEPTED",
        remainingAfter: updated[0].remaining,
      },
    });
    return { action: "redeemed", remaining: updated[0].remaining, orderId: ticket.order.humanId };
  });
}

export async function listYolaDesk(tenantId: string) {
  const [orders, invites, heldOutbound, quarantinedOutbound, template] = await Promise.all([
    prisma.yolaOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        humanId: true,
        status: true,
        buyerName: true,
        visitDate: true,
        visitTime: true,
        amountIdr: true,
        currency: true,
        phoneMismatch: true,
        origin: true,
        preferenceNote: true,
        createdAt: true,
        payments: { select: { provider: true, mode: true, status: true } },
        tickets: { select: { publicId: true, remaining: true, issuanceMode: true, validFrom: true, validUntil: true } },
      },
    }),
    prisma.yolaFlowSession.count({ where: { tenantId, status: "invited" } }),
    prisma.yolaOutboundMessage.count({ where: { tenantId, status: "held" } }),
    prisma.yolaOutboundMessage.count({ where: { tenantId, status: "quarantine" } }),
    prisma.yolaAutomationEvent.findUnique({
      where: { tenantId_dedupeKey: { tenantId, dedupeKey: "template:verified" } },
    }),
  ]);
  let templateStatus: "APPROVED" | "UNVERIFIED" = "UNVERIFIED";
  let templateName: string | null = null;
  let flowId: string | null = null;
  if (template) {
    try {
      const parsed = JSON.parse(template.detail) as VerifiedTemplate;
      if (parsed.status === "APPROVED" && parsed.source === "meta_api") {
        templateStatus = "APPROVED";
        templateName = parsed.name;
        flowId = parsed.flowId;
      }
    } catch {
      templateStatus = "UNVERIFIED";
    }
  }
  return {
    invites,
    heldOutbound,
    quarantinedOutbound,
    templateStatus,
    templateName,
    flowId,
    sendEnabled: flowSendEnabled(),
    livePayments: false,
    ticketMode: ticketLiveIssuanceEnabled() ? "LIVE" : "TEST",
    orders,
  };
}

export async function saveVerifiedTemplate(tenantId: string, template: VerifiedTemplate) {
  const detail = JSON.stringify(template);
  await prisma.yolaAutomationEvent.upsert({
    where: { tenantId_dedupeKey: { tenantId, dedupeKey: "template:verified" } },
    create: { tenantId, kind: "template_snapshot", dedupeKey: "template:verified", detail },
    update: { kind: "template_snapshot", detail },
  });
}

export async function routeYolaFromWhatsApp(input: { trusted: boolean; body: unknown; now?: Date; fetchImpl?: typeof fetch }) {
  if (!input.trusted) return { ran: false as const, reason: "signature_required" };
  const phoneNumberId = yolaPhoneNumberId();
  if (!phoneNumberId) return { ran: false as const, reason: "phone_number_unconfigured" };
  const events = readInbound(input.body).filter((event) => event.phoneNumberId === phoneNumberId);
  if (!events.length) return { ran: false as const, reason: "not_yola_phone" };
  const tenantId = await resolveYolaTenantId(phoneNumberId);
  if (!tenantId) return { ran: false as const, reason: "phone_not_linked" };
  const now = input.now ?? new Date();
  const results = [];
  for (const event of events) {
    const result = await handleYolaEvent({ tenantId, phoneNumberId, event, now, fetchImpl: input.fetchImpl });
    results.push({
      action: result.action,
      reason: result.reason,
      orderId: result.orderId,
      duplicate: result.duplicate === true,
    });
  }
  return { ran: true as const, results };
}

export async function recordMarketingOptIn(tenantId: string, waId: string, source: string) {
  await prisma.yolaAutomationEvent.upsert({
    where: { tenantId_dedupeKey: { tenantId, dedupeKey: `optin:${waId}` } },
    create: { tenantId, kind: "marketing_optin", dedupeKey: `optin:${waId}`, detail: source },
    update: { detail: source },
  });
}
