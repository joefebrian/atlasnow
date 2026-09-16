import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/auth";
import {
  exchangeCodeForTokens,
  oauthStateDecode,
  persistConnectorTokens,
} from "@/lib/google/oauth";
import { getOrCreateAgencyGoogleConnector } from "@/lib/google/connector";
import { syncRemoteLocations } from "@/lib/google/business-info";
import { appBaseUrl } from "@/lib/google/config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const base = appBaseUrl();
  const fail = (msg: string) =>
    NextResponse.redirect(
      `${base}/settings/google?google=error&msg=${encodeURIComponent(msg)}`
    );

  if (err) return fail(err);
  if (!code || !state) return fail("Missing code/state");

  const decoded = oauthStateDecode(state);
  if (!decoded?.tenantId) return fail("Invalid OAuth state");

  try {
    const tokens = await exchangeCodeForTokens(code);
    const connector = await getOrCreateAgencyGoogleConnector(decoded.tenantId);
    await persistConnectorTokens(connector.id, tokens, "LIVE");

    try {
      await syncRemoteLocations(connector.id);
    } catch (e) {
      // Connected but list failed — still OK, show error on Data Health
      console.warn("[oauth callback] list failed", e);
    }

    await writeAudit({
      tenantId: decoded.tenantId,
      actorId: decoded.userId,
      action: "GOOGLE_OAUTH_SUCCESS",
      objectType: "connector",
      objectId: connector.id,
      meta: { email: tokens.email },
    });

    return NextResponse.redirect(`${base}/settings/google?google=connected`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "OAuth failed");
  }
}
