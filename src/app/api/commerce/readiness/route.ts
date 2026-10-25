import { NextResponse } from "next/server";
import { guardCommerce } from "@/lib/commerce/guard";
import { ensureCommerceReadiness } from "@/lib/commerce/service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const guard = await guardCommerce({ write: false, tenantId: url.searchParams.get("tenantId") });
  if (!guard.ok) return guard.response;
  const readiness = await ensureCommerceReadiness(guard.tenantId);
  return NextResponse.json({ readiness });
}
