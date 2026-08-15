import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getConversationThread } from "@/lib/conversations/service";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAgencyStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const data = await getConversationThread(id, session.userId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
