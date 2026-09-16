import { NextResponse } from "next/server";
import { attachSessionCookie, createSessionForUserId, writeAudit } from "@/lib/auth";
import { resolvedAppBaseUrl } from "@/lib/integrations/service";
import { loginOrRegisterOAuth } from "@/lib/signup";
import { defaultHomePath } from "@/lib/tenancy";
import {
  exchangeGoogleIdentityCode,
  oauthFailRedirect,
  oauthPendingRedirect,
  verifyIdentityState,
} from "@/lib/signup-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = await resolvedAppBaseUrl();
  const fail = (code: string) => NextResponse.redirect(oauthFailRedirect(base, code));

  const err = url.searchParams.get("error");
  if (err) return fail(err === "access_denied" ? "oauth_denied" : "oauth_failed");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("oauth_failed");
  const decoded = verifyIdentityState(state, "google");
  if (!decoded) return fail("oauth_failed");

  try {
    const profile = await exchangeGoogleIdentityCode(code);
    const result = await loginOrRegisterOAuth({
      email: profile.email,
      name: profile.name,
      phone: decoded.p,
      method: "google",
      acceptTerms: true,
      kind: "brand",
      wantsGroup: decoded.g === 1,
    });
    await writeAudit({
      tenantId: result.tenantId,
      actorId: result.userId,
      action: result.created ? "SIGNUP" : "LOGIN",
      objectType: "user",
      objectId: result.userId,
      meta: { method: "google", terms: true, pending: result.created },
    });
    const session = await createSessionForUserId(result.userId);
    if (!session) {
      return NextResponse.redirect(oauthPendingRedirect(base, profile.name));
    }
    const dest = NextResponse.redirect(`${base.replace(/\/$/, "")}${defaultHomePath(session)}`);
    await attachSessionCookie(dest, session);
    return dest;
  } catch (e) {
    const codeName =
      e && typeof e === "object" && "code" in e
        ? String((e as { code?: string }).code)
        : e instanceof Error
          ? e.message
          : "oauth_failed";
    const known = [
      "terms_required",
      "email_required",
      "account_disabled",
      "no_workspace",
      "too_many",
      "google_not_configured",
      "phone_required",
    ];
    return fail(known.includes(codeName) ? codeName : "oauth_failed");
  }
}
