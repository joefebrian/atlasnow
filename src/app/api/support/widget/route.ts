import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { SUPPORT_COOKIE, readSupportThreadId } from "@/lib/support/cookie";
import { widgetSnapshot } from "@/lib/support/service";

export async function GET() {
  const session = await readSession();
  const jar = await cookies();
  const cookieThreadId = await readSupportThreadId(jar.get(SUPPORT_COOKIE)?.value);
  const snap = await widgetSnapshot({
    userId: session?.userId,
    cookieThreadId,
    session,
  });
  return NextResponse.json(snap);
}
