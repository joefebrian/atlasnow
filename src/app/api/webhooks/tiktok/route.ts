import { NextResponse } from "next/server";

/** Ingest lands in T4. Ack shape only — do not treat 501 as a mapping miss. */
export async function GET() {
  return NextResponse.json({ ok: true, provider: "tiktok" });
}

export async function POST() {
  return NextResponse.json({ error: "tiktok_ingest_pending" }, { status: 501 });
}
