import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { getCloudHqConfig } from "@/lib/conversations/cloud-hq";
import { classifyBroadcastFile, uploadPhoneMedia } from "@/lib/broadcast/media";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "file_required" }, { status: 400 });
  const client = String(form.get("client") || "");
  const tenantId = session.isAgencyStaff ? client : session.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Pick a brand" }, { status: 400 });
  if (!(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 20) {
    return NextResponse.json({ error: "Attach a JPEG, PNG, WebP, or PDF." }, { status: 400 });
  }
  const classified = classifyBroadcastFile(file.type, file.size, file.name);
  if (!classified.ok) return NextResponse.json({ error: classified.error }, { status: 400 });
  const cfg = await getCloudHqConfig(tenantId);
  if (!cfg) return NextResponse.json({ error: "HQ Cloud API is not connected" }, { status: 400 });
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const media = await uploadPhoneMedia(cfg, {
      bytes,
      mime: classified.mime,
      filename: file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "file",
    });
    return NextResponse.json({ ok: true, media });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 502 });
  }
}
