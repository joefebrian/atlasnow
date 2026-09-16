import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { readSession } from "@/lib/auth";
import { staffCaptureForLocation } from "@/lib/reviews/capture-service";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const locationId = url.searchParams.get("locationId")?.trim() || "";
  if (!locationId) return NextResponse.json({ error: "locationId required" }, { status: 400 });
  const row = await staffCaptureForLocation(session, locationId);
  if (!row) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!row.url) {
    return NextResponse.json(
      { error: "Map this outlet on Google Maps first" },
      { status: 400 },
    );
  }
  const download = url.searchParams.get("download") === "1";
  const png = await QRCode.toBuffer(row.url, {
    type: "png",
    width: download ? 1024 : 480,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Cache-Control": "no-store",
  };
  if (download) {
    const slug = (row.locationName || "outlet").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    headers["Content-Disposition"] = `attachment; filename="review-${slug || "outlet"}.png"`;
  }
  return new NextResponse(new Uint8Array(png), { headers });
}
