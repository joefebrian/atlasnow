import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  customerReference,
  parseWhatsAppOrders,
  type CommerceOrderLineView,
  type CommerceOrderView,
  type ParsedOrderItem,
} from "@/lib/commerce/order-parse";

export const ORDER_STATUS_PENDING_PAYMENT = "PENDING_PAYMENT";
export const PAYMENT_STATUS_NOT_INITIATED = "NOT_INITIATED";

export type OrderValidation = "MATCHED" | "UNKNOWN_SKU" | "PRICE_MISMATCH" | "REVIEW";

export type MasterSku = {
  sku: string;
  productId: string;
  variantId: string | null;
  unitPriceIdr: number;
  sellable: boolean;
  outletIds: string[];
};

export type JudgedLine = {
  sku: string;
  quantity: number;
  currency: string;
  itemPriceEstimate: number | null;
  masterUnitPriceIdr: number | null;
  productId: string | null;
  variantId: string | null;
  validation: OrderValidation;
  outletIds: string[];
};

export type JudgedOrder = {
  validation: OrderValidation;
  lines: JudgedLine[];
  estimatedTotal: number | null;
  masterTotalIdr: number | null;
  currency: string;
  locationId: string | null;
};

export type CaptureSummary = {
  received: number;
  created: number;
  duplicate: number;
  unmatched: number;
};

export type { CommerceOrderLineView, CommerceOrderView };

export function orderCaptureEnabled(): boolean {
  return process.env.COMMERCE_ORDER_CAPTURE_ENABLED === "true";
}

/**
 * Inbox still accepts a body when the app secret is empty.
 * Order capture does not. A bad signature is rejected before ingest.
 */
export function whatsappPostPlan(input: {
  appSecret: string;
  signatureValid: boolean;
  captureEnabled: boolean;
}): { ingest: true; capture: boolean } | { status: 401 } {
  const secret = input.appSecret.trim();
  if (secret && !input.signatureValid) return { status: 401 };
  return {
    ingest: true,
    capture: Boolean(secret) && input.signatureValid && input.captureEnabled,
  };
}

function safeMul(left: number, right: number): number | null {
  const product = left * right;
  return Number.isSafeInteger(product) ? product : null;
}

export function matchMaster(sku: string, masters: MasterSku[]): MasterSku | "ambiguous" | null {
  const exact = masters.filter((row) => row.sku === sku);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return "ambiguous";
  const folded = masters.filter((row) => row.sku.toLowerCase() === sku.toLowerCase());
  if (folded.length === 1) return folded[0];
  if (folded.length > 1) return "ambiguous";
  return null;
}

function lineValidation(item: ParsedOrderItem, master: MasterSku | "ambiguous" | null): OrderValidation {
  if (master == null) return "UNKNOWN_SKU";
  if (master === "ambiguous") return "REVIEW";
  const priceMatches = item.currency === "IDR" && item.itemPrice === master.unitPriceIdr;
  if (!priceMatches) return "PRICE_MISMATCH";
  if (!master.sellable || item.quantity == null) return "REVIEW";
  return "MATCHED";
}

function rollup(lines: OrderValidation[]): OrderValidation {
  if (!lines.length) return "REVIEW";
  if (lines.some((validation) => validation === "UNKNOWN_SKU")) return "UNKNOWN_SKU";
  if (lines.some((validation) => validation === "PRICE_MISMATCH")) return "PRICE_MISMATCH";
  if (lines.some((validation) => validation !== "MATCHED")) return "REVIEW";
  return "MATCHED";
}

/**
 * Compares each WhatsApp line with the product master.
 * The WhatsApp sum is stored only as an estimate. It is not the master total.
 */
