const TOKEN_URL = "https://open.tiktokapis.com/merchant/oauth/token/";

export type GoTokenBundle = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | null;
  refreshExpiresAt: Date | null;
};

function unixToDate(v: unknown): Date | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 1e12 ? n : n * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readBundle(json: Record<string, unknown>): GoTokenBundle {
  const data = (json.data && typeof json.data === "object" ? json.data : json) as Record<string, unknown>;
  const accessToken = String(data.access_token || "").trim();
  if (!accessToken) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message || "TikTok did not return a merchant token. Has this merchant accepted AtlasNow in Merchant Portal?");
  }
  return {
    accessToken,
    refreshToken: String(data.refresh_token || "").trim(),
    expiresAt: unixToDate(data.expires_in),
    refreshExpiresAt: unixToDate(data.refresh_expires_in),
  };
}

async function postToken(body: URLSearchParams): Promise<GoTokenBundle> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(
      err?.message ||
        "TikTok refused the token. Confirm Merchant Portal → Application authorization accepted AtlasNow."
    );
  }
  return readBundle(json);
}

export async function fetchGoMerchantToken(opts: {
  clientKey: string;
  clientSecret: string;
  merchantId: string;
}): Promise<GoTokenBundle> {
  const body = new URLSearchParams();
  body.set("client_key", opts.clientKey);
  body.set("client_secret", opts.clientSecret);
  body.set("grant_type", "access_token");
  body.set("merchant_id", opts.merchantId);
  return postToken(body);
}

export async function refreshGoMerchantToken(opts: {
  clientKey: string;
  clientSecret: string;
  merchantId: string;
  refreshToken: string;
}): Promise<GoTokenBundle> {
  const body = new URLSearchParams();
  body.set("client_key", opts.clientKey);
  body.set("client_secret", opts.clientSecret);
  body.set("grant_type", "refresh_token");
  body.set("merchant_id", opts.merchantId);
  body.set("refresh_token", opts.refreshToken);
  return postToken(body);
}

export function tokenNeedsRefresh(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= Date.now() + 60_000;
}
