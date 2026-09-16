import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCardToken } from "@/lib/loyalty/card-token";
import { memberStampStatus } from "@/lib/loyalty/service";
import { renderStampCardJpeg } from "@/lib/loyalty/stamp-card-image";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const parsed = verifyCardToken(decodeURIComponent(token));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 404 });
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: parsed.claims.tid },
    select: { id: true, name: true, status: true },
  });
  if (!tenant || tenant.status === "ARCHIVED") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const [stamp, program] = await Promise.all([
    memberStampStatus(tenant.id, parsed.claims.phone),
    prisma.loyaltyProgram.findUnique({
      where: { tenantId: tenant.id },
      select: { stampCardImage: true },
    }),
  ]);
  const next = stamp.tiers.find((t) => !t.reached);
  const nextLine = stamp.tiers.some((t) => t.canRedeem)
    ? `Bisa ditukar: ${stamp.tiers
        .filter((t) => t.canRedeem)
        .map((t) => t.reward || `${t.stamps} stamp`)
        .join(", ")}`
    : next
      ? `Berikutnya ${next.stamps}: ${next.reward || "lihat kasir"}`
      : "Tunjukkan ke kasir";

  const jpeg = await renderStampCardJpeg({
    brandName: tenant.name,
    count: stamp.count,
    goal: stamp.goal,
    nextLine,
    customImage: program?.stampCardImage ? Buffer.from(program.stampCardImage) : null,
  });

  const n = new URL(request.url).searchParams.get("n") || String(stamp.count);
  return new NextResponse(new Uint8Array(jpeg), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=120",
      "Content-Disposition": `inline; filename="stamp-${n}.jpg"`,
    },
  });
}
