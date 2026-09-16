import { NextResponse } from "next/server";
import {
  buildGoogleIdentityAuthUrl,
  googleIdentityConfigured,
  newIdentityState,
  oauthFailRedirect,
} from "@/lib/signup-oauth";
import { resolvedAppBaseUrl } from "@/lib/integrations/service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = await resolvedAppBaseUrl();
  if (url.searchParams.get("terms") !== "1") {
    return NextResponse.redirect(oauthFailRedirect(base, "terms_required"));
  }
  if (!(await googleIdentityConfigured())) {
    return NextResponse.redirect(oauthFailRedirect(base, "google_not_configured"));
  }
  try {
    const dest = await buildGoogleIdentityAuthUrl(
      newIdentityState(
        "google",
        url.searchParams.get("phone"),
        url.searchParams.get("group") === "1"
      )
    );
    return NextResponse.redirect(dest);
  } catch {
    return NextResponse.redirect(oauthFailRedirect(base, "google_not_configured"));
  }
}
