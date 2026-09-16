import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatErrorLogLine, logAppError } from "@/lib/error-log";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let json: { source?: string; title?: string; detail?: string } = {};
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const title = (json.title || "").trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  await logAppError({
    source: (json.source || "Browser").slice(0, 80),
    title,
    detail: json.detail,
  });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAgencyStaff && !session.isPlatformAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await prisma.appErrorLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({
    errors: rows.map((r) => ({
      id: r.id,
      source: r.source,
      title: r.title,
      detail: r.detail,
      createdAt: r.createdAt.toISOString(),
    })),
    copyAll: rows.map(formatErrorLogLine).join("\n\n---\n\n"),
  });
}

export async function DELETE() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAgencyStaff && !session.isPlatformAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.appErrorLog.deleteMany();
  return NextResponse.json({ ok: true });
}
