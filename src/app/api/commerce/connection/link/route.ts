import { NextResponse } from "next/server";
import { guardCommerce } from "@/lib/commerce/guard";
import { linkCommerceAssets } from "@/lib/commerce/connection-service";

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
    write: true,
    tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
  });
  if (!guard.ok) return guard.response;
  const result = await linkCommerceAssets(
    guard.tenantId,
    {
      businessId: typeof body.businessId === "string" ? body.businessId : "",
      catalogId: typeof body.catalogId === "string" ? body.catalogId : "",
      wabaId: typeof body.wabaId === "string" ? body.wabaId : "",
      phoneNumberId: typeof body.phoneNumberId === "string" ? body.phoneNumberId : "",
    },
    guard.session.userId
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ connection: result.connection });
}
