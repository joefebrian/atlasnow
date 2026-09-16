import { NextResponse } from "next/server";
import { loadPublicCard } from "@/lib/loyalty/card-public";
import { brandLetter } from "@/lib/loyalty/card-token";
import { brandIconFill, renderCardPwaIcon } from "@/lib/loyalty/pwa-icon";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const card = await loadPublicCard(token, { logo: true });
  if (!card) return new NextResponse(null, { status: 404 });
  const url = new URL(request.url);
  const sizeRaw = Number(url.searchParams.get("size") || "192");
  const size = sizeRaw === 180 || sizeRaw === 512 ? sizeRaw : 192;
  const maskable = url.searchParams.get("mask") === "1";
  const png = await renderCardPwaIcon({
    logo: "logoImage" in card.tenant && card.tenant.logoImage ? Buffer.from(card.tenant.logoImage) : null,
    letter: brandLetter(card.tenant.name),
    size,
    maskable,
    fill: brandIconFill(card.tenant.slug),
  });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
      "Last-Modified": card.tenant.updatedAt.toUTCString(),
    },
  });
}
