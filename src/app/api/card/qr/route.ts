import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { extractCardToken, inspectCardToken, memberAppUrl, parseMemberAppPath } from "@/lib/loyalty/card-token";
import { loadMemberApp, memberAppUrlFor } from "@/lib/loyalty/card-public";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const raw = q.get("url") || q.get("token") || "";
  const target = await resolveCardQrTarget(raw);
  if (!target) return NextResponse.json({ error: "QR tidak valid" }, { status: 400 });
  const png = await QRCode.toBuffer(target, { type: "png", width: 560, margin: 2, errorCorrectionLevel: "M" });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}

async function resolveCardQrTarget(raw: string): Promise<string | null> {
  const app = parseMemberAppPath(raw);
  if (app) {
    const loaded = await loadMemberApp(app.slug, app.memberId);
    if (!loaded) return null;
    return memberAppUrl(loaded.tenant.slug, loaded.member.id);
  }
  const token = extractCardToken(raw);
  const parsed = inspectCardToken(token);
  if (!parsed.ok) return null;
  return memberAppUrlFor(parsed.claims.tid, parsed.claims.phone);
}
