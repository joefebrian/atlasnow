import { NextResponse } from "next/server";
import { logAppError } from "@/lib/error-log";
import {
  formatDeletionRequest,
  parseDeletionRequest,
} from "@/lib/legal/deletion-request";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseDeletionRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await logAppError({
    source: "Data deletion",
    title: `Deletion request (${parsed.value.kind}) from ${parsed.value.email}`,
    detail: formatDeletionRequest(parsed.value),
  });

  return NextResponse.json({ ok: true });
}
