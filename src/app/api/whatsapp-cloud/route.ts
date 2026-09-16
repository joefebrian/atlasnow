import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { META_GRAPH } from "@/lib/meta/oauth";
import {
  disconnectCloudHq,
  getCloudHqConfig,
  saveCloudHqConnector,
} from "@/lib/conversations/cloud-hq";
import { resolvedMetaApp } from "@/lib/integrations/service";
import {
  patchWabaPhoneOps,
  serviceQuotaForTenant,
} from "@/lib/waba/service-quota";

async function targetTenant(request: Request, session: Awaited<ReturnType<typeof readSession>>) {
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client");
  const tenantId = session.isAgencyStaff ? clientId : session.tenantId;
  if (!tenantId) {
    return { error: NextResponse.json({ error: "Pick a brand first." }, { status: 400 }) };
  }
  if (!(await canAccessTenant(session, tenantId))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, tenantId };
}

export async function GET(request: Request) {
  const scoped = await targetTenant(request, await readSession());
  if ("error" in scoped) return scoped.error;
  const cfg = await getCloudHqConfig(scoped.tenantId);
  const quota = await serviceQuotaForTenant(scoped.tenantId, cfg);
  const meta = await resolvedMetaApp();
  return NextResponse.json({
    connected: Boolean(cfg),
    phoneNumberId: cfg?.phoneNumberId || null,
    wabaId: cfg?.wabaId || null,
    displayPhone: cfg?.displayPhone || null,
    webhookUrl: "https://atlasnow.co/api/webhooks/whatsapp",
    canEditOps: scoped.session.isPlatformAdmin,
    quota,
    es: {
      appId: meta.appId || null,
      configId: meta.whatsappEsConfigId || null,
      ready: Boolean(meta.appId && meta.whatsappEsConfigId && meta.configured),
    },
  });
}

export async function POST(request: Request) {
  const scoped = await targetTenant(request, await readSession());
  if ("error" in scoped) return scoped.error;
  let body: { phoneNumberId?: string; wabaId?: string; accessToken?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const phoneNumberId = (body.phoneNumberId || "").trim();
  const wabaId = (body.wabaId || "").trim();
  const accessToken = (body.accessToken || "").trim();
  if (!phoneNumberId || !accessToken) {
    return NextResponse.json(
      { error: "Phone number ID and access token are required." },
      { status: 400 }
    );
  }

  const check = await fetch(
    `${META_GRAPH}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    }
  );
  const info = (await check.json().catch(() => ({}))) as {
    display_phone_number?: string;
    verified_name?: string;
    error?: { message?: string };
  };
  if (!check.ok) {
    return NextResponse.json(
      { error: info.error?.message || "Cloud API rejected this token / phone number ID." },
      { status: 400 }
    );
  }

  await saveCloudHqConnector({
    tenantId: scoped.tenantId,
    phoneNumberId,
    wabaId,
    accessToken,
    displayPhone: info.display_phone_number || null,
    verifiedName: info.verified_name || null,
  });
  return NextResponse.json({
    ok: true,
    displayPhone: info.display_phone_number || null,
    verifiedName: info.verified_name || null,
  });
}

export async function PATCH(request: Request) {
  const scoped = await targetTenant(request, await readSession());
  if ("error" in scoped) return scoped.error;
  if (!scoped.session.isPlatformAdmin) {
    return NextResponse.json({ error: "Only Super Admin can tick WABA billing ops." }, { status: 403 });
  }
  const cfg = await getCloudHqConfig(scoped.tenantId);
  if (!cfg) return NextResponse.json({ error: "Connect HQ WhatsApp first." }, { status: 400 });
  let body: { paymentMethodOk?: boolean; billingOwner?: "BRAND" | "P2P" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  await patchWabaPhoneOps(cfg.phoneNumberId, body);
  const quota = await serviceQuotaForTenant(scoped.tenantId, cfg);
  return NextResponse.json({ ok: true, quota });
}

export async function DELETE(request: Request) {
  const scoped = await targetTenant(request, await readSession());
  if ("error" in scoped) return scoped.error;
  await disconnectCloudHq(scoped.tenantId);
  return NextResponse.json({ ok: true });
}
