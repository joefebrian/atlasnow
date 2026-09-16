import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { readSession, writeAudit } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { resolvedAppBaseUrl, resolvedMetaApp } from "@/lib/integrations/service";
import { buildMetaAuthUrl, oauthStateEncode } from "@/lib/meta/oauth";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    const origin = (await resolvedAppBaseUrl()).replace(/\/$/, "");
    return NextResponse.redirect(new URL("/login", origin));
  }

  const meta = await resolvedMetaApp();
  if (!meta.configured) {
    return NextResponse.json(
      {
        error:
          "Meta App not configured. Agency: Settings → API → Meta (App ID + Secret).",
        settings: "/settings/api",
      },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const clientParam = url.searchParams.get("client");
  const tenantId = session.isAgencyStaff
    ? clientParam
    : session.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Pick a client first (agency) or log in as the client." },
      { status: 400 }
    );
  }
  if (!(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const state = oauthStateEncode({
    tenantId,
    userId: session.userId,
    nonce: randomBytes(8).toString("hex"),
  });

  await writeAudit({
    tenantId,
    actorId: session.userId,
    action: "META_OAUTH_START",
    objectType: "connector",
    objectId: tenantId,
  });

  const dest = await buildMetaAuthUrl(state);
  return NextResponse.redirect(dest);
}
