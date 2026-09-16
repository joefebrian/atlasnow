import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getAtlasFees, parseFeeInput, saveAtlasFees } from "@/lib/broadcast/fees";
import { DEFAULT_ATLAS_FEES, publicRateSnapshot } from "@/lib/broadcast/rates";

function canEdit(session: NonNullable<Awaited<ReturnType<typeof readSession>>>) {
  return session.isPlatformAdmin;
}

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fees = await getAtlasFees();
  return NextResponse.json({ fees, rates: publicRateSnapshot(fees), canEdit: canEdit(session) });
}

export async function PUT(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(session)) {
    return NextResponse.json({ error: "Only Super Admin can set Atlas fees." }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const fees = await saveAtlasFees({
    session: parseFeeInput(body.session, DEFAULT_ATLAS_FEES.session),
    marketing: parseFeeInput(body.marketing, DEFAULT_ATLAS_FEES.marketing),
    utility: parseFeeInput(body.utility, DEFAULT_ATLAS_FEES.utility),
    authentication: parseFeeInput(body.authentication, DEFAULT_ATLAS_FEES.authentication),
    marginPct: parseFeeInput(body.marginPct, DEFAULT_ATLAS_FEES.marginPct),
  });
  return NextResponse.json({ ok: true, fees, rates: publicRateSnapshot(fees) });
}
