import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { authorizeMarketing, readAutomationSettings, saveAutomationSettings } from "@/lib/commerce-automation/settings";
import { canAccessTenant } from "@/lib/locations/access";

async function targetTenant(request: Request) {
  const session = await readSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const clientId = new URL(request.url).searchParams.get("client");
  const tenantId = session.isAgencyStaff ? clientId : session.tenantId;
  if (!tenantId) return { error: NextResponse.json({ error: "Pick a workspace first." }, { status: 400 }) };
  if (!(await canAccessTenant(session, tenantId))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, tenantId };
}

export async function GET(request: Request) {
  const scoped = await targetTenant(request);
  if ("error" in scoped) return scoped.error;
  return NextResponse.json(await readAutomationSettings(scoped.tenantId));
}

export async function POST(request: Request) {
  const scoped = await targetTenant(request);
  if ("error" in scoped) return scoped.error;
  let body: {
    action?: string;
    inboundEnabled?: boolean;
    paymentFollowUpEnabled?: boolean;
    marketingEnabled?: boolean;
    pilotMode?: boolean;
    flowId?: string;
    flowScreen?: string;
    flowCta?: string;
    inboundBody?: string;
    triggerPhrases?: string;
    paymentTriggerPhrases?: string;
    paymentMessageText?: string;
    allowlist?: string[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.action === "authorize_marketing") {
    const result = await authorizeMarketing({ tenantId: scoped.tenantId, actorUserId: scoped.session.userId });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await readAutomationSettings(scoped.tenantId)) });
  }
  const result = await saveAutomationSettings({
    tenantId: scoped.tenantId,
    actorUserId: scoped.session.userId,
    allowlist: Array.isArray(body.allowlist) ? body.allowlist : undefined,
    patch: {
      inboundEnabled: body.inboundEnabled === true,
      paymentFollowUpEnabled: body.paymentFollowUpEnabled === true,
      marketingEnabled: body.marketingEnabled === true,
      pilotMode: body.pilotMode !== false,
      flowId: body.flowId || "",
      flowScreen: body.flowScreen || "",
      flowCta: body.flowCta || "",
      inboundBody: body.inboundBody || "",
      triggerPhrases: body.triggerPhrases || "",
      paymentTriggerPhrases: body.paymentTriggerPhrases || "",
      paymentMessageText: body.paymentMessageText || "",
    },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, ...(await readAutomationSettings(scoped.tenantId)) });
}
