import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/google/crypto";
import { resolveIntegrationValues } from "@/lib/integrations/service";
import { resolvedTikTokApp } from "@/lib/tiktok/config";
import {
  fetchGoMerchantToken,
  refreshGoMerchantToken,
  tokenNeedsRefresh,
} from "@/lib/tiktok-go/oauth";

export const TIKTOK_GO_PROVIDER = "TIKTOK_GO";

type GoMeta = {
  merchantId?: string;
};

function parseMeta(raw: string | null | undefined): GoMeta {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as GoMeta;
  } catch {
    return {};
  }
}

export async function getGoConnector(tenantId: string) {
  return prisma.connector.findUnique({
    where: { tenantId_provider_accountKey: { tenantId, provider: TIKTOK_GO_PROVIDER, accountKey: "" } },
  });
}

export function goMerchantIdOf(row: { metaJson: string | null } | null): string {
  return (parseMeta(row?.metaJson).merchantId || "").trim();
}

export async function saveGoMerchantId(tenantId: string, merchantId: string) {
  const id = merchantId.trim();
  const existing = await getGoConnector(tenantId);
  const meta = { ...parseMeta(existing?.metaJson), merchantId: id };
  return prisma.connector.upsert({
    where: { tenantId_provider_accountKey: { tenantId, provider: TIKTOK_GO_PROVIDER, accountKey: "" } },
    create: {
      tenantId,
      provider: TIKTOK_GO_PROVIDER,
      status: "PENDING",
      displayName: "TikTok GO",
      mode: "LIVE",
      metaJson: JSON.stringify(meta),
      lastError: null,
    },
    update: {
      displayName: "TikTok GO",
      metaJson: JSON.stringify(meta),
      lastError: null,
      status: existing?.accessTokenEnc ? "CONNECTED" : "PENDING",
    },
  });
}

export async function setGoDemoMode(tenantId: string, on: boolean) {
  const existing = await getGoConnector(tenantId);
  return prisma.connector.upsert({
    where: { tenantId_provider_accountKey: { tenantId, provider: TIKTOK_GO_PROVIDER, accountKey: "" } },
    create: {
      tenantId,
      provider: TIKTOK_GO_PROVIDER,
      status: on ? "CONNECTED" : "DISCONNECTED",
      displayName: "TikTok GO",
      mode: on ? "MOCK" : "LIVE",
      metaJson: JSON.stringify({ merchantId: "" }),
    },
    update: {
      mode: on ? "MOCK" : existing?.accessTokenEnc ? "LIVE" : "LIVE",
      status: on ? "CONNECTED" : existing?.accessTokenEnc ? "CONNECTED" : existing?.status || "DISCONNECTED",
      lastError: on ? null : existing?.lastError || null,
    },
  });
}

export async function persistGoTokens(
  tenantId: string,
  bundle: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date | null;
    refreshExpiresAt: Date | null;
  }
) {
  const existing = await getGoConnector(tenantId);
  const merchantId = goMerchantIdOf(existing);
  return prisma.connector.upsert({
    where: { tenantId_provider_accountKey: { tenantId, provider: TIKTOK_GO_PROVIDER, accountKey: "" } },
    create: {
      tenantId,
      provider: TIKTOK_GO_PROVIDER,
      status: "CONNECTED",
      displayName: "TikTok GO",
      mode: "LIVE",
      accessTokenEnc: encryptSecret(bundle.accessToken),
      refreshTokenEnc: bundle.refreshToken ? encryptSecret(bundle.refreshToken) : null,
      tokenExpiresAt: bundle.expiresAt,
      metaJson: JSON.stringify({ merchantId }),
      lastError: null,
    },
    update: {
      status: "CONNECTED",
      mode: "LIVE",
      accessTokenEnc: encryptSecret(bundle.accessToken),
      refreshTokenEnc: bundle.refreshToken ? encryptSecret(bundle.refreshToken) : existing?.refreshTokenEnc,
      tokenExpiresAt: bundle.expiresAt,
      lastError: null,
    },
  });
}

export async function markGoError(tenantId: string, message: string) {
  const existing = await getGoConnector(tenantId);
  if (!existing) return;
  await prisma.connector.update({
    where: { id: existing.id },
    data: { lastError: message.slice(0, 500) },
  });
}

export async function disconnectGo(tenantId: string) {
  await prisma.connector.deleteMany({
    where: { tenantId, provider: TIKTOK_GO_PROVIDER },
  });
}

export async function exchangeGoToken(tenantId: string) {
  const app = await resolvedTikTokApp();
  if (!app.configured) {
    throw new Error("Paste the AtlasNow TikTok client key and secret in Settings → API first.");
  }
  const row = await getGoConnector(tenantId);
  const merchantId = goMerchantIdOf(row);
  if (!merchantId) throw new Error("Paste the TikTok GO merchant ID first.");
  const bundle = await fetchGoMerchantToken({
    clientKey: app.clientKey,
    clientSecret: app.clientSecret,
    merchantId,
  });
  await persistGoTokens(tenantId, bundle);
  return bundle;
}

async function liveFromConnector(tenantId: string): Promise<{
  merchantId: string;
  accessToken: string;
} | null> {
  const row = await getGoConnector(tenantId);
  if (!row?.accessTokenEnc) return null;
  const merchantId = goMerchantIdOf(row);
  if (!merchantId) return null;
  let access = decryptSecret(row.accessTokenEnc);
  if (tokenNeedsRefresh(row.tokenExpiresAt) && row.refreshTokenEnc) {
    try {
      const app = await resolvedTikTokApp();
      if (app.configured) {
        const bundle = await refreshGoMerchantToken({
          clientKey: app.clientKey,
          clientSecret: app.clientSecret,
          merchantId,
          refreshToken: decryptSecret(row.refreshTokenEnc),
        });
        await persistGoTokens(tenantId, bundle);
        access = bundle.accessToken;
      }
    } catch (e) {
      await markGoError(tenantId, e instanceof Error ? e.message : "Token refresh failed");
    }
  }
  return { merchantId, accessToken: access };
}

async function liveFromPlatform(): Promise<{ merchantId: string; accessToken: string } | null> {
  const v = await resolveIntegrationValues("tiktok_go");
  const merchantId = (v.public.merchantId || "").trim();
  const accessToken = (v.secrets.accessToken || "").trim();
  if (!merchantId || !accessToken) return null;
  return { merchantId, accessToken };
}

export async function resolvedTikTokGoForTenant(tenantId: string): Promise<{
  configured: boolean;
  demo: boolean;
  merchantId: string;
  accessToken: string;
  status: string;
  lastError: string | null;
}> {
  const row = await getGoConnector(tenantId);
  const demo = row?.mode === "MOCK";
  const live = (await liveFromConnector(tenantId)) || (await liveFromPlatform());
  return {
    configured: Boolean(live),
    demo: Boolean(demo),
    merchantId: live?.merchantId || goMerchantIdOf(row),
    accessToken: live?.accessToken || "",
    status: row?.status || (live ? "CONNECTED" : "DISCONNECTED"),
    lastError: row?.lastError || null,
  };
}
