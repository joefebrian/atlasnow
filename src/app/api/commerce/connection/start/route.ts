import { NextResponse } from "next/server";
import { readSessionToken } from "@/lib/auth";
import { guardCommerce } from "@/lib/commerce/guard";
import { buildCommerceAuthUrl, commerceSessionKey, issueCommerceState } from "@/lib/commerce/meta-oauth";
import { resolvedAppBaseUrl } from "@/lib/integrations/service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const guard = await guardCommerce({ write: true, tenantId: url.searchParams.get("tenantId") });
  const base = (await resolvedAppBaseUrl()).replace(/\/$/, "");
  const back = new URL("/commerce", base);
  if (guard.ok && guard.session.isAgencyStaff) back.searchParams.set("client", guard.tenantId);
  if (!guard.ok) return NextResponse.redirect(new URL("/login", base));
  try {
    const state = await issueCommerceState({
      tenantId: guard.tenantId,
      userId: guard.session.userId,
      sessionKey: commerceSessionKey(await readSessionToken()),
    });
    const dest = await buildCommerceAuthUrl(state);
    return NextResponse.redirect(dest);
  } catch (error) {
    back.searchParams.set("commerceError", error instanceof Error ? error.message : "Meta connection could not start");
    return NextResponse.redirect(back);
  }
}
