import { NextResponse } from "next/server";
import { ingestWahaPayload } from "@/lib/conversations/ingest";
import { getWahaWebhookKey } from "@/lib/conversations/waha-config";
import { apiKeyMatches } from "@/lib/conversations/webhook-auth";
import { logAppError } from "@/lib/error-log";

export async function POST(request: Request) {
  const expected = await getWahaWebhookKey();
  const provided = request.headers.get("x-api-key");
  if (!apiKeyMatches(provided, expected)) {
    await logAppError({
      source: "WAHA webhook",
      title: "WhatsApp message ditolak — API key tidak cocok.",
      detail: "AtlasNow Settings → API → WAHA API key harus sama dengan header X-Api-Key dari WAHA.",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    await logAppError({
      source: "WAHA webhook",
      title: "Pesan WhatsApp tidak bisa dibaca (JSON rusak).",
    });
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const result = await ingestWahaPayload(body);
    if (!result.ok) {
      await logAppError({
        source: "WAHA webhook",
        title: "Pesan WhatsApp gagal diproses.",
        detail: result.error,
      });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if ("ignored" in result) {
      if (result.ignored === "unmapped_session") {
        const session =
          body && typeof body === "object" && "session" in body
            ? String((body as { session?: unknown }).session || "")
            : "";
        await logAppError({
          source: "WAHA webhook",
          title: "Chat masuk tapi session belum ketemu lokasi.",
          detail: `Nama session WAHA: ${session || "(kosong)"}. Harus sama dengan atlas_location_id di Location 360.`,
        });
      }
      if (result.ignored === "kill_switch" || result.ignored === true) {
        return NextResponse.json({ ignored: true });
      }
      return NextResponse.json({ ignored: result.ignored });
    }
    if (result.duplicate) {
      return NextResponse.json({ duplicate: true, conversationId: result.conversationId });
    }
    return NextResponse.json({ ok: true, conversationId: result.conversationId });
  } catch (err) {
    await logAppError({
      source: "WAHA webhook",
      title: "Error sistem saat menyimpan chat WhatsApp.",
      detail: err instanceof Error ? err.stack || err.message : String(err),
    });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
