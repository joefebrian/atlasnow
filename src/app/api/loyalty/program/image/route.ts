import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { prisma } from "@/lib/db";
import { getOrCreateProgram } from "@/lib/loyalty/service";
import { STAMP_CARD_MAX_BYTES, STAMP_CARD_OK_MIME } from "@/lib/loyalty/stamp-card-image";
import { saveTenantLogo } from "@/lib/brand-logo";

async function tenantOf(request: Request) {
  const session = await readSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const url = new URL(request.url);
  const tenantId = session.isAgencyStaff ? url.searchParams.get("client") : session.tenantId;
  if (!tenantId) return { error: NextResponse.json({ error: "Pick a brand first." }, { status: 400 }) };
  if (!(await canAccessTenant(session, tenantId))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, tenantId };
}

export async function POST(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size < 40) {
    return NextResponse.json({ error: "image_required" }, { status: 400 });
  }
  if (file.size > STAMP_CARD_MAX_BYTES) {
    return NextResponse.json({ error: "image_too_large" }, { status: 400 });
  }
  const mime = (file.type || "").toLowerCase();
  if (!STAMP_CARD_OK_MIME.has(mime)) {
    return NextResponse.json({ error: "image_type" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  await getOrCreateProgram(scoped.tenantId);
  await prisma.loyaltyProgram.update({
    where: { tenantId: scoped.tenantId },
    data: { stampCardImage: buf, stampCardMime: mime },
  });
  const brand = await prisma.tenant.findUnique({
    where: { id: scoped.tenantId },
    select: { logoMime: true },
  });
  if (!brand?.logoMime) {
    try {
      await saveTenantLogo(scoped.tenantId, buf);
    } catch {
      /* stamp image is enough — icon route falls back to it */
    }
  }
  return NextResponse.json({ ok: true, hasStampCardImage: true });
}

export async function DELETE(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  await prisma.loyaltyProgram.updateMany({
    where: { tenantId: scoped.tenantId },
    data: { stampCardImage: null, stampCardMime: "" },
  });
  return NextResponse.json({ ok: true, hasStampCardImage: false });
}

export async function GET(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  const row = await prisma.loyaltyProgram.findUnique({
    where: { tenantId: scoped.tenantId },
    select: { stampCardImage: true, stampCardMime: true },
  });
  if (!row?.stampCardImage) {
    return NextResponse.json({ error: "none" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(row.stampCardImage), {
    headers: {
      "Content-Type": row.stampCardMime || "image/jpeg",
      "Cache-Control": "private, max-age=30",
    },
  });
}
