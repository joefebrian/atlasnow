import { NextResponse } from "next/server";
import { captureWhatsAppOrders, orderCaptureEnabled, whatsappPostPlan } from "@/lib/commerce/order-capture";
import { ingestCloudWhatsAppPayload } from "@/lib/conversations/cloud-ingest";
import { cloudSignatureValid } from "@/lib/conversations/cloud-signature";
import { cloudWebhookSecrets } from "@/lib/conversations/cloud-verify";
import { logAppError } from "@/lib/error-log";

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
  try {
    results = (await ingestCloudWhatsAppPayload(body)).results;
  } catch (e) {
    await logAppError({
      source: "WhatsApp Cloud webhook",
      title: "HQ Cloud API ingest failed",
      detail: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "ingest_failed" }, { status: 500 });
  }
  if (!plan.capture) {
    return NextResponse.json({ ok: true, results });
  }
  try {
    const orders = await captureWhatsAppOrders(body);
    return NextResponse.json({ ok: true, results, orders });
  } catch {
    await logAppError({
      source: "WhatsApp Cloud webhook",
      title: "Commerce order capture failed",
      detail: "capture_failed",
    });
    return NextResponse.json({ error: "capture_failed" }, { status: 500 });
  }
}
