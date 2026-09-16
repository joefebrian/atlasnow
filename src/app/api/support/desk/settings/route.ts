import { NextResponse } from "next/server";
import { requirePlatformSession } from "@/lib/auth";
import { isPlatformMode } from "@/lib/tenancy";
import { hoursFromRow } from "@/lib/support/hours";
import { getDeskSettings, saveDeskHours } from "@/lib/support/service";

async function gate() {
  const session = await requirePlatformSession();
  if (!session || !isPlatformMode(session)) return null;
  return session;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const row = await getDeskSettings();
  return NextResponse.json({ ...hoursFromRow(row), timezone: row.timezone });
}

export async function PUT(request: Request) {
  if (!(await gate())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const openHm = typeof rec.openHm === "string" ? rec.openHm : "09:00";
  const closeHm = typeof rec.closeHm === "string" ? rec.closeHm : "17:00";
  const days = Array.isArray(rec.daysOfWeek)
    ? rec.daysOfWeek.map((n) => Number(n)).filter((n) => n >= 1 && n <= 7)
    : [1, 2, 3, 4, 5, 6, 7];
  const enabled = rec.enabled !== false;
  const row = await saveDeskHours({ enabled, openHm, closeHm, daysOfWeek: days });
  return NextResponse.json({ ok: true, ...hoursFromRow(row), timezone: row.timezone });
}
