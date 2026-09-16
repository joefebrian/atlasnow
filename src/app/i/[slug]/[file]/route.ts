import { NextResponse } from "next/server";
import { loadBrandBySlug } from "@/lib/loyalty/card-public";
import { brandLetter } from "@/lib/loyalty/card-token";
import { brandIconFill, renderCardPwaIcon } from "@/lib/loyalty/pwa-icon";

type Ctx = { params: Promise<{ slug: string; file: string }> };

const FILES: Record<string, { size: number; maskable: boolean }> = {
  "180.png": { size: 180, maskable: false },
  "192.png": { size: 192, maskable: false },
  "512.png": { size: 512, maskable: false },
  "512-mask.png": { size: 512, maskable: true },
};

export async function GET(_request: Request, ctx: Ctx) {
  const { slug: slugRaw, file } = await ctx.params;
  const spec = FILES[file];
  if (!spec) return new NextResponse(null, { status: 404 });
  const slug = decodeURIComponent(slugRaw);
  const tenant = await loadBrandBySlug(slug, { logo: true });
  if (!tenant) return new NextResponse(null, { status: 404 });
  const png = await renderCardPwaIcon({
    logo: tenant.markImage ? Buffer.from(tenant.markImage) : null,
    letter: brandLetter(tenant.name),
    size: spec.size,
    maskable: spec.maskable,
    fill: brandIconFill(tenant.slug),
  });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=120, must-revalidate",
      "Last-Modified": (tenant.markAt || tenant.updatedAt).toUTCString(),
    },
  });
}
