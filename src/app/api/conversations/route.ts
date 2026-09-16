import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { listConversations } from "@/lib/conversations/service";
import { getCloudHqConfig } from "@/lib/conversations/cloud-hq";
import { serviceQuotaForTenant } from "@/lib/waba/service-quota";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || undefined;
  const filter = url.searchParams.get("filter") === "unreplied" ? "unreplied" : "all";
  const locationId = url.searchParams.get("locationId") || undefined;
  const clientId = url.searchParams.get("client") || undefined;
  const provider = url.searchParams.get("provider") || undefined;
  const tenantId = session.isAgencyStaff ? clientId : session.tenantId;
  const data = await listConversations({
    q,
    filter,
    locationId,
    tenantId,
    provider: provider && provider !== "all" ? provider : undefined,
  });
  const quota = tenantId
    ? await serviceQuotaForTenant(tenantId, await getCloudHqConfig(tenantId))
    : null;
  return NextResponse.json({ ...data, quota });
}
