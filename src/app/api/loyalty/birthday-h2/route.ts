import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { runBirthdayH2AllTenants, runBirthdayH2ForTenant } from "@/lib/loyalty/birthday-wa";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isPlatformAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let client: string | null = null;
  try {
    const body = (await request.json()) as { client?: string };
    client = typeof body.client === "string" && body.client ? body.client : null;
  } catch {
    client = null;
  }

  if (client) {
    const ok = await canAccessTenant(session, client);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const result = await runBirthdayH2ForTenant(client);
    return NextResponse.json({ ok: true, tenants: [result] });
  }

  const result = await runBirthdayH2AllTenants();
  return NextResponse.json({ ok: true, ...result });
}
