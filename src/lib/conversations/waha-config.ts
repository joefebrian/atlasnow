import { resolveIntegrationValues } from "@/lib/integrations/service";

export async function isWahaIngestEnabled(): Promise<boolean> {
  const v = await resolveIntegrationValues("waha");
  if (!v.enabled) return false;
  if (v.mode === "OFF") return false;
  return true;
}

export async function getWahaWebhookKey(): Promise<string> {
  const v = await resolveIntegrationValues("waha");
  return (v.secrets.apiKey || "").trim();
}
