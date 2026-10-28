import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAgencySession } from "@/lib/auth";
import {
  ATLASNOW_PRODUCTION_ORIGIN,
  GOOGLE_PROVIDER,
  appBaseUrlAsync,
  googleOAuthConfiguredAsync,
  googleOAuthRedirectUris,
  googleRedirectUriAsync,
} from "@/lib/google/config";
import { getAgencyTenant } from "@/lib/google/connector";

export async function GET() {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  const agency = await getAgencyTenant();
  const connector = agency
    ? await prisma.connector.findUnique({
        where: {
          tenantId_provider_accountKey: { tenantId: agency.id, provider: GOOGLE_PROVIDER, accountKey: "" },
        },
      })
    : null;

  const remoteCount = connector
    ? await prisma.googleRemoteLocation.count({ where: { connectorId: connector.id } })
    : 0;

  const mappedCount = await prisma.sourceMapping.count({
    where: { sourceType: "GOOGLE_BUSINESS_PROFILE", status: "ACTIVE" },
  });

  const locationCount = await prisma.location.count({
    where: { status: { not: "ARCHIVED" }, tenant: { type: "CLIENT" } },
  });

  const recentRuns = connector
    ? await prisma.syncRun.findMany({
        where: { connectorId: connector.id },
        orderBy: { startedAt: "desc" },
        take: 5,
      })
    : [];

  const oauthConfigured = await googleOAuthConfiguredAsync();
  const appBaseUrl = await appBaseUrlAsync();
  const redirectUri = await googleRedirectUriAsync();
  const redirectUris = googleOAuthRedirectUris();
  const productionOrigin = ATLASNOW_PRODUCTION_ORIGIN;
  const productionRedirectUri = `${ATLASNOW_PRODUCTION_ORIGIN}/api/google/oauth/callback`;

  const liveConnected =
    connector?.status === "CONNECTED" && connector.mode !== "MOCK";
  const hasSynced = remoteCount > 0 && liveConnected;
  const hasMapped = mappedCount > 0;

  const setup = [
    {
      id: "gcp",
      title: "Google Cloud APIs",
      detail:
        "Project AtlasNow / P2P Labs — enable My Business Account Management API and My Business Business Information API. Domain: atlasnow.co.",
      done: oauthConfigured || liveConnected,
    },
    {
      id: "oauth",
      title: "OAuth client credentials",
      detail:
        "Web OAuth client with redirect URIs for https://atlasnow.co and localhost. Paste Client ID & Secret in Settings → API Configuration.",
      done: oauthConfigured,
      href: "/settings/api",
      hrefLabel: "Open API Configuration",
    },
    {
      id: "connect",
      title: "Connect agency Google account",
      detail:
        "Click Connect Google and sign in with the agency account that is manager/owner on client Business Profiles (GBP Agency model — not each client's Gmail).",
      done: liveConnected,
    },
    {
      id: "sync",
      title: "Sync & map locations",
      detail:
        "Refresh list to pull live locations, then Map locations or Auto-map by store code so each Google listing links to an Atlas location under the right client.",
      done: hasSynced && hasMapped,
      href: hasSynced ? "/data-health/map" : undefined,
      hrefLabel: "Map locations",
    },
  ];

  return NextResponse.json({
    oauthConfigured,
    mockPreferred: false,
    appBaseUrl,
    productionOrigin,
    productionRedirectUri,
    redirectUri,
    redirectUris,
    connector: connector
      ? {
          id: connector.id,
          status: connector.status,
          mode: connector.mode,
          accountEmail: connector.accountEmail,
          displayName: connector.displayName,
          lastSyncAt: connector.lastSyncAt,
          lastError: connector.lastError,
        }
      : null,
    stats: {
      remoteCount,
      mappedCount,
      locationCount,
      unmappedRemote: Math.max(0, remoteCount - mappedCount),
      unmappedLocal: Math.max(0, locationCount - mappedCount),
    },
    recentRuns,
    setup,
  });
}
