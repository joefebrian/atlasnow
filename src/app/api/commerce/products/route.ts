import { NextResponse } from "next/server";
import { canWriteCommerce } from "@/lib/commerce/access";
import { guardCommerce } from "@/lib/commerce/guard";
import {
  createCommerceProduct,
  ensureCommerceReadiness,
  listCommerceProducts,
  listStoreLocations,
} from "@/lib/commerce/service";
import { parseProductInput } from "@/lib/commerce/validate";

function listStatus(value: string | null): "ACTIVE" | "ARCHIVED" | "ALL" {
  if (value === "ARCHIVED" || value === "ALL") return value;
  return "ACTIVE";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const guard = await guardCommerce({ write: false, tenantId: url.searchParams.get("tenantId") });
  if (!guard.ok) return guard.response;

  const [products, locations, readiness] = await Promise.all([
    listCommerceProducts(guard.tenantId, listStatus(url.searchParams.get("status"))),
    listStoreLocations(guard.tenantId),
    ensureCommerceReadiness(guard.tenantId),
  ]);

  return NextResponse.json({
    products,
    locations,
    readiness,
    canWrite: canWriteCommerce(guard.session),
  });
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = json && typeof json === "object" ? (json as { tenantId?: unknown }) : {};
  const guard = await guardCommerce({
    write: true,
    tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
  });
  if (!guard.ok) return guard.response;

  const parsed = parseProductInput(json);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await createCommerceProduct(guard.tenantId, parsed.value, guard.session.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ product: result.product }, { status: 201 });
}
