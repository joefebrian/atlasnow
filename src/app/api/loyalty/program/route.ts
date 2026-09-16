import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { prisma } from "@/lib/db";
import { getOrCreateProgram, programView, saveProgram } from "@/lib/loyalty/service";
import { EarnExclusiveError } from "@/lib/loyalty/earn-exclusive";

async function tenantOf(request: Request) {
  const session = await readSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const url = new URL(request.url);
  const tenantId = session.isAgencyStaff ? url.searchParams.get("client") : session.tenantId;
  if (!tenantId) return { error: NextResponse.json({ error: "Pick a brand first." }, { status: 400 }) };
  if (!(await canAccessTenant(session, tenantId))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, tenantId };
}

export async function GET(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  const program = programView(await getOrCreateProgram(scoped.tenantId));
  const locations = await prisma.location.findMany({
    where: { tenantId: scoped.tenantId, status: { not: "ARCHIVED" }, kind: { not: "HQ" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json({ program, locations });
}

export async function PUT(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  let saved;
  try {
    saved = await saveProgram(scoped.tenantId, {
    stampEnabled: typeof body.stampEnabled === "boolean" ? body.stampEnabled : undefined,
    stampGoal: typeof body.stampGoal === "number" ? body.stampGoal : undefined,
    stampMinAmount: typeof body.stampMinAmount === "number" ? body.stampMinAmount : undefined,
    stampRewardText: typeof body.stampRewardText === "string" ? body.stampRewardText : undefined,
    stampTiers: body.stampTiers,
    stampExpiry:
      body.stampExpiry === "lifetime" || body.stampExpiry === "years_1" || body.stampExpiry === "years_2"
        ? body.stampExpiry
        : undefined,
    pointEnabled: typeof body.pointEnabled === "boolean" ? body.pointEnabled : undefined,
    pointUnitRupiah: typeof body.pointUnitRupiah === "number" ? body.pointUnitRupiah : undefined,
    pointPerUnit: typeof body.pointPerUnit === "number" ? body.pointPerUnit : undefined,
    spenderEnabled: typeof body.spenderEnabled === "boolean" ? body.spenderEnabled : undefined,
    spenderScope: typeof body.spenderScope === "string" ? body.spenderScope : undefined,
    spenderLocationId: body.spenderLocationId === null || typeof body.spenderLocationId === "string" ? (body.spenderLocationId as string | null) : undefined,
    spenderMinAmount: typeof body.spenderMinAmount === "number" ? body.spenderMinAmount : undefined,
    spenderTopN: typeof body.spenderTopN === "number" ? body.spenderTopN : undefined,
    spenderRewardText: typeof body.spenderRewardText === "string" ? body.spenderRewardText : undefined,
    spenderTiers: body.spenderTiers,
    qrScope: typeof body.qrScope === "string" ? body.qrScope : undefined,
    birthdayEnabled: typeof body.birthdayEnabled === "boolean" ? body.birthdayEnabled : undefined,
    birthdayRewardText: typeof body.birthdayRewardText === "string" ? body.birthdayRewardText : undefined,
    birthdayVoucherPrefix: typeof body.birthdayVoucherPrefix === "string" ? body.birthdayVoucherPrefix : undefined,
    birthdayVoucherYear: typeof body.birthdayVoucherYear === "boolean" ? body.birthdayVoucherYear : undefined,
    birthdayVoucherSuffixLen:
      typeof body.birthdayVoucherSuffixLen === "number" ? body.birthdayVoucherSuffixLen : undefined,
    waReplies: body.waReplies,
    receiptAuditMode: typeof body.receiptAuditMode === "boolean" ? body.receiptAuditMode : undefined,
    guestReceiptUpload: typeof body.guestReceiptUpload === "boolean" ? body.guestReceiptUpload : undefined,
  });
  } catch (e) {
    if (e instanceof EarnExclusiveError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    throw e;
  }
  return NextResponse.json({ program: programView(saved) });
}
