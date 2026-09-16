import {
  googleMockPreferred,
  googleMockPreferredAsync,
  googleOAuthConfigured,
  googleOAuthConfiguredAsync,
  googleRedirectUriAsync,
  GOOGLE_SCOPES,
} from "@/lib/google/config";
import { decryptSecret, encryptSecret } from "@/lib/google/crypto";
import { prisma } from "@/lib/db";
import { resolvedGoogleOAuth } from "@/lib/integrations/service";

export type OAuthTokenSet = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  email?: string | null;
  scopes?: string | null;
};

export async function buildGoogleAuthUrl(state: string): Promise<string> {
  const o = await resolvedGoogleOAuth();
  if (!o.configured) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured (Settings → API)");
  }
  const redirectUri = await googleRedirectUriAsync();
  const params = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<OAuthTokenSet> {
  const o = await resolvedGoogleOAuth();
  const redirectUri = await googleRedirectUriAsync();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: o.clientId,
      client_secret: o.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Token exchange failed");
  }

  let email: string | null = null;
  try {
    const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (ui.ok) {
      const u = (await ui.json()) as { email?: string };
      email = u.email || null;
    }
  } catch {
    /* optional */
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
    email,
    scopes: data.scope || GOOGLE_SCOPES,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet> {
  const o = await resolvedGoogleOAuth();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: o.clientId,
      client_secret: o.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Refresh failed");
  }
  return {
    accessToken: data.access_token,
    refreshToken,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
    scopes: data.scope || null,
  };
}

export async function persistConnectorTokens(
  connectorId: string,
  tokens: OAuthTokenSet,
  mode: "LIVE" | "MOCK" = "LIVE"
) {
  return prisma.connector.update({
    where: { id: connectorId },
    data: {
      status: "CONNECTED",
      mode,
      accessTokenEnc: encryptSecret(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken
        ? encryptSecret(tokens.refreshToken)
        : undefined,
      tokenExpiresAt: tokens.expiresAt || null,
      accountEmail: tokens.email || undefined,
      scopes: tokens.scopes || undefined,
      lastError: null,
      displayName: tokens.email
        ? `Google · ${tokens.email}`
        : mode === "MOCK"
          ? "Google Business Profile (Mock)"
          : "Google Business Profile",
    },
  });
}

/** Return a valid access token, refreshing if needed. */
export async function getValidAccessToken(connectorId: string): Promise<string | null> {
  const c = await prisma.connector.findUnique({ where: { id: connectorId } });
  if (!c?.accessTokenEnc) return null;
  if (c.mode === "MOCK") return "mock-access-token";

  const expires = c.tokenExpiresAt?.getTime() || 0;
  const stillValid = expires > Date.now() + 60_000;
  if (stillValid) {
    return decryptSecret(c.accessTokenEnc);
  }

  if (!c.refreshTokenEnc || !(await googleOAuthConfiguredAsync())) {
    return decryptSecret(c.accessTokenEnc);
  }

  try {
    const refresh = decryptSecret(c.refreshTokenEnc);
    const tokens = await refreshAccessToken(refresh);
    await persistConnectorTokens(connectorId, {
      ...tokens,
      email: c.accountEmail,
    });
    return tokens.accessToken;
  } catch (e) {
    await prisma.connector.update({
      where: { id: connectorId },
      data: {
        status: "ERROR",
        lastError: e instanceof Error ? e.message : "Token refresh failed",
      },
    });
    return null;
  }
}

export function oauthStateEncode(payload: {
  tenantId: string;
  userId: string;
  nonce: string;
}): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function oauthStateDecode(state: string): {
  tenantId: string;
  userId: string;
  nonce: string;
} | null {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export {
  googleMockPreferred,
  googleMockPreferredAsync,
  googleOAuthConfigured,
  googleOAuthConfiguredAsync,
};
