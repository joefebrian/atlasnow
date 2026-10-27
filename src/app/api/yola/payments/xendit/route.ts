import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveYolaTenantId } from "@/lib/yola/access";
import { yolaPhoneNumberId } from "@/lib/yola/config";
import { applyPaymentEvent } from "@/lib/yola/engine";
import { parseXenditBody, tokenMatches, xenditChargeAllowed } from "@/lib/yola/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sandbox callback only. This route never creates a Xendit charge. */
export async function POST(request: Request) {
  const expected = (process.env.XENDIT_CALLBACK_TOKEN || "").trim();
  const presented = request.headers.get("x-callback-token") || "";
  if (!expected || !tokenMatches(presented, expected)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  if (xenditChargeAllowed()) {
    return NextResponse.json({ error: "live_charges_disabled" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = JSON.parse(await request.text()) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = parseXenditBody(body);
  if (!parsed || !parsed.outcome) return NextResponse.json({ ok: true, unmatched: true }, { status: 202 });
  const phoneNumberId = yolaPhoneNumberId();
  const tenantId = phoneNumberId ? await resolveYolaTenantId(phoneNumberId) : null;
  if (!tenantId) return NextResponse.json({ ok: false, reason: "phone_not_linked" }, { status: 409 });
  const order = await prisma.yolaOrder.findFirst({
    where: { tenantId, humanId: parsed.referenceId },
    select: { humanId: true },
  });
  if (!order) return NextResponse.json({ ok: true, unmatched: true }, { status: 202 });
  const result = await applyPaymentEvent({
    tenantId,
    humanId: order.humanId,
    eventId: parsed.eventId,
    provider: "xendit",
    outcome: parsed.outcome,
    amountIdr: parsed.amount,
    currency: parsed.currency,
    now: new Date(),
  });
  return NextResponse.json({ ok: true, action: result.action, orderId: result.orderId, mode: "sandbox" });
}
