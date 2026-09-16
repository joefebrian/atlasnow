import {
  resolvedAppBaseUrl,
  resolveIntegrationValues,
} from "@/lib/integrations/service";

export async function tiktokWebhookUrl(): Promise<string> {
  const base = (await resolvedAppBaseUrl()).replace(/\/$/, "");
  return `${base}/api/webhooks/tiktok`;
}

export async function tiktokRedirectUri(): Promise<string> {
  const v = await resolveIntegrationValues("tiktok");
  const override = (v.public.redirectUri || "").replace(/\/$/, "");
  if (override) return override;
  const base = (await resolvedAppBaseUrl()).replace(/\/$/, "");
  return `${base}/api/tiktok/oauth/callback`;
}

export async function resolvedTikTokApp(): Promise<{
  configured: boolean;
  clientKey: string;
  clientSecret: string;
  webhookSecret: string;
  redirectUri: string;
  webhookUrl: string;
}> {
  const v = await resolveIntegrationValues("tiktok");
  const clientKey = (v.public.clientKey || "").trim();
  const clientSecret = (v.secrets.clientSecret || "").trim();
  const webhookSecret = (v.secrets.webhookSecret || "").trim();
  const [redirectUri, webhookUrl] = await Promise.all([
    tiktokRedirectUri(),
    tiktokWebhookUrl(),
  ]);
  return {
    configured: Boolean(clientKey && clientSecret),
    clientKey,
    clientSecret,
    webhookSecret,
    redirectUri,
    webhookUrl,
  };
}
