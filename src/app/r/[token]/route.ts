import { NextResponse } from "next/server";
import { openCapture } from "@/lib/reviews/capture-service";

export const dynamic = "force-dynamic";

function page(title: string, body: string, status: number) {
  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <style>
    body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#f8fafc;color:#0f172a}
    main{max-width:28rem;margin:18vh auto;padding:1.5rem}
    h1{font-size:1.15rem;margin:0 0 .5rem}
    p{color:#475569;line-height:1.5}
  </style>
</head>
<body><main>
  <h1>${title}</h1>
  <p>${body}</p>
</main></body></html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent");
  const result = await openCapture(token, url.searchParams, ua);
  if (result.kind === "redirect") {
    return NextResponse.redirect(result.url, 302);
  }
  if (result.kind === "unmapped") {
    return page(
      "Google Maps belum terpasang",
      "Outlet ini belum punya Place ID Google. Minta staf memasang tautan Google Maps di AtlasNow, lalu scan lagi.",
      200,
    );
  }
  return page(
    "Link tidak ditemukan",
    "Tautan review ini tidak berlaku. Minta staf gerai tautan QR yang baru.",
    404,
  );
}
