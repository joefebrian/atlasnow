import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/get-locale";
import { listActivity } from "@/lib/activity-query";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const locale = await getLocale();
  const items = await listActivity(session, locale);
  return NextResponse.json({ items });
}
