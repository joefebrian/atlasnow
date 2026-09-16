import { NextResponse } from "next/server";
import { appBaseUrl, brandShortName } from "@/lib/loyalty/card-token";
import { loadPublicCard } from "@/lib/loyalty/card-public";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const card = await loadPublicCard(token);
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const encoded = encodeURIComponent(card.token);
  const icon = (size: number, mask = false) =>
    `/api/card/${encoded}/pwa-icon?size=${size}${mask ? "&mask=1" : ""}`;
  const name = card.tenant.name.trim() || "Kartu stamp";
  const start = `/card/${encoded}`;
  const manifest = {
    id: `${appBaseUrl()}/loyalty-card/${card.tenant.id}/${card.claims.phone}`,
    name,
    short_name: brandShortName(name),
    description: `Kartu stamp ${name}`,
    lang: "id",
    dir: "ltr",
    start_url: `${start}?source=pwa`,
    scope: "/card/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8fc",
    theme_color: "#faf8fc",
    icons: [
      { src: icon(192), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon(512), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: icon(512, true), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
