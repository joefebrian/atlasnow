import { resolvedAppBaseUrl, resolvedMetaApp } from "@/lib/integrations/service";

export const META_GRAPH = "https://graph.facebook.com/v21.0";
/** Messenger + Instagram Messaging (Page-linked IG). App Review needed for public users. */
export const META_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "business_management",
  "instagram_basic",
  "instagram_manage_messages",
].join(",");

/** Page subscribed_apps fields — messaging only, not comments or insights. */
export const PAGE_WEBHOOK_FIELDS =
  "messages,messaging_postbacks,message_echoes,messaging_optins";
export const IG_WEBHOOK_FIELDS = "messages,messaging_postbacks";

export async function metaRedirectUri(): Promise<string> {
  const m = await resolvedMetaApp();
  if (m.redirectUri) return m.redirectUri.replace(/\/$/, "");
  const base = await resolvedAppBaseUrl();
  return `${base}/api/meta/oauth/callback`;
}

export async function buildMetaAuthUrl(state: string): Promise<string> {
  const m = await resolvedMetaApp();
  if (!m.configured) throw new Error("Meta App ID / Secret not set (Settings → API)");
  const redirectUri = await metaRedirectUri();
  const params = new URLSearchParams({
    client_id: m.appId,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
  });
  if (m.loginConfigId) {
    params.set("config_id", m.loginConfigId);
    params.set("override_default_response_type", "true");
  } else {
    params.set("scope", META_SCOPES);
  }
  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}

export async function exchangeMetaCode(code: string): Promise<{
  accessToken: string;
  expiresAt: Date | null;
}> {
  const m = await resolvedMetaApp();
  const redirectUri = await metaRedirectUri();
  const shortUrl = new URL(`${META_GRAPH}/oauth/access_token`);
  shortUrl.searchParams.set("client_id", m.appId);
  shortUrl.searchParams.set("client_secret", m.appSecret);
  shortUrl.searchParams.set("redirect_uri", redirectUri);
  shortUrl.searchParams.set("code", code);
  const shortRes = await fetch(shortUrl);
  const short = (await shortRes.json()) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!shortRes.ok || !short.access_token) {
    throw new Error(short.error?.message || "Meta token exchange failed");
  }

  const longUrl = new URL(`${META_GRAPH}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", m.appId);
  longUrl.searchParams.set("client_secret", m.appSecret);
  longUrl.searchParams.set("fb_exchange_token", short.access_token);
  const longRes = await fetch(longUrl);
  const long = (await longRes.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  const token = long.access_token || short.access_token;
  const expiresAt =
    typeof long.expires_in === "number"
      ? new Date(Date.now() + long.expires_in * 1000)
      : null;
  return { accessToken: token, expiresAt };
}

export type MetaPageAsset = {
  id: string;
  name: string;
  accessToken: string;
  instagram?: { id: string; username: string } | null;
};

export async function listMetaPages(userToken: string): Promise<MetaPageAsset[]> {
  const url = new URL(`${META_GRAPH}/me/accounts`);
  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id,username}"
  );
  url.searchParams.set("access_token", userToken);
  const res = await fetch(url);
  const data = (await res.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string; username?: string };
    }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(data.error?.message || "Could not list Facebook Pages");
  return (data.data || [])
    .filter((p) => p.id && p.access_token)
    .map((p) => ({
      id: p.id as string,
      name: p.name || p.id || "",
      accessToken: p.access_token as string,
      instagram: p.instagram_business_account?.id
        ? {
            id: p.instagram_business_account.id,
            username: p.instagram_business_account.username || "",
          }
        : null,
    }));
}

export async function subscribePageToApp(pageId: string, pageToken: string): Promise<void> {
  const url = new URL(`${META_GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", PAGE_WEBHOOK_FIELDS);
  url.searchParams.set("access_token", pageToken);
  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(data.error?.message || `Subscribe failed (${res.status})`);
  }
}

/** Instagram Messaging webhook on the IG professional account (Page-linked). */
export async function subscribeInstagramToApp(igId: string, pageToken: string): Promise<void> {
  const url = new URL(`${META_GRAPH}/${encodeURIComponent(igId)}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", IG_WEBHOOK_FIELDS);
  url.searchParams.set("access_token", pageToken);
  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(data.error?.message || `IG subscribe failed (${res.status})`);
  }
}

export { oauthStateEncode, oauthStateDecode } from "@/lib/google/oauth";
