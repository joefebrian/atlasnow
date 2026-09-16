import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessTenant } from "@/lib/locations/access";
import { getCloudHqConfig } from "@/lib/conversations/cloud-hq";
import { sendCloudHqText } from "@/lib/conversations/cloud-send";
import { sendMetaInboxText } from "@/lib/conversations/meta-send";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const row = await prisma.waConversation.findUnique({
    where: { id },
    include: { contact: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessTenant(session, row.tenantId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: { text?: string };
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Message required" }, { status: 400 });

  if (row.provider === "FACEBOOK" || row.provider === "INSTAGRAM") {
    const sent = await sendMetaInboxText({
      tenantId: row.tenantId,
      conversationId: row.id,
      provider: row.provider,
      sessionId: row.sessionId,
      contact: row.contact,
      text,
    });
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });
    return NextResponse.json({ ok: true, messageId: sent.messageId });
  }

  if (row.provider !== "META_CLOUD") {
    return NextResponse.json(
      { error: "Branch WhatsApp is watch-only. Reply from WhatsApp HQ." },
      { status: 403 }
    );
  }
  const phone = row.contact.phone;
  if (!phone) {
    return NextResponse.json({ error: "This contact has no phone number." }, { status: 400 });
  }
  const cfg = await getCloudHqConfig(row.tenantId);
  if (!cfg) {
    return NextResponse.json({ error: "HQ Cloud API is not connected for this brand." }, { status: 400 });
  }
  const sent = await sendCloudHqText({
    config: cfg,
    toPhone: phone,
    body: text,
    conversationId: row.id,
  });
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, messageId: sent.messageId });
}
