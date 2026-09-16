import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listNoticesForSession } from "@/lib/notices";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { noticeSeenAt: true },
  });
  const { rows, unread } = await listNoticesForSession(session, user?.noticeSeenAt ?? null);
  return NextResponse.json({
    unread,
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      href: r.href,
      kind: r.kind,
      tenantName: r.tenant.name,
      at: r.createdAt.toISOString(),
    })),
  });
}

export async function POST() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.user.update({
    where: { id: session.userId },
    data: { noticeSeenAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
