import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientIpFrom, takeRateToken } from "@/lib/http-rate-limit";
import { loadMemberApp } from "@/lib/loyalty/card-public";
import { verifyCardToken } from "@/lib/loyalty/card-token";
import { getOrCreateProgram, submitIntake } from "@/lib/loyalty/service";

export async function POST(request: Request, ctx: { params: Promise<{ slug: string; memberId: string }> }) {
  const ip = clientIpFrom(request);
  const { slug, memberId } = await ctx.params;
  const ipLimit = takeRateToken(`guest-struk:${ip}`, 8, 15 * 60 * 1000);
  const memLimit = takeRateToken(`guest-struk-m:${memberId}`, 8, 15 * 60 * 1000);
  if (!ipLimit.ok || !memLimit.ok) {
    return NextResponse.json({ error: "Terlalu banyak kirim. Coba lagi nanti." }, { status: 429 });
  }

  const app = await loadMemberApp(decodeURIComponent(slug), decodeURIComponent(memberId));
  if (!app) return NextResponse.json({ error: "Kartu tidak valid" }, { status: 404 });

  const program = await getOrCreateProgram(app.tenant.id);
  if (!program.guestReceiptUpload) {
    return NextResponse.json({ error: "Merek ini belum menerima struk dari kartu. Serahkan ke kasir." }, { status: 403 });
  }

  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Foto struk wajib." }, { status: 400 });
  }
  const form = await request.formData();
  const token = String(form.get("token") || "");
  const parsed = verifyCardToken(token);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.claims.tid !== app.tenant.id || parsed.claims.phone !== app.member.phone) {
    return NextResponse.json({ error: "Kartu tidak cocok. Buka ulang kartu stamp." }, { status: 403 });
  }

  const locationId = String(form.get("locationId") || "");
  const loc = await prisma.location.findFirst({
    where: { id: locationId, tenantId: app.tenant.id, status: { not: "ARCHIVED" }, kind: { not: "HQ" } },
  });
  if (!loc) return NextResponse.json({ error: "Pilih cabang tempat belanja." }, { status: 400 });

  const file = form.get("photo");
  let photo: { bytes: Buffer; mime: string } | null = null;
  if (file && typeof file === "object" && "arrayBuffer" in file) {
    photo = { bytes: Buffer.from(await file.arrayBuffer()), mime: file.type || "image/jpeg" };
  }

  const amountRaw = String(form.get("amount") || "").replace(/[^\d]/g, "");
  const staff = [loc.phone, loc.waOutletPhone].filter(Boolean) as string[];
  const r = await submitIntake({
    tenantId: app.tenant.id,
    locationId: loc.id,
    phone: app.member.phone,
    trxId: String(form.get("trxId") || ""),
    amount: amountRaw ? Number(amountRaw) : null,
    source: "GUEST_PWA",
    staffPhones: staff,
    photo,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({
    ok: true,
    autoApproved: r.autoApproved,
    matchStatus: r.matchStatus,
    warn: "warn" in r ? r.warn : undefined,
  });
}
