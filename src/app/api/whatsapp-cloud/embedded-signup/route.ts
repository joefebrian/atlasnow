import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { finishEmbeddedSignup, parseEsSession } from "@/lib/conversations/embedded-signup";
import { parseConnectionMode } from "@/lib/conversations/es-launch";
import { isPhoneOwnershipError } from "@/lib/waba/service-quota";
import { logAppError } from "@/lib/error-log";

const ES_ERRORS: Record<string, string> = {
  coexistence_disabled:
    "Coexistence onboarding stays off until AtlasNow verifies it with an eligible WhatsApp Business App number. Connect via WhatsApp Cloud API, or retry after that launch is enabled.",
  not_business_app:
    "Meta did not confirm this number is on the WhatsApp Business App. Meta decides eligibility. Retry, or connect a dedicated Cloud API number. AtlasNow will not delete or migrate the WhatsApp account.",
  use_coexistence_option:
    "This number is on the WhatsApp Business App. Choose Use Existing WhatsApp Business App. AtlasNow will not register it as an API-only number.",
  cancelled: "WhatsApp connect was cancelled.",
};

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client");
  const tenantId = session.isAgencyStaff ? clientId : session.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Pick a brand first." }, { status: 400 });
  if (!(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { code?: string; session?: unknown; mode?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const code = (body.code || "").trim();
  if (!code) return NextResponse.json({ error: "Missing Embedded Signup code." }, { status: 400 });
  const parsed = parseEsSession(body.session);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await finishEmbeddedSignup({
      tenantId,
      code,
      session: parsed,
      requestedMode: parseConnectionMode(body.mode),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "embedded_signup_failed";
    const message = isPhoneOwnershipError(e)
      ? "This WhatsApp number is already connected to another workspace."
      : ES_ERRORS[raw] || raw;
    const status = isPhoneOwnershipError(e) ? 409 : 400;
    await logAppError({
      source: "WhatsApp Embedded Signup",
      title: "ES v4 finish failed",
      detail: message,
    });
    return NextResponse.json({ error: message }, { status });
  }
}
