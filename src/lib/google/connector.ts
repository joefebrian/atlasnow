import { prisma } from "@/lib/db";
import { connectorUnique } from "@/lib/connectors/key";
import { GOOGLE_PROVIDER } from "@/lib/google/config";
import { encryptSecret } from "@/lib/google/crypto";

/** Ensure agency has a Google Business Profile connector row. */
export async function getOrCreateAgencyGoogleConnector(agencyTenantId: string) {
  return prisma.connector.upsert({
    where: connectorUnique(agencyTenantId, GOOGLE_PROVIDER),
    create: {
      tenantId: agencyTenantId,
      provider: GOOGLE_PROVIDER,
      status: "DISCONNECTED",
      displayName: "Google Business Profile",
      mode: "LIVE",
    },
    update: {},
  });
}

export async function connectMockGoogle(agencyTenantId: string) {
  const connector = await getOrCreateAgencyGoogleConnector(agencyTenantId);
  return prisma.connector.update({
    where: { id: connector.id },
    data: {
      status: "CONNECTED",
      mode: "MOCK",
      accountEmail: "agency-mock@p2plabs.local",
      displayName: "Google Business Profile (Mock)",
      accessTokenEnc: encryptSecret("mock-access-token"),
      refreshTokenEnc: encryptSecret("mock-refresh-token"),
      tokenExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      scopes: "https://www.googleapis.com/auth/business.manage",
      lastError: null,
    },
  });
}

export async function getAgencyTenant() {
  return prisma.tenant.findFirst({
    where: { type: "AGENCY", status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
}
