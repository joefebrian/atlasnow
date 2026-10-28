import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { listConversations } from "@/lib/conversations/service";
import { getCloudHqConfig, listWorkspaceWhatsAppNumbers } from "@/lib/conversations/cloud-hq";
import { branchLocationId, canAccessTenant } from "@/lib/locations/access";
import { serviceQuotaForTenant } from "@/lib/waba/service-quota";

const PROVIDERS: Record<string, string> = {
  whatsapp: "META_CLOUD",
  instagram: "INSTAGRAM",
  messenger: "FACEBOOK",
};

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || undefined;
  const filter = url.searchParams.get("filter") === "unreplied" ? "unreplied" : "all";
  const locationId = url.searchParams.get("locationId") || undefined;
  const clientId = url.searchParams.get("client") || undefined;
  const requestedProvider = (url.searchParams.get("provider") || "").trim();
  const provider = PROVIDERS[requestedProvider.toLowerCase()] || requestedProvider;
  const tenantId = session.isAgencyStaff ? clientId : session.tenantId;
  if (tenantId && !(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const lockedLocation = branchLocationId(session);
  const scopedLocation = lockedLocation || locationId;
  const data = await listConversations({
    q,
    filter,
    locationId: scopedLocation,
    tenantId,
    provider: provider && provider !== "all" ? provider : undefined,
    phoneNumberId: url.searchParams.get("phoneNumberId") || undefined,
    team: url.searchParams.get("team") || undefined,
    assignedUserId: url.searchParams.get("agent") || undefined,
    leadStatus: url.searchParams.get("lead") || undefined,
  });
  const quota = tenantId
    ? await serviceQuotaForTenant(tenantId, await getCloudHqConfig(tenantId))
    : null;
  const numbers = tenantId ? await listWorkspaceWhatsAppNumbers(tenantId) : [];
  const channels = numbers
    .filter((number) => !lockedLocation || number.locationId === lockedLocation)
    .map((number) => ({
      phoneNumberId: number.phoneNumberId,
      label: number.label,
      teamLabel: number.teamLabel,
      locationId: number.locationId,
      health: number.health,
    }));
  return NextResponse.json({ ...data, quota, channels });
}
