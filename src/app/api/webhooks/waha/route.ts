import { NextResponse } from "next/server";
import { ingestWahaPayload } from "@/lib/conversations/ingest";
import { getWahaWebhookKey } from "@/lib/conversations/waha-config";
import { apiKeyMatches } from "@/lib/conversations/webhook-auth";

export async function POST(request: Request) {
  const expected = await getWahaWebhookKey();
  const provided = request.headers.get("x-api-key");
  if (!apiKeyMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const result = await ingestWahaPayload(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if ("ignored" in result) {
      if (result.ignored === "kill_switch" || result.ignored === true) {
        return NextResponse.json({ ignored: true });
      }
      return NextResponse.json({ ignored: result.ignored });
    }
    if (result.duplicate) {
      return NextResponse.json({ duplicate: true, conversationId: result.conversationId });
    }
    return NextResponse.json({ ok: true, conversationId: result.conversationId });
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
