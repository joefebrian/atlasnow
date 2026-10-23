import { NextResponse } from "next/server";
import { guardCommerce } from "@/lib/commerce/guard";
import { previewCatalogSync } from "@/lib/commerce/connection-service";

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
  const guard = await guardCommerce({
    write: false,
    tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
  });
  if (!guard.ok) return guard.response;
  const productId = typeof body.productId === "string" ? body.productId : "";
  const result = await previewCatalogSync(guard.tenantId, productId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
