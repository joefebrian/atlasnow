import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { PRODUCT } from "@/lib/yola/catalog";
import { pilotLinkSendEnabled, recipientAllowed, yolaAccessToken, yolaPhoneNumberId } from "@/lib/yola/config";
import { hashSecret } from "@/lib/yola/payments";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;

export function newCheckoutToken() {
  return randomBytes(32).toString("base64url");
}

export function demoCheckoutUrl(token: string) {
  const base = (process.env.APP_BASE_URL || "https://atlasnow.co").replace(/\/$/, "");
  return `${base}/pay/yola/${token}`;
}

export function paymentLinkMessage(input: { orderId: string; url: string }) {
  return [
    "Pesanan YOLA FUN kamu sudah kami terima!",
    "",
    `Order ID: ${input.orderId}`,
    "",
    "Produk: Presale Card 2x Entry",
    "",
    "Total: Rp499.000",
    "",
    "Status: Menunggu Pembayaran",
    "",
    "Silakan buka link berikut untuk mencoba simulasi pembayaran:",
    "",
    input.url,
    "",
    "Ini hanya TEST MODE. Tidak ada uang yang ditagihkan dan belum ada tiket yang diterbitkan.",
  ].join("\n");
}

export type CheckoutView = {
  state: "ready" | "expired" | "invalid" | "simulated";
  orderId: string;
  visitDate: string;
  visitTime: string;
  amountIdr: number;
  financialStatus: string;
  simulation: string;
  origin: string;
};

const emptyCheckout: CheckoutView = {
  state: "invalid",
  orderId: "",
  visitDate: "",
  visitTime: "",
  amountIdr: 0,
  financialStatus: "",
  simulation: "",
  origin: "",
};

export async function loadDemoCheckout(token: string, now = new Date()): Promise<CheckoutView> {
  const trimmed = token.trim();
  if (!TOKEN_PATTERN.test(trimmed)) return emptyCheckout;
  const session = await prisma.yolaPaymentSession.findFirst({
    where: { nonceHash: hashSecret(trimmed), mode: "sandbox", provider: "sandbox" },
    include: {
      order: {
        select: {
          humanId: true,
          visitDate: true,
          visitTime: true,
          amountIdr: true,
          currency: true,
          status: true,
          origin: true,
        },
      },
    },
  });
  if (!session || session.amountIdr !== PRODUCT.priceIdr || session.order.currency !== PRODUCT.currency) return emptyCheckout;
  const view: CheckoutView = {
    state: "ready",
    orderId: session.order.humanId,
    visitDate: session.order.visitDate,
    visitTime: session.order.visitTime,
    amountIdr: session.order.amountIdr,
    financialStatus: session.order.status,
    simulation: session.status,
    origin: session.order.origin,
  };
  if (session.expiresAt.getTime() <= now.getTime()) return { ...view, state: "expired" };
  if (session.status === "SIMULATED_PAID") return { ...view, state: "simulated" };
  return view;
}

/** Records a demo click. Does not settle the order, charge a card, or issue a ticket. */
export async function simulateDemoPayment(token: string, now = new Date()) {
  const trimmed = token.trim();
  if (!TOKEN_PATTERN.test(trimmed)) return { ok: false as const, reason: "invalid" };
  const session = await prisma.yolaPaymentSession.findFirst({
    where: { nonceHash: hashSecret(trimmed), mode: "sandbox", provider: "sandbox" },
    include: { order: { select: { id: true, tenantId: true, status: true, humanId: true } } },
  });
  if (!session || session.amountIdr !== PRODUCT.priceIdr || session.currency !== PRODUCT.currency) {
    return { ok: false as const, reason: "invalid" };
  }
  if (session.expiresAt.getTime() <= now.getTime()) return { ok: false as const, reason: "expired" };
  if (session.order.status !== "PENDING_PAYMENT") return { ok: false as const, reason: "not_payable" };
  if (session.status === "SIMULATED_PAID") return { ok: true as const, reason: "already_simulated", orderId: session.order.humanId };
  const updated = await prisma.yolaPaymentSession.updateMany({
    where: { id: session.id, status: "PENDING" },
    data: { status: "SIMULATED_PAID" },
  });
  if (updated.count === 0) return { ok: true as const, reason: "already_simulated", orderId: session.order.humanId };
  await prisma.yolaPaymentEvent.create({
    data: {
      tenantId: session.order.tenantId,
      orderId: session.order.id,
      eventId: `sim:${session.id}`,
      provider: "sandbox",
      outcome: "SIMULATED_PAID",
      amountIdr: PRODUCT.priceIdr,
      currency: PRODUCT.currency,
      live: false,
    },
  }).catch(async () => {
    const existing = await prisma.yolaPaymentEvent.findUnique({
      where: { tenantId_eventId: { tenantId: session.order.tenantId, eventId: `sim:${session.id}` } },
    });
    if (!existing) throw new Error("simulation_event_failed");
  });
  const order = await prisma.yolaOrder.findUnique({ where: { id: session.order.id }, select: { status: true } });
  const tickets = await prisma.yolaTicket.count({ where: { orderId: session.order.id } });
  return {
    ok: true as const,
    reason: "simulated",
    orderId: session.order.humanId,
    financialStatus: order?.status || "",
    tickets,
  };
}

