import { NextResponse } from "next/server";
import { guardCommerce } from "@/lib/commerce/guard";
import { updateCommerceProduct } from "@/lib/commerce/service";
import { parseProductInput } from "@/lib/commerce/validate";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
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

  const parsed = parseProductInput(json);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await updateCommerceProduct(
    guard.tenantId,
    id,
    parsed.value,
    guard.session.userId,
    body.expectedUpdatedAt
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ product: result.product });
}
