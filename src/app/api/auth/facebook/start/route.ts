import { NextResponse } from "next/server";
import { resolvedAppBaseUrl } from "@/lib/integrations/service";
import {
  buildFacebookIdentityAuthUrl,
  facebookIdentityConfigured,
  newIdentityState,
  oauthFailRedirect,
} from "@/lib/signup-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = await resolvedAppBaseUrl();
  if (url.searchParams.get("terms") !== "1") {
    return NextResponse.redirect(oauthFailRedirect(base, "terms_required"));
  }
  if (!(await facebookIdentityConfigured())) {
    return NextResponse.redirect(oauthFailRedirect(base, "facebook_not_configured"));
  }
  try {
    const dest = await buildFacebookIdentityAuthUrl(
      newIdentityState(
        "facebook",
        url.searchParams.get("phone"),
        url.searchParams.get("group") === "1"
      )
    );
    return NextResponse.redirect(dest);
  } catch {
    return NextResponse.redirect(oauthFailRedirect(base, "facebook_not_configured"));
  }
}