async function claimSend(tenantId: string, orderId: string) {
  const id = randomBytes(16).toString("hex");
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "YolaAutomationEvent" ("id", "tenantId", "kind", "dedupeKey", "detail", "createdAt")
    VALUES (${id}, ${tenantId}, 'payment_link_send', ${`paylink:${orderId}`}, '', NOW())
    ON CONFLICT ("tenantId", "dedupeKey") DO NOTHING
    RETURNING "id"
  `;
  return rows.length > 0;
}

/**
 * Sends the held payment text only for an allowlisted pilot sender.
 * Synthetic rows and a closed service window stay held. No template fallback.
 */
export async function tryDeliverPaymentLink(input: {
  tenantId: string;
  waId: string;
  orderId: string;
  now: Date;
  fetchImpl?: typeof fetch;
}) {
  const row = await prisma.yolaOutboundMessage.findFirst({
    where: {
      tenantId: input.tenantId,
      kind: "payment_link",
      status: "held",
      payloadJson: { contains: `"orderId":"${input.orderId}"` },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { sent: false as const, reason: "no_held_link" };
  const order = await prisma.yolaOrder.findFirst({
    where: { tenantId: input.tenantId, humanId: input.orderId },
    select: { origin: true, buyerName: true, waId: true, status: true },
  });
  if (!order || order.waId !== input.waId) return { sent: false as const, reason: "sender_mismatch" };
  if (order.origin === "synthetic" || order.buyerName === "TEST SYNTHETIC") return { sent: false as const, reason: "synthetic_record" };
  if (!pilotLinkSendEnabled()) return { sent: false as const, reason: "pilot_send_disabled" };
  if (!recipientAllowed(input.waId)) return { sent: false as const, reason: "not_allowlisted" };
  const customer = await prisma.yolaCustomer.findFirst({
    where: { tenantId: input.tenantId, waId: input.waId },
    select: { lastInboundAt: true },
  });
  if (!customer?.lastInboundAt || input.now.getTime() - customer.lastInboundAt.getTime() > 24 * 60 * 60 * 1000) {
    return { sent: false as const, reason: "outside_window" };
  }
  const token = yolaAccessToken();
  const phoneNumberId = yolaPhoneNumberId();
  if (!token || !phoneNumberId) return { sent: false as const, reason: "send_unconfigured" };
  const claimed = await claimSend(input.tenantId, input.orderId);
  if (!claimed) return { sent: false as const, reason: "duplicate_send" };
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`https://graph.facebook.com/v25.0/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.waId.replace(/\D/g, ""),
        type: "text",
        text: { body: row.body },
      }),
    });
  } catch {
    await prisma.yolaOutboundMessage.update({ where: { id: row.id }, data: { deliveryStatus: "failed" } });
    return { sent: false as const, reason: "graph_rejected" };
  }
  if (!response.ok) {
    await prisma.yolaOutboundMessage.update({ where: { id: row.id }, data: { deliveryStatus: "failed" } });
    return { sent: false as const, reason: "graph_rejected" };
  }
  let providerWamid = "";
  try {
    const json = (await response.json()) as { messages?: Array<{ id?: string }> };
    providerWamid = json.messages?.[0]?.id || "";
  } catch {
    providerWamid = "";
  }
  await prisma.yolaOutboundMessage.update({
    where: { id: row.id },
    data: { status: "sent", providerWamid, deliveryStatus: "accepted" },
  });
  return { sent: true as const, reason: "sent" };
}
