import { NextResponse } from "next/server";
import { readSession, writeAudit } from "@/lib/auth";
import { resolvedAppBaseUrl } from "@/lib/integrations/service";
import { exchangeMetaCode, listMetaPages, oauthStateDecode } from "@/lib/meta/oauth";
import { upsertMetaConnector } from "@/lib/meta/service";

export async function GET(request: Request) {
  const session = await readSession();
  const url = new URL(request.url);
  const err = url.searchParams.get("error_description") || url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state") || "";
  const state = oauthStateDecode(stateRaw);
  const origin = (await resolvedAppBaseUrl()).replace(/\/$/, "");
  const back = new URL("/settings/chat-apps", origin);
  if (state?.tenantId) back.searchParams.set("client", state.tenantId);

  if (!session) {
    return NextResponse.redirect(new URL("/login", origin));
  }
  if (err) {
    back.searchParams.set("meta_error", err);
    return NextResponse.redirect(back);
  }
  if (!code || !state) {
    back.searchParams.set("meta_error", "Missing OAuth code");
    return NextResponse.redirect(back);
  }
  if (!session.isAgencyStaff && session.tenantId !== state.tenantId) {
    back.searchParams.set("meta_error", "Tenant mismatch");
    return NextResponse.redirect(back);
  }

  try {
    const tokens = await exchangeMetaCode(code);
    const pages = await listMetaPages(tokens.accessToken);
    await upsertMetaConnector(state.tenantId, {
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
      pages,
    });
    await writeAudit({
      tenantId: state.tenantId,
      actorId: session.userId,
      action: "META_OAUTH_CONNECTED",
      objectType: "connector",
      objectId: state.tenantId,
      meta: { pages: pages.map((p) => p.id) },
    });
    back.searchParams.set("meta", "connected");
    return NextResponse.redirect(back);
  } catch (e) {
    back.searchParams.set(
      "meta_error",
      e instanceof Error ? e.message : "Meta connect failed"
    );
    return NextResponse.redirect(back);
  }
}
