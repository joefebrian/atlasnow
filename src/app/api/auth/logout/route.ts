import { NextResponse } from "next/server";
import { clearSessionCookie, readSession, writeAudit } from "@/lib/auth";

export async function POST() {
  const session = await readSession();
  if (session) {
    await writeAudit({
      tenantId: session.tenantId,
      actorId: session.userId,
      action: "LOGOUT",
      objectType: "user",
      objectId: session.userId,
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
