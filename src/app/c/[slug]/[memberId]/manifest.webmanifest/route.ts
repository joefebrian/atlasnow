import { NextResponse } from "next/server";
import { appBaseUrl, brandShortName, memberAppPath } from "@/lib/loyalty/card-token";
import { loadMemberApp } from "@/lib/loyalty/card-public";

type Ctx = { params: Promise<{ slug: string; memberId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { slug: slugRaw, memberId: memberRaw } = await ctx.params;
  const app = await loadMemberApp(decodeURIComponent(slugRaw), decodeURIComponent(memberRaw));
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { tenant, member } = app;
  const path = memberAppPath(tenant.slug, member.id);
  const icon = `/i/${encodeURIComponent(tenant.slug)}`;
  const name = tenant.name.trim() || "Kartu stamp";
  const manifest = {
    id: `${appBaseUrl()}/c/${tenant.slug}/${member.id}`,
    name,
    short_name: brandShortName(name),
    description: `Kartu stamp ${name}`,
    lang: "id",
    dir: "ltr",
    start_url: `${path}?source=pwa`,
    scope: `/c/${encodeURIComponent(tenant.slug)}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8fc",
    theme_color: "#faf8fc",
    icons: [
      { src: `${icon}/192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${icon}/512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${icon}/512-mask.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
