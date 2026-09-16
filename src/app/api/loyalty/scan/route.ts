import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { extractCardToken, isJoinQr, parseMemberAppPath, verifyCardToken } from "@/lib/loyalty/card-token";
import { loadMemberApp, memberAppUrlFor } from "@/lib/loyalty/card-public";
import { memberState } from "@/lib/loyalty/members";
import { memberSpenderStatus, memberStampStatus } from "@/lib/loyalty/service";

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

export async function POST(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  const body = (await request.json().catch(() => ({}))) as { raw?: string };
  const raw = typeof body.raw === "string" ? body.raw : "";
  if (!raw.trim()) return NextResponse.json({ error: "QR kosong" }, { status: 400 });
  if (/^TT-/i.test(raw.trim())) {
    return NextResponse.json(
      { error: "Ini QR TikTok GO. Scan di tab yang sama — Atlas akan cek voucher, bukan stamp." },
      { status: 400 }
    );
  }
  if (isJoinQr(raw)) {
    return NextResponse.json(
      { error: "Ini QR daftar, bukan QR stamp. Minta pelanggan isi form dulu, lalu cek HP." },
      { status: 400 }
    );
  }
  const appPath = parseMemberAppPath(raw);
  let phone = "";
  if (appPath) {
    const app = await loadMemberApp(appPath.slug, appPath.memberId);
    if (!app) return NextResponse.json({ error: "QR tidak valid" }, { status: 400 });
    if (app.tenant.id !== scoped.tenantId) {
      return NextResponse.json({ error: "QR ini milik merek lain" }, { status: 400 });
    }
    phone = app.member.phone;
  } else {
    const token = extractCardToken(raw);
    const parsed = verifyCardToken(token);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (parsed.claims.tid !== scoped.tenantId) {
      return NextResponse.json({ error: "QR ini milik merek lain" }, { status: 400 });
    }
    phone = parsed.claims.phone;
  }
  const membership = await memberState(scoped.tenantId, phone);
  if (!membership.registered) {
    return NextResponse.json({ error: "HP ini belum ada di database. Minta scan QR daftar." }, { status: 400 });
  }
  const [stamp, spender] = await Promise.all([
    memberStampStatus(scoped.tenantId, membership.phone),
    memberSpenderStatus(scoped.tenantId, membership.phone),
  ]);
  const cardUrl = await memberAppUrlFor(scoped.tenantId, membership.phone);
  return NextResponse.json({
    phone: membership.phone,
    stamp,
    spender,
    cardUrl,
    membership: {
      life: membership.life,
      registered: true,
      name: membership.member?.name || "",
      birthday: membership.birthday,
      birthdayWaOptIn: Boolean(membership.member?.birthdayWaOptIn),
    },
  });
}
