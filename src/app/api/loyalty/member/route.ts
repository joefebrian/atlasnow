import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { memberAppUrlFor } from "@/lib/loyalty/card-public";
import { memberState } from "@/lib/loyalty/members";
import { memberSpenderStatus, memberStampStatus, redeem } from "@/lib/loyalty/service";

async function tenantOf(request: Request) {
  const session = await readSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const url = new URL(request.url);
  const tenantId = session.isAgencyStaff ? url.searchParams.get("client") : session.tenantId;
  if (!tenantId || !(await canAccessTenant(session, tenantId))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, tenantId };
}

export async function GET(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  const phone = new URL(request.url).searchParams.get("phone") || "";
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });
  const [stamp, spender, membership] = await Promise.all([
    memberStampStatus(scoped.tenantId, phone),
    memberSpenderStatus(scoped.tenantId, phone),
    memberState(scoped.tenantId, phone),
  ]);
  const cardUrl = membership.registered ? await memberAppUrlFor(scoped.tenantId, membership.phone) : null;
  return NextResponse.json({
    stamp,
    spender,
    cardUrl,
    membership: {
      life: membership.life,
      registered: membership.registered,
      name: membership.member?.name || "",
      phone: membership.phone,
      birthday: membership.birthday,
      birthdayWaOptIn: Boolean(membership.member?.birthdayWaOptIn),
    },
  });
}

export async function POST(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  const body = (await request.json().catch(() => ({}))) as {
    phone?: string;
    kind?: "STAMP_CARD" | "TOP_SPENDER" | "BIRTHDAY";
    locationId?: string;
    tierKey?: string;
    voucherCode?: string;
  };
  if (!body.phone || (body.kind !== "STAMP_CARD" && body.kind !== "TOP_SPENDER" && body.kind !== "BIRTHDAY")) {
    return NextResponse.json({ error: "phone and kind required" }, { status: 400 });
  }
  const r = await redeem({
    tenantId: scoped.tenantId,
    phone: body.phone,
    kind: body.kind,
    actorId: scoped.session.userId,
    locationId: body.locationId,
    tierKey: typeof body.tierKey === "string" ? body.tierKey : undefined,
    voucherCode: typeof body.voucherCode === "string" ? body.voucherCode : undefined,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
