import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant, listAccessibleClientTenants } from "@/lib/locations/access";
import { BROADCAST_MAX, loadBroadcastAudience, sendBroadcast, sendTemplateBroadcast } from "@/lib/broadcast/audience";
import { publicRateSnapshot } from "@/lib/broadcast/rates";
import { getAtlasFees } from "@/lib/broadcast/fees";
import { getCloudHqConfig } from "@/lib/conversations/cloud-hq";
import { listWabaTemplates } from "@/lib/broadcast/templates";

async function resolveTenant(session: NonNullable<Awaited<ReturnType<typeof readSession>>>, client: string | null) {
  if (session.isAgencyStaff) {
    if (!client) return { error: "Pick a brand", status: 400 as const };
    const ok = await canAccessTenant(session, client);
    if (!ok) return { error: "Not found", status: 404 as const };
    return { tenantId: client };
  }
  return { tenantId: session.tenantId };
}

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const client = url.searchParams.get("client");
  const resolved = await resolveTenant(session, client);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const data = await loadBroadcastAudience(resolved.tenantId);
  const fees = await getAtlasFees();
  return NextResponse.json({ ...data, max: BROADCAST_MAX, rates: publicRateSnapshot(fees) });
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: {
    client?: string;
    ids?: string[];
    phones?: string[];
    text?: string;
    confirm?: boolean;
    mode?: string;
    templateName?: string;
    language?: string;
    media?: { id?: string; kind?: string; filename?: string } | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.confirm) return NextResponse.json({ error: "Confirm before sending" }, { status: 400 });

  const resolved = await resolveTenant(session, body.client || null);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  if (session.isAgencyStaff) {
    const brands = await listAccessibleClientTenants(session);
    if (!brands.some((b) => b.id === resolved.tenantId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  if (body.mode === "template") {
    const phones = Array.isArray(body.phones) ? body.phones.filter((x) => typeof x === "string") : [];
    if (phones.length === 0) return NextResponse.json({ error: "Pick at least one person" }, { status: 400 });
    const header =
      body.media?.id && (body.media.kind === "image" || body.media.kind === "document")
        ? {
            kind: body.media.kind === "document" ? ("document" as const) : ("image" as const),
            mediaId: body.media.id,
            filename: body.media.filename,
          }
        : null;
    const cfg = await getCloudHqConfig(resolved.tenantId);
    if (cfg) {
      try {
        const templates = await listWabaTemplates(cfg);
        const tpl = templates.find((row) => row.name === (body.templateName || ""));
        const needsHeader = tpl?.headerFormat === "IMAGE" || tpl?.headerFormat === "DOCUMENT";
        if (needsHeader && !header) {
          return NextResponse.json({ error: "This template needs a header image or PDF." }, { status: 400 });
        }
      } catch {
        /* send still proceeds; Meta will reject a missing header */
      }
    }
    const result = await sendTemplateBroadcast({
      tenantId: resolved.tenantId,
      createdByUserId: session.userId,
      phones,
      templateName: body.templateName || "",
      language: body.language || "id",
      header,
    });
    return NextResponse.json({ ok: true, max: BROADCAST_MAX, ...result });
  }

  const text = (body.text || "").trim();
  const media =
    body.media?.id && (body.media.kind === "image" || body.media.kind === "document")
      ? {
          id: body.media.id,
          kind: body.media.kind === "document" ? ("document" as const) : ("image" as const),
          filename: body.media.filename,
        }
      : null;
  if (!media && text.length < 2) return NextResponse.json({ error: "Write a message or attach a file" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: "Message too long" }, { status: 400 });
  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "Pick at least one person" }, { status: 400 });

  const result = await sendBroadcast({
    tenantId: resolved.tenantId,
    createdByUserId: session.userId,
    conversationIds: ids,
    text,
    media,
  });
  return NextResponse.json({ ok: true, max: BROADCAST_MAX, ...result });
}
