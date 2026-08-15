import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { listConversations } from "@/lib/conversations/service";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAgencyStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || undefined;
  const filter = url.searchParams.get("filter") === "unreplied" ? "unreplied" : "all";
  const locationId = url.searchParams.get("locationId") || undefined;
  const data = await listConversations({ q, filter, locationId });
  return NextResponse.json(data);
}
