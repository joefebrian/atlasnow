import { NextResponse } from "next/server";
import { importMetaCatalogProducts, listMetaCatalogProducts } from "@/lib/commerce/catalog-import";
import { guardCommerce } from "@/lib/commerce/guard";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const guard = await guardCommerce({ write: false, tenantId: url.searchParams.get("tenantId") });
  if (!guard.ok) return guard.response;
  const result = await listMetaCatalogProducts(guard.tenantId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = json && typeof json === "object" ? (json as { tenantId?: unknown; retailerIds?: unknown; catalogId?: unknown }) : {};
  const guard = await guardCommerce({
    write: true,
    tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
  });
  if (!guard.ok) return guard.response;
  const retailerIds = Array.isArray(body.retailerIds) ? body.retailerIds.filter((id): id is string => typeof id === "string") : [];
  const result = await importMetaCatalogProducts({
    tenantId: guard.tenantId,
    retailerIds,
    catalogId: typeof body.catalogId === "string" ? body.catalogId : undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
