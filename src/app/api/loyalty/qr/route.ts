import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessTenant } from "@/lib/locations/access";
import { joinUrl } from "@/lib/loyalty/members";
import { getOrCreateProgram } from "@/lib/loyalty/service";

function fileSlug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "join"
  );
}

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const tenantId = session.isAgencyStaff ? url.searchParams.get("client") : session.tenantId;
  if (!tenantId || !(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const program = await getOrCreateProgram(tenantId);
  const outlet = url.searchParams.get("outlet");
  const download = url.searchParams.get("download") === "1";
  const png = await QRCode.toBuffer(joinUrl(program.joinKey, outlet), {
    type: "png",
    width: download ? 1024 : 480,
    margin: 1,
  });

  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Cache-Control": "no-store",
  };
  if (download) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, name: true },
    });
    let name = fileSlug(tenant?.slug || tenant?.name || "join");
    if (outlet) {
      const loc = await prisma.location.findFirst({
        where: { id: outlet, tenantId },
        select: { name: true },
      });
      if (loc?.name) name += `-${fileSlug(loc.name)}`;
    }
    headers["Content-Disposition"] = `attachment; filename="${name}-join-qr.png"`;
  }

  return new NextResponse(new Uint8Array(png), { headers });
}
