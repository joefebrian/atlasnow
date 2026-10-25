import { NextResponse } from "next/server";
import { guardCommerce } from "@/lib/commerce/guard";
import { disconnectCommerce } from "@/lib/commerce/connection-service";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const guard = await guardCommerce({
    write: true,
    tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
  });
  if (!guard.ok) return guard.response;
  const connection = await disconnectCommerce(guard.tenantId, guard.session.userId);
  return NextResponse.json({ connection });
}