export function judgeOrder(items: ParsedOrderItem[], masters: MasterSku[]): JudgedOrder {
  const lines: JudgedLine[] = items.map((item) => {
    const master = matchMaster(item.sku, masters);
    const known = master && master !== "ambiguous" ? master : null;
    const validation = lineValidation(item, master);
    return {
      sku: item.sku,
      quantity: item.quantity ?? 0,
      currency: item.currency,
      itemPriceEstimate: item.itemPrice,
      masterUnitPriceIdr: known ? known.unitPriceIdr : null,
      productId: known ? known.productId : null,
      variantId: known ? known.variantId : null,
      validation,
      outletIds: known ? known.outletIds : [],
    };
  });
  const validation = rollup(lines.map((line) => line.validation));
  const currencies = [...new Set(lines.map((line) => line.currency).filter(Boolean))];
  const estimates = lines.map((line) => {
    if (line.itemPriceEstimate == null || line.quantity < 1) return null;
    return safeMul(line.itemPriceEstimate, line.quantity);
  });
  const estimatedTotal =
    lines.length > 0 && estimates.every((value) => value != null)
      ? estimates.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : null;
  let masterTotalIdr: number | null = null;
  if (validation === "MATCHED") {
    const parts = lines.map((line) =>
      line.masterUnitPriceIdr == null ? null : safeMul(line.masterUnitPriceIdr, line.quantity)
    );
    if (parts.every((value) => value != null)) {
      masterTotalIdr = parts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    }
  }
  let locationId: string | null = null;
  if (validation === "MATCHED" && lines.length) {
    let shared = new Set(lines[0].outletIds);
    for (const line of lines.slice(1)) {
      shared = new Set([...shared].filter((id) => line.outletIds.includes(id)));
    }
    if (shared.size === 1) locationId = [...shared][0];
  }
  return {
    validation,
    lines,
    estimatedTotal: estimatedTotal != null && Number.isSafeInteger(estimatedTotal) ? estimatedTotal : null,
    masterTotalIdr,
    currency: currencies.length === 1 ? currencies[0] : currencies.length > 1 ? "MIXED" : "",
    locationId,
  };
}

function isPrismaP2002(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: unknown }).code === "P2002");
}

function p2002Target(err: unknown): string {
  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  if (Array.isArray(target)) return target.join(",");
  return typeof target === "string" ? target : "";
}

function newReference(): string {
  return `CO-${randomBytes(4).toString("hex").toUpperCase()}`;
}

async function loadMasters(tenantId: string, skus: string[]): Promise<MasterSku[]> {
  const wanted = [...new Set(skus.map((sku) => sku.trim()).filter(Boolean))];
  if (!wanted.length) return [];
  const skuMatch = wanted.map((sku) => ({ sku: { equals: sku, mode: "insensitive" as const } }));
  const [products, variants] = await Promise.all([
    prisma.commerceProduct.findMany({
      where: { tenantId, OR: skuMatch },
      select: {
        id: true,
        sku: true,
        unitPriceIdr: true,
        status: true,
        availability: true,
        outlets: { where: { availability: "AVAILABLE" }, select: { locationId: true } },
      },
    }),
    prisma.commerceVariant.findMany({
      where: { tenantId, OR: skuMatch },
      select: {
        id: true,
        sku: true,
        unitPriceIdr: true,
        status: true,
        product: {
          select: {
            id: true,
            status: true,
            availability: true,
            unitPriceIdr: true,
            outlets: { where: { availability: "AVAILABLE" }, select: { locationId: true } },
          },
        },
      },
    }),
  ]);
  const masters: MasterSku[] = products.map((product) => ({
    sku: product.sku,
    productId: product.id,
    variantId: null,
    unitPriceIdr: product.unitPriceIdr,
    sellable: product.status === "ACTIVE" && product.availability === "AVAILABLE",
    outletIds: product.outlets.map((outlet) => outlet.locationId),
  }));
  for (const variant of variants) {
    masters.push({
      sku: variant.sku,
      productId: variant.product.id,
      variantId: variant.id,
      unitPriceIdr: variant.unitPriceIdr ?? variant.product.unitPriceIdr,
      sellable:
        variant.status === "ACTIVE" &&
        variant.product.status === "ACTIVE" &&
        variant.product.availability === "AVAILABLE",
      outletIds: variant.product.outlets.map((outlet) => outlet.locationId),
    });
  }
  return masters;
}

async function resolveTenant(order: { wabaId: string; phoneNumberId: string; catalogId: string }): Promise<string | null> {
  if (!order.wabaId || !order.phoneNumberId || !order.catalogId) return null;
  const rows = await prisma.commerceConnection.findMany({
    where: {
      wabaId: order.wabaId,
      phoneNumberId: order.phoneNumberId,
      catalogId: order.catalogId,
      disconnectedAt: null,
    },
    select: { tenantId: true },
  });
  if (rows.length !== 1) return null;
  return rows[0].tenantId;
}

function logCapture(fields: { outcome: string; tenantId?: string; validation?: string; messageId?: string }) {
  console.info(
    JSON.stringify({
      source: "commerce.order",
      outcome: fields.outcome,
      tenantId: fields.tenantId ?? "",
      validation: fields.validation ?? "",
      messageId: fields.messageId ?? "",
    })
  );
}

