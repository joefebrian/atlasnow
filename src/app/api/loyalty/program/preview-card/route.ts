import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { prisma } from "@/lib/db";
import { getOrCreateProgram } from "@/lib/loyalty/service";
import { renderStampCardJpeg } from "@/lib/loyalty/stamp-card-image";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const tenantId = session.isAgencyStaff ? url.searchParams.get("client") : session.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Pick a brand first." }, { status: 400 });
  if (!(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const program = await getOrCreateProgram(tenantId);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  const count = Math.max(0, Number(url.searchParams.get("n") || 3) || 3);
  const jpeg = await renderStampCardJpeg({
    brandName: tenant?.name || "Brand",
    count,
    goal: program.stampGoal || 10,
    nextLine: "Contoh kartu · Status Stamp",
    customImage: program.stampCardImage ? Buffer.from(program.stampCardImage) : null,
  });
  return new NextResponse(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
