import { NextResponse } from "next/server";
import { guardCommerce } from "@/lib/commerce/guard";
import { listCommerceOrders } from "@/lib/commerce/order-capture";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const guard = await guardCommerce({ write: false, tenantId: url.searchParams.get("tenantId") });
  if (!guard.ok) return guard.response;
  const orders = await listCommerceOrders(guard.tenantId);
  return NextResponse.json({ orders });
}
