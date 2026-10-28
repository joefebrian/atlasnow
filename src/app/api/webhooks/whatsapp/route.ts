import { NextResponse } from "next/server";
import { captureWhatsAppOrders, orderCaptureEnabled, whatsappPostPlan } from "@/lib/commerce/order-capture";
import { ingestCloudWhatsAppPayload } from "@/lib/conversations/cloud-ingest";
import { customerInboundBody } from "@/lib/conversations/customer-inbound";
import { cloudSignatureValid } from "@/lib/conversations/cloud-signature";
import { cloudWebhookSecrets } from "@/lib/conversations/cloud-verify";
import { logAppError } from "@/lib/error-log";
import { routeWorkspaceAutomation } from "@/lib/commerce-automation/engine";
import { routeYolaFromWhatsApp } from "@/lib/yola/engine";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const secrets = await cloudWebhookSecrets();
  if (mode === "subscribe" && token && token === secrets.verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const secrets = await cloudWebhookSecrets();
  const sig = request.headers.get("x-hub-signature-256");
  const plan = whatsappPostPlan({
    appSecret: secrets.appSecret,
    signatureValid: cloudSignatureValid(raw, sig, secrets.appSecret),
    captureEnabled: orderCaptureEnabled(),
  });
  if ("status" in plan) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  let results;
  let automationBody: unknown = body;
  try {
    const ingested = await ingestCloudWhatsAppPayload(body);
    results = ingested.results;
    automationBody = customerInboundBody(body, ingested.suppressWamids);
  } catch (e) {
    await logAppError({
      source: "WhatsApp Cloud webhook",
      title: "HQ Cloud API ingest failed",
      detail: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "ingest_failed" }, { status: 500 });
  }
  const yolaTrusted = Boolean(secrets.appSecret.trim());
  let yola: { ran: boolean; reason?: string } = { ran: false, reason: yolaTrusted ? "not_run" : "signature_required" };
  let automation: { ran: boolean; handled: number; reason?: string } = {
    ran: false,
    handled: 0,
    reason: yolaTrusted ? "not_run" : "signature_required",
  };
  if (yolaTrusted) {
    try {
      const routed = await routeYolaFromWhatsApp({ trusted: true, body: automationBody });
      yola = routed.ran ? { ran: true } : { ran: false, reason: routed.reason };
    } catch (e) {
      await logAppError({
        source: "WhatsApp Cloud webhook",
        title: "YOLA routing failed",
        detail: e instanceof Error ? e.message : "yola_failed",
      });
      yola = { ran: false, reason: "yola_failed" };
    }
    try {
      automation = await routeWorkspaceAutomation({ trusted: true, body: automationBody });
    } catch (e) {
      await logAppError({
        source: "WhatsApp Cloud webhook",
        title: "Workspace automation failed",
        detail: e instanceof Error ? e.message : "automation_failed",
      });
      automation = { ran: false, handled: 0, reason: "automation_failed" };
    }
  }
  if (!plan.capture) {
    return NextResponse.json({ ok: true, results, yola, automation });
  }
  try {
    const orders = await captureWhatsAppOrders(body);
    return NextResponse.json({ ok: true, results, orders, yola, automation });
  } catch {
    await logAppError({
      source: "WhatsApp Cloud webhook",
      title: "Commerce order capture failed",
      detail: "capture_failed",
    });
    return NextResponse.json({ error: "capture_failed" }, { status: 500 });
  }
}
