import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, ctx: { params: Promise<{ joinKey: string }> }) {
  const { joinKey } = await ctx.params;
  const program = await prisma.loyaltyProgram.findUnique({
    where: { joinKey },
    select: {
      tenant: { select: { status: true, logoImage: true, logoMime: true, updatedAt: true } },
    },
  });
  if (!program || program.tenant.status === "ARCHIVED" || !program.tenant.logoImage) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(new Uint8Array(program.tenant.logoImage), {
    headers: {
      "Content-Type": program.tenant.logoMime || "image/webp",
      "Cache-Control": "public, max-age=3600",
      "Last-Modified": program.tenant.updatedAt.toUTCString(),
    },
  });
}
