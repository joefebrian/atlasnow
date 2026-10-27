import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { sessionCanReadYola } from "@/lib/yola/access";
import { YOLA_SETUP } from "@/lib/yola/config";
import { saveVerifiedTemplate } from "@/lib/yola/engine";
import { fetchMarketingTemplates } from "@/lib/yola/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Graph read only. Does not create a template, edit a Flow, or send a message. */
export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let tenantId = session.tenantId;
  try {
    const body = (await request.json()) as { tenantId?: string };
    if (session.isAgencyStaff && body.tenantId) tenantId = body.tenantId;
  } catch {
    tenantId = session.tenantId;
  }
  if (!(await sessionCanReadYola(session, tenantId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await fetchMarketingTemplates();
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      status: "UNVERIFIED",
      reason: result.reason,
      setup: result.reason === "meta_api_unavailable" ? YOLA_SETUP.token : result.reason === "waba_unconfigured" ? YOLA_SETUP.waba : YOLA_SETUP.template,
    });
  }
  await saveVerifiedTemplate(tenantId, result.template);
  return NextResponse.json({
    ok: true,
    status: result.template.status,
    name: result.template.name,
    language: result.template.language,
    category: result.template.category,
    flowId: result.template.flowId,
    buttonIndex: result.template.buttonIndex,
    navigateScreen: result.template.navigateScreen,
  });
}
