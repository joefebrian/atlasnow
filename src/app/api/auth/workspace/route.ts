import { NextResponse } from "next/server";
import { switchWorkspace } from "@/lib/auth";
import { defaultHomePath } from "@/lib/tenancy";

export async function POST(request: Request) {
  let body: { mode?: string; agencyId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.mode === "platform") {
    const session = await switchWorkspace({ mode: "platform" });
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ ok: true, home: defaultHomePath(session) });
  }
  if (body.mode === "agency" && body.agencyId) {
    const session = await switchWorkspace({ mode: "agency", agencyId: body.agencyId });
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ ok: true, home: defaultHomePath(session) });
  }
  return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
}
