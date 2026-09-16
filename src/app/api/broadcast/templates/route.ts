import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant, listAccessibleClientTenants } from "@/lib/locations/access";
import { getCloudHqConfig } from "@/lib/conversations/cloud-hq";
import { createWabaTemplate, listWabaTemplates } from "@/lib/broadcast/templates";
import { classifyBroadcastFile, uploadTemplateHeaderHandle } from "@/lib/broadcast/media";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  const client = new URL(request.url).searchParams.get("client");
  const resolved = await resolveTenant(session, client);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const cfg = await getCloudHqConfig(resolved.tenantId);
  if (!cfg) return NextResponse.json({ error: "HQ Cloud API is not connected" }, { status: 400 });
  try {
    const templates = await listWabaTemplates(cfg);
    return NextResponse.json({ templates });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not list templates" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") || "";
  let client: string | null = null;
  let name = "";
  let categoryRaw = "";
  let language = "id";
  let bodyText = "";
  let headerFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "invalid_form" }, { status: 400 });
    client = String(form.get("client") || "") || null;
    name = String(form.get("name") || "");
    categoryRaw = String(form.get("category") || "");
    language = String(form.get("language") || "id");
    bodyText = String(form.get("body") || "");
    const f = form.get("file");
    if (f instanceof File && f.size > 20) headerFile = f;
  } else {
    let body: { client?: string; name?: string; category?: string; language?: string; body?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    client = body.client || null;
    name = body.name || "";
    categoryRaw = body.category || "";
    language = body.language || "id";
    bodyText = body.body || "";
  }

  const resolved = await resolveTenant(session, client);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  if (session.isAgencyStaff) {
    const brands = await listAccessibleClientTenants(session);
    if (!brands.some((b) => b.id === resolved.tenantId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
  const category = categoryRaw === "UTILITY" ? "UTILITY" : categoryRaw === "MARKETING" ? "MARKETING" : null;
  if (!category) return NextResponse.json({ error: "Category must be MARKETING or UTILITY" }, { status: 400 });
  const cfg = await getCloudHqConfig(resolved.tenantId);
  if (!cfg) return NextResponse.json({ error: "HQ Cloud API is not connected" }, { status: 400 });

  let header: { format: "IMAGE" | "DOCUMENT"; handle: string } | null = null;
  if (headerFile) {
    const classified = classifyBroadcastFile(headerFile.type, headerFile.size, headerFile.name);
    if (!classified.ok) return NextResponse.json({ error: classified.error }, { status: 400 });
    try {
      const handle = await uploadTemplateHeaderHandle(cfg, {
        bytes: Buffer.from(await headerFile.arrayBuffer()),
        mime: classified.mime,
        filename: headerFile.name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "file",
      });
      header = { format: classified.kind === "document" ? "DOCUMENT" : "IMAGE", handle };
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not upload header file to Meta" },
        { status: 502 }
      );
    }
  }

  try {
    const created = await createWabaTemplate(cfg, {
      name,
      category,
      language,
      body: bodyText,
      header,
    });
    return NextResponse.json({ ok: true, ...created });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Meta rejected the template" }, { status: 502 });
  }
}
