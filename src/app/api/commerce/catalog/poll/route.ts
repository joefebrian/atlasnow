import { NextResponse } from "next/server";
import { guardCommerce } from "@/lib/commerce/guard";
import { resumeCatalogBatches } from "@/lib/commerce/connection-service";

/** Server-side resume for batches already submitted. Does not accept a public URL or start a new push. */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  if ("token" in body || "secret" in body || "apiKey" in body || "accessToken" in body || "publicUrl" in body) {
    return NextResponse.json({ error: "Credentials are not accepted" }, { status: 400 });
  }
  const guard = await guardCommerce({
    write: true,
    tenantId: typeof body.tenantId === "string" ? body.tenantId : null,
  });
  if (!guard.ok) return guard.response;
  const jobs = await resumeCatalogBatches({ tenantId: guard.tenantId });
  return NextResponse.json({ polled: jobs.length, jobs: jobs.map((job) => ({ status: job.status })) });
}
