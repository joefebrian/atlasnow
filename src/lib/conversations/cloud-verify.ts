import { resolvedMetaApp, resolveIntegrationValues } from "@/lib/integrations/service";

/** Webhook verify + HMAC secret: WhatsApp Cloud catalog, then Messenger app. */
export async function cloudWebhookSecrets(): Promise<{
  verifyToken: string;
  appSecret: string;
}> {
  const wa = await resolveIntegrationValues("meta_whatsapp");
  const meta = await resolvedMetaApp();
  const verifyToken =
    (wa.secrets.verifyToken || meta.verifyToken || "atlasnow-meta").trim();
  const appSecret = (wa.secrets.appSecret || meta.appSecret || "").trim();
  return { verifyToken, appSecret };
}
