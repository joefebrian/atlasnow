import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientIpFrom, takeRateToken } from "@/lib/http-rate-limit";
import { memberAppUrlFor } from "@/lib/loyalty/card-public";
import { registerMember } from "@/lib/loyalty/members";

export async function POST(request: Request, ctx: { params: Promise<{ joinKey: string }> }) {
  const ip = clientIpFrom(request);
  const limited = takeRateToken(`join:${ip}`, 12, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  const { joinKey } = await ctx.params;
  const program = await prisma.loyaltyProgram.findUnique({
    where: { joinKey },
    include: { tenant: { select: { id: true, status: true } } },
  });
  if (!program || program.tenant.status === "ARCHIVED") {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await registerMember({
    tenantId: program.tenantId,
    phone: typeof body.phone === "string" ? body.phone : "",
    name: typeof body.name === "string" ? body.name : "",
    email: typeof body.email === "string" ? body.email : "",
    birthDate: typeof body.birthDate === "string" ? body.birthDate : "",
    city: typeof body.city === "string" ? body.city : "",
    province: typeof body.province === "string" ? body.province : "",
    birthdayWaOptIn: body.birthdayWaOptIn === true,
    locationId: typeof body.outlet === "string" ? body.outlet : typeof body.locationId === "string" ? body.locationId : null,
    source: program.qrScope === "LOCATION" ? "QR_OUTLET" : "QR",
    qrScope: program.qrScope,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  const cardUrl = await memberAppUrlFor(program.tenantId, r.member.phone);
  return NextResponse.json({ ok: true, created: r.created, cardUrl, phone: r.member.phone });
}
