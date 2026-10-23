import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { canWriteCommerce } from "@/lib/commerce/access";
import { saveCommerceToken } from "@/lib/commerce/connection-service";
import { decodeCommerceState, exchangeCommerceCode } from "@/lib/commerce/meta-oauth";
import { resolvedAppBaseUrl } from "@/lib/integrations/service";

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Meta connection failed";
  return message.replace(/EAA[A-Za-z0-9]+/g, "").slice(0, 180);
}

export async function GET(request: Request) {
  const base = (await resolvedAppBaseUrl()).replace(/\/$/, "");
  const url = new URL(request.url);
  const back = new URL("/commerce", base);
  const state = decodeCommerceState(url.searchParams.get("state") || "");
  if (state) back.searchParams.set("client", state.tenantId);
  const session = await readSession();
  if (!session || !canWriteCommerce(session) || !state || session.userId !== state.userId) {
    back.searchParams.set("commerceError", "The Meta connection expired. Start it again.");
    return NextResponse.redirect(back);
  }
  if (!(await canAccessTenant(session, state.tenantId))) {
    back.searchParams.set("commerceError", "That brand is not available on this login.");
    return NextResponse.redirect(back);
  }
  const code = url.searchParams.get("code");
  if (!code) {
    back.searchParams.set("commerceError", url.searchParams.get("error_reason") || "Meta did not return a connection");
    return NextResponse.redirect(back);
  }
  try {
    const exchanged = await exchangeCommerceCode(code);
    await saveCommerceToken({
      tenantId: state.tenantId,
      accessToken: exchanged.accessToken,
      expiresAt: exchanged.expiresAt,
      scopes: [],
      actorId: session.userId,
    });
    back.searchParams.set("commerce", "connected");
    return NextResponse.redirect(back);
  } catch (error) {
    back.searchParams.set("commerceError", safeError(error));
    return NextResponse.redirect(back);
  }
}
