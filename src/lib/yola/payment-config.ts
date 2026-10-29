import { prisma } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth";
import { sessionCanConfigureYolaPayment } from "@/lib/yola/access";
import { resolvePaymentPlan, savablePaymentMode, validateMerchantPaymentUrl } from "@/lib/yola/merchant-link";

export async function loadYolaPaymentConfig(tenantId: string) {
  const row = await prisma.yolaPaymentConfig.findUnique({
    where: { tenantId },
    select: { mode: true, merchantUrl: true },
  });
  const plan = resolvePaymentPlan(row);
  return {
    mode: row?.mode === "MERCHANT_EXTERNAL_LINK" ? "MERCHANT_EXTERNAL_LINK" : "DEMO_CHECKOUT",
    merchantUrl: plan.kind === "merchant" ? plan.url : "",
    plan,
  };
}

export async function saveYolaPaymentConfig(input: {
  session: SessionPayload;
  tenantId: string;
  mode: string;
  merchantUrl: string;
}) {
  if (!(await sessionCanConfigureYolaPayment(input.session, input.tenantId))) {
    return { ok: false as const, reason: "forbidden" };
  }
  if (!savablePaymentMode(input.mode)) return { ok: false as const, reason: "mode" };
  let merchantUrl = "";
  let host = "";
  if (input.mode === "MERCHANT_EXTERNAL_LINK") {
    const checked = validateMerchantPaymentUrl(input.merchantUrl);
    if (!checked.ok) return { ok: false as const, reason: checked.reason };
    merchantUrl = checked.url;
    host = new URL(checked.url).hostname;
  }
  await prisma.yolaPaymentConfig.upsert({
    where: { tenantId: input.tenantId },
    create: { tenantId: input.tenantId, mode: input.mode, merchantUrl },
    update: { mode: input.mode, merchantUrl },
  });
  await prisma.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.session.userId,
      action: "yola.payment_config",
      objectType: "YolaPaymentConfig",
      objectId: input.tenantId,
      metaJson: JSON.stringify({ mode: input.mode, host }),
    },
  });
  return { ok: true as const, mode: input.mode, host };
}
