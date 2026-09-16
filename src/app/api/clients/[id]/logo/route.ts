import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { canManageClient } from "@/lib/tenancy";
import { clearTenantLogo, readLogoFile, saveTenantLogo } from "@/lib/brand-logo";

type Ctx = { params: Promise<{ id: string }> };

async function scoped(ctx: Ctx) {
  const session = await readSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id } = await ctx.params;
  const client = await prisma.tenant.findFirst({
    where: { id, type: "CLIENT" },
    select: { id: true, type: true, agencyId: true, logoMime: true, logoImage: true },
  });
  if (!client) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!canManageClient(session, client)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { client };
}

export async function GET(_request: Request, ctx: Ctx) {
  const s = await scoped(ctx);
  if ("error" in s) return s.error;
  if (!s.client.logoImage) return NextResponse.json({ error: "none" }, { status: 404 });
  return new NextResponse(new Uint8Array(s.client.logoImage), {
    headers: {
      "Content-Type": s.client.logoMime || "image/webp",
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const s = await scoped(ctx);
  if ("error" in s) return s.error;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "image_required" }, { status: 400 });
  const read = await readLogoFile(file);
  if ("error" in read) return NextResponse.json({ error: read.error }, { status: 400 });
  try {
    const saved = await saveTenantLogo(s.client.id, read.buf);
    return NextResponse.json({ ok: true, hasLogo: true, ...saved });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "image_type") return NextResponse.json({ error: "image_type" }, { status: 400 });
    console.error("[POST /api/clients/:id/logo]", e);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const s = await scoped(ctx);
  if ("error" in s) return s.error;
  await clearTenantLogo(s.client.id);
  return NextResponse.json({ ok: true, hasLogo: false });
}
