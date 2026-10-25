import { NextResponse } from "next/server";
import { exportTenantCatalogFeed } from "@/lib/commerce/catalog-export";
import { guardCommerce } from "@/lib/commerce/guard";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  if ("token" in body || "secret" in body || "accessToken" in body) {
    return NextResponse.json({ error: "Credentials are not accepted" }, { status: 400 });
  }
  if (body.productIds != null && !Array.isArray(body.productIds)) {
    return NextResponse.json({ error: "productIds must be a list" }, { status: 400 });
  }
  const guard = await guardCommerce({
    write: false,
    tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
  });
  if (!guard.ok) return guard.response;
  const productIds = Array.isArray(body.productIds) ? body.productIds.filter((id): id is string => typeof id === "string") : undefined;
  const result = await exportTenantCatalogFeed(guard.tenantId, productIds);
  return NextResponse.json(result);
}
