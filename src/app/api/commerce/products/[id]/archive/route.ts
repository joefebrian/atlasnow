import { NextResponse } from "next/server";
import { guardCommerce } from "@/lib/commerce/guard";
import { archiveCommerceProduct } from "@/lib/commerce/service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = json && typeof json === "object" ? (json as { tenantId?: unknown; expectedUpdatedAt?: unknown }) : {};
  const guard = await guardCommerce({
    write: true,
    tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
  });
  if (!guard.ok) return guard.response;
  const result = await archiveCommerceProduct(guard.tenantId, id, body.expectedUpdatedAt, guard.session.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ product: result.product });
}
