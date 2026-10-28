import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessTenant } from "@/lib/locations/access";
import { markHumanHandoff, resumeAutomation } from "@/lib/conversations/handoff";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const row = await prisma.waConversation.findUnique({ where: { id }, select: { id: true, tenantId: true } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessTenant(session, row.tenantId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.action === "resume") {
    await resumeAutomation(row.id);
    return NextResponse.json({ ok: true, handoffActive: false });
  }
  if (body.action === "takeover") {
    await markHumanHandoff(row.id, new Date());
    return NextResponse.json({ ok: true, handoffActive: true });
  }
  return NextResponse.json({ error: "Use takeover or resume." }, { status: 400 });
}