async function createOrder(
  tenantId: string,
  order: ReturnType<typeof parseWhatsAppOrders>[number],
  judged: JudgedOrder
): Promise<"created" | "duplicate"> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await prisma.commerceOrder.create({
        data: {
          tenantId,
          locationId: judged.locationId,
          reference: newReference(),
          status: ORDER_STATUS_PENDING_PAYMENT,
          validation: judged.validation,
          paymentStatus: PAYMENT_STATUS_NOT_INITIATED,
          source: "WHATSAPP_ORDER",
          wabaId: order.wabaId,
          phoneNumberId: order.phoneNumberId,
          catalogId: order.catalogId,
          waMessageId: order.messageId,
          customerWaId: order.customerWaId,
          customerRef: customerReference(order.customerWaId),
          currency: judged.currency,
          estimatedTotal: judged.estimatedTotal,
          masterTotalIdr: judged.masterTotalIdr,
          receivedAt: order.receivedAt,
          lines: {
            create: judged.lines.map((line) => ({
              tenantId,
              sku: line.sku,
              quantity: line.quantity,
              currency: line.currency,
              itemPriceEstimate: line.itemPriceEstimate,
              masterUnitPriceIdr: line.masterUnitPriceIdr,
              productId: line.productId,
              variantId: line.variantId,
              validation: line.validation,
            })),
          },
        },
      });
      return "created";
    } catch (err) {
      if (!isPrismaP2002(err)) throw err;
      const target = p2002Target(err);
      if (target.includes("waMessageId")) return "duplicate";
      if (!target.includes("reference")) throw err;
    }
  }
  throw new Error("order reference collision");
}

/**
 * Persists catalog orders for the connected merchant.
 * The caller must already have verified the webhook signature.
 * Returns counts only. Does not log the sender.
 */
export async function captureWhatsAppOrders(body: unknown): Promise<CaptureSummary> {
  const summary: CaptureSummary = { received: 0, created: 0, duplicate: 0, unmatched: 0 };
  if (!orderCaptureEnabled()) return summary;
  const orders = parseWhatsAppOrders(body);
  summary.received = orders.length;
  for (const order of orders) {
    if (!order.messageId || !order.customerWaId) {
      summary.unmatched += 1;
      logCapture({ outcome: "unmatched", messageId: order.messageId });
      continue;
    }
    const existing = await prisma.commerceOrder.findUnique({
      where: { waMessageId: order.messageId },
      select: { id: true },
    });
    if (existing) {
      summary.duplicate += 1;
      logCapture({ outcome: "duplicate", messageId: order.messageId });
      continue;
    }
    const tenantId = await resolveTenant(order);
    if (!tenantId) {
      summary.unmatched += 1;
      logCapture({ outcome: "unmatched", messageId: order.messageId });
      continue;
    }
    const masters = await loadMasters(
      tenantId,
      order.items.map((item) => item.sku)
    );
    const judged = judgeOrder(order.items, masters);
    const outcome = await createOrder(tenantId, order, judged);
    summary[outcome] += 1;
    logCapture({ outcome, tenantId, validation: judged.validation, messageId: order.messageId });
  }
  return summary;
}

export async function listCommerceOrders(tenantId: string): Promise<CommerceOrderView[]> {
  if (!tenantId) throw new Error("tenant required");
  if (!orderCaptureEnabled()) return [];
  const rows = await prisma.commerceOrder.findMany({
    where: { tenantId },
    orderBy: { receivedAt: "desc" },
    take: 50,
    select: {
      id: true,
      reference: true,
      receivedAt: true,
      catalogId: true,
      customerRef: true,
      currency: true,
      estimatedTotal: true,
      validation: true,
      paymentStatus: true,
      status: true,
      location: { select: { name: true } },
      lines: {
        orderBy: { id: "asc" },
        select: {
          sku: true,
          quantity: true,
          currency: true,
          itemPriceEstimate: true,
          validation: true,
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    receivedAt: row.receivedAt.toISOString(),
    outletName: row.location?.name ?? null,
    customerRef: row.customerRef,
    catalogId: row.catalogId,
    currency: row.currency,
    estimatedTotal: row.estimatedTotal,
    validation: row.validation as OrderValidation,
    paymentStatus: row.paymentStatus,
    status: row.status,
    lines: row.lines.map((line) => ({
      sku: line.sku,
      quantity: line.quantity,
      currency: line.currency,
      itemPriceEstimate: line.itemPriceEstimate,
      validation: line.validation as OrderValidation,
    })),
  }));
}
