import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAgencySession, writeAudit } from "@/lib/auth";
import {
  buildGoogleAuthUrl,
  googleOAuthConfiguredAsync,
  oauthStateEncode,
} from "@/lib/google/oauth";
import { getAgencyTenant, getOrCreateAgencyGoogleConnector } from "@/lib/google/connector";

export async function GET() {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  if (!(await googleOAuthConfiguredAsync())) {
    return NextResponse.json(
      {
        error:
          "Google OAuth not configured. Set Client ID & Secret in Settings → API Configuration (Google Business Profile), then try Connect Google again.",
        settings: "/settings/api",
      },
      { status: 400 }
    );
  }

  const agency = await getAgencyTenant();
  if (!agency) {
    return NextResponse.json({ error: "Agency tenant missing — re-seed DB" }, { status: 500 });
  }

  await getOrCreateAgencyGoogleConnector(agency.id);

  const state = oauthStateEncode({
    tenantId: agency.id,
    userId: session.userId,
    nonce: randomBytes(8).toString("hex"),
  });

  await writeAudit({
    tenantId: agency.id,
    actorId: session.userId,
    action: "GOOGLE_OAUTH_START",
    objectType: "connector",
    objectId: agency.id,
  });

  const url = await buildGoogleAuthUrl(state);
  return NextResponse.redirect(url);
}
