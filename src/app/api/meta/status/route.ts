import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessTenant, listAccessibleClientTenants } from "@/lib/locations/access";
import { getMetaConnector, publicPages } from "@/lib/meta/service";
import { resolvedAppBaseUrl, resolvedMetaApp } from "@/lib/integrations/service";
import { IG_WEBHOOK_FIELDS, PAGE_WEBHOOK_FIELDS } from "@/lib/meta/oauth";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const clientParam = url.searchParams.get("client");
  const tenantId = session.isAgencyStaff ? clientParam : session.tenantId;
  const metaApp = await resolvedMetaApp();

  if (!tenantId) {
    const clients = session.isAgencyStaff ? await listAccessibleClientTenants(session) : [];
    const origin = await resolvedAppBaseUrl();
    return NextResponse.json({
      configured: metaApp.configured,
      tenantId: null,
      clients,
      connector: null,
      pages: [],
      locations: [],
      mappings: [],
      webhookUrl: `${origin.replace(/\/$/, "")}/api/webhooks/meta`,
      pageWebhookFields: PAGE_WEBHOOK_FIELDS,
      igWebhookFields: IG_WEBHOOK_FIELDS,
    });
  }

  if (!(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [connector, locations, mappings, clients, origin] = await Promise.all([
    getMetaConnector(tenantId),
    prisma.location.findMany({
      where: { tenantId, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true },
    }),
    prisma.sourceMapping.findMany({
      where: {
        sourceType: { in: ["FACEBOOK", "INSTAGRAM"] },
        status: "ACTIVE",
        location: { tenantId },
      },
      select: {
        id: true,
        sourceType: true,
        externalId: true,
        externalLabel: true,
        locationId: true,
        location: { select: { name: true } },
      },
    }),
    session.isAgencyStaff ? listAccessibleClientTenants(session) : Promise.resolve([]),
    resolvedAppBaseUrl(),
  ]);

  const webhookUrl = `${origin.replace(/\/$/, "")}/api/webhooks/meta`;

  return NextResponse.json({
    configured: metaApp.configured,
    tenantId,
    clients,
    connector: connector
      ? {
          status: connector.status,
          displayName: connector.displayName,
          lastSyncAt: connector.lastSyncAt,
          lastError: connector.lastError,
        }
      : null,
    pages: publicPages(connector?.metaJson || null),
    locations,
    mappings,
    webhookUrl,
    pageWebhookFields: PAGE_WEBHOOK_FIELDS,
    igWebhookFields: IG_WEBHOOK_FIELDS,
  });
}
