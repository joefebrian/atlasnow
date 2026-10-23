import { NextResponse } from "next/server";
import { guardCommerce } from "@/lib/commerce/guard";
import { getCommerceConnection } from "@/lib/commerce/connection-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const guard = await guardCommerce({ write: false, tenantId: url.searchParams.get("tenantId") });
  if (!guard.ok) return guard.response;
  const connection = await getCommerceConnection(guard.tenantId);
  return NextResponse.json({ connection });
}
