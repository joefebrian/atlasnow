import { NextResponse } from "next/server";
import { requirePlatformSession } from "@/lib/auth";
import { isPlatformMode } from "@/lib/tenancy";
import { agentOpen, agentReply, closeThread, listDesk, touchAgentPresence } from "@/lib/support/service";

async function gate() {
  const session = await requirePlatformSession();
  if (!session || !isPlatformMode(session)) return null;
  return session;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await touchAgentPresence();
  return NextResponse.json(await listDesk());
}

export async function POST(request: Request) {
  if (!(await gate())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const action = typeof rec.action === "string" ? rec.action : "";
  const threadId = typeof rec.threadId === "string" ? rec.threadId : "";
  await touchAgentPresence();

  if (action === "open") {
    const r = await agentOpen(threadId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, thread: r.thread, desk: await listDesk() });
  }
  if (action === "reply") {
    const text = typeof rec.body === "string" ? rec.body : "";
    const r = await agentReply(threadId, text);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, thread: r.thread, desk: await listDesk() });
  }
  if (action === "close") {
    const r = await closeThread(threadId, "AGENT");
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, desk: await listDesk() });
  }
  if (action === "presence") {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
