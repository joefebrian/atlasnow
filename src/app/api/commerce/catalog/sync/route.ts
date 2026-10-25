import { NextResponse } from "next/server";
import { guardCommerce } from "@/lib/commerce/guard";
import { recordCatalogSyncRefusal } from "@/lib/commerce/service";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  if ("token" in body || "secret" in body || "apiKey" in body || "accessToken" in body) {
    return NextResponse.json({ error: "Credentials are not accepted" }, { status: 400 });
  }
  const guard = await guardCommerce({
    write: true,
    tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
  });
  if (!guard.ok) return guard.response;

  const productId = typeof body.productId === "string" && body.productId ? body.productId : null;
  // A public product URL is not read from this request. The sync gate stays shut until the server has one.
  const result = await recordCatalogSyncRefusal(guard.tenantId, productId, guard.session.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    syncStatus: result.plan.syncStatus,
    externalProductId: result.plan.externalProductId,
    networkCalled: result.plan.networkCalled,
    message: result.plan.message,
  });
}
