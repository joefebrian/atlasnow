import { resolvedTikTokGoForTenant } from "@/lib/tiktok-go/connector";

/** @deprecated Use resolvedTikTokGoForTenant — GO is per brand, not global. */
export async function resolvedTikTokGo(tenantId?: string): Promise<{
  configured: boolean;
  merchantId: string;
  accessToken: string;
}> {
  if (!tenantId) {
    return { configured: false, merchantId: "", accessToken: "" };
  }
  const v = await resolvedTikTokGoForTenant(tenantId);
  return {
    configured: v.configured,
    merchantId: v.merchantId,
    accessToken: v.accessToken,
  };
}
