import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sessionCanReadYola } from "@/lib/yola/access";
import { applyPaymentEvent } from "@/lib/yola/engine";
import type { PaymentOutcome } from "@/lib/yola/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OUTCOMES = new Set<PaymentOutcome>(["PAID", "EXPIRED", "FAILED"]);

/** Authenticated sandbox confirmation. The nonce never marks a live charge. */
export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const row = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const humanId = typeof row.orderId === "string" ? row.orderId : "";
  const nonce = typeof row.nonce === "string" ? row.nonce : "";
  const outcome = typeof row.outcome === "string" ? row.outcome : "";
  if (!humanId || !nonce || !OUTCOMES.has(outcome as PaymentOutcome)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const tenantId = session.isAgencyStaff && typeof row.tenantId === "string" ? row.tenantId : session.tenantId;
  const order = await prisma.yolaOrder.findFirst({
    where: { humanId, tenantId },
    select: { tenantId: true, humanId: true },
  });
  if (!order || !(await sessionCanReadYola(session, order.tenantId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await applyPaymentEvent({
    tenantId: order.tenantId,
    humanId: order.humanId,
    eventId: `sandbox:${order.humanId}:${outcome}:${nonce}`,
    provider: "sandbox",
    outcome: outcome as PaymentOutcome,
    amountIdr: 499000,
    currency: "IDR",
    nonce,
    now: new Date(),
  });
  return NextResponse.json({ ok: result.action !== "rejected" && result.action !== "unmatched", action: result.action, orderId: result.orderId, mode: "sandbox" });
}
