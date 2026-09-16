import { NextResponse } from "next/server";
import { resolvedMetaApp } from "@/lib/integrations/service";
import { ingestMetaPayload } from "@/lib/conversations/meta-ingest";
import { cloudSignatureValid } from "@/lib/conversations/cloud-signature";
import { logAppError } from "@/lib/error-log";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const meta = await resolvedMetaApp();
  if (mode === "subscribe" && token && token === meta.verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const meta = await resolvedMetaApp();
  const sig = request.headers.get("x-hub-signature-256");
  console.info(
    "[meta webhook] POST",
    JSON.stringify({ bytes: raw.length, hasSig: Boolean(sig), hasSecret: Boolean(meta.appSecret) })
  );
  if (meta.appSecret && !cloudSignatureValid(raw, sig, meta.appSecret)) {
    console.warn("[meta webhook] invalid_signature");
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const { results } = await ingestMetaPayload(body);
    console.info("[meta webhook]", JSON.stringify(results));
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      await logAppError({
        source: "Meta webhook",
        title: "Messenger/Instagram event failed",
        detail: failed.error,
      });
    }
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    await logAppError({
      source: "Meta webhook",
      title: "Messenger webhook crashed",
      detail: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "ingest_failed" }, { status: 500 });
  }
}
