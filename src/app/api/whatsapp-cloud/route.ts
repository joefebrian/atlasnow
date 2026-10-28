import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { META_GRAPH } from "@/lib/meta/oauth";
import {
  disconnectCloudHq,
  getCloudHqConfig,
  listWorkspaceWhatsAppNumbers,
  readCloudConnection,
  saveCloudHqConnector,
  WHATSAPP_CLOUD_PROVIDER,
} from "@/lib/conversations/cloud-hq";
import { effectiveNumberAutomation } from "@/lib/commerce-automation/number-policy";
import { coexistenceLaunchEnabled, embeddedSignupVersion } from "@/lib/conversations/es-config";
import { resolvedMetaApp } from "@/lib/integrations/service";
import { prisma } from "@/lib/db";
import { branchLocationId, canUseLocation, locationScopeWhere } from "@/lib/locations/access";
import { yolaPhoneNumberId } from "@/lib/yola/config";
import {
  isPhoneOwnershipError,
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
  const connection = await readCloudConnection(scoped.tenantId);
  const quota = await serviceQuotaForTenant(scoped.tenantId, cfg);
  const meta = await resolvedMetaApp();
  const [automation, overrides, numbers, locations, connectedCount] = await Promise.all([
    prisma.workspaceAutomation.findUnique({
      where: { tenantId: scoped.tenantId },
      include: { allowlist: { select: { digits: true } } },
    }),
    prisma.whatsAppNumberAutomation.findMany({ where: { tenantId: scoped.tenantId } }),
    listWorkspaceWhatsAppNumbers(scoped.tenantId),
    prisma.location.findMany({
      where: { ...locationScopeWhere(scoped.session, scoped.tenantId), status: { not: "ARCHIVED" } },
      select: { id: true, name: true, kind: true },
      orderBy: { name: "asc" },
    }),
    prisma.wabaPhone.count({ where: { tenantId: scoped.tenantId, status: "ACTIVE" } }),
  ]);
  const locked = branchLocationId(scoped.session);
  const visible = numbers.filter((number) => !locked || number.locationId === locked);
  const overrideByPhone = new Map(overrides.map((row) => [row.phoneNumberId, row]));
  return NextResponse.json({
    connected: Boolean(cfg),
    phoneNumberId: cfg?.phoneNumberId || null,
    wabaId: cfg?.wabaId || null,
    displayPhone: cfg?.displayPhone || null,
    webhookUrl: "https://atlasnow.co/api/webhooks/whatsapp",
    canEditOps: scoped.session.isPlatformAdmin,
    quota,
    connection,
    automation: {
      inboundEnabled: automation?.inboundEnabled ?? false,
      paymentFollowUpEnabled: automation?.paymentFollowUpEnabled ?? false,
      marketingEnabled: automation?.marketingEnabled ?? false,
      pilotMode: automation?.pilotMode ?? true,
      configured: Boolean(automation),
    },
    numbers: visible.map((number) => {
      const effective = effectiveNumberAutomation({
        tenantId: scoped.tenantId,
        phoneNumberId: number.phoneNumberId,
        wabaId: number.wabaId,
        isDefault: number.isDefault,
        connectedCount,
        workspace: automation,
        override: overrideByPhone.get(number.phoneNumberId) || null,
      });
      return {
        ...number,
        automation: {
          inboundEnabled: effective?.inboundEnabled ?? false,
          paymentFollowUpEnabled: effective?.paymentFollowUpEnabled ?? false,
          marketingEnabled: effective?.marketingEnabled ?? false,
          pilotMode: effective?.pilotMode ?? true,
          usesWorkspaceDefault: effective?.usesWorkspaceDefault ?? false,
          configured: Boolean(overrideByPhone.get(number.phoneNumberId)),
        },
      };
    }),
    locations,
    es: {
      appId: meta.appId || null,
      configId: meta.whatsappEsConfigId || null,
      ready: Boolean(meta.appId && meta.whatsappEsConfigId && meta.configured),
      version: embeddedSignupVersion(),
      coexistenceLaunch: coexistenceLaunchEnabled(process.env, scoped.tenantId),
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

  try {
    await saveCloudHqConnector({
      tenantId: scoped.tenantId,
      phoneNumberId,
      wabaId,
      accessToken,
      displayPhone: info.display_phone_number || null,
      verifiedName: info.verified_name || null,
    });
  } catch (err) {
    if (isPhoneOwnershipError(err)) {
      return NextResponse.json(
        { error: "This WhatsApp number is already connected to another workspace." },
        { status: 409 }
      );
    }
    throw err;
  }
  return NextResponse.json({
    ok: true,
    displayPhone: info.display_phone_number || null,
    verifiedName: info.verified_name || null,
  });
}

export async function PATCH(request: Request) {
  const scoped = await targetTenant(request, await readSession());
  if ("error" in scoped) return scoped.error;
  let body: {
    phoneNumberId?: string;
    paymentMethodOk?: boolean;
    billingOwner?: "BRAND" | "P2P";
    alias?: string;
    teamLabel?: string;
    locationId?: string | null;
    isDefault?: boolean;
    automation?: {
      inboundEnabled?: boolean | null;
      paymentFollowUpEnabled?: boolean | null;
      marketingEnabled?: boolean | null;
      pilotMode?: boolean | null;
    } | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const billing = body.paymentMethodOk != null || body.billingOwner != null;
  if (billing && !scoped.session.isPlatformAdmin) {
    return NextResponse.json({ error: "Only Super Admin can tick WABA billing ops." }, { status: 403 });
  }
  const phoneNumberId = (body.phoneNumberId || "").trim();
  const owned = phoneNumberId
    ? await prisma.wabaPhone.findUnique({ where: { phoneNumberId } })
    : null;
  if (phoneNumberId && (!owned || owned.tenantId !== scoped.tenantId)) {
    return NextResponse.json({ error: "That WhatsApp number is not on this workspace." }, { status: 404 });
  }
  if (billing) {
    const cfg = phoneNumberId
      ? await getCloudHqConfig(scoped.tenantId, phoneNumberId)
      : await getCloudHqConfig(scoped.tenantId);
    if (!cfg) return NextResponse.json({ error: "Connect this WhatsApp number first." }, { status: 400 });
    await patchWabaPhoneOps(cfg.phoneNumberId, body);
    const quota = await serviceQuotaForTenant(scoped.tenantId, cfg);
    return NextResponse.json({ ok: true, quota });
  }
  if (!owned) return NextResponse.json({ error: "Choose a WhatsApp number." }, { status: 400 });
  const yolaPhone = yolaPhoneNumberId();
  const turnsOn = Boolean(
    body.automation &&
      (body.automation.inboundEnabled || body.automation.paymentFollowUpEnabled || body.automation.marketingEnabled)
  );
  if (yolaPhone && owned.phoneNumberId === yolaPhone && turnsOn) {
    return NextResponse.json(
      { error: "This WhatsApp number stays on its own workspace flags. Generic automation cannot turn it on." },
      { status: 400 }
    );
  }
  const locked = branchLocationId(scoped.session);
  if (body.locationId) {
    const location = await prisma.location.findFirst({
      where: { id: body.locationId, tenantId: scoped.tenantId, status: { not: "ARCHIVED" } },
      select: { id: true },
    });
    if (!location || !canUseLocation(scoped.session, location.id)) {
      return NextResponse.json({ error: "That location is not available on this workspace." }, { status: 403 });
    }
  }
  if (locked && owned.locationId && owned.locationId !== locked) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (body.isDefault === true) {
    await prisma.$transaction([
      prisma.wabaPhone.updateMany({
        where: { tenantId: scoped.tenantId, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.wabaPhone.update({ where: { phoneNumberId: owned.phoneNumberId }, data: { isDefault: true } }),
    ]);
  }
  await prisma.wabaPhone.update({
    where: { phoneNumberId: owned.phoneNumberId },
    data: {
      ...(body.alias != null ? { alias: body.alias.trim().slice(0, 80) } : {}),
      ...(body.teamLabel != null ? { teamLabel: body.teamLabel.trim().slice(0, 80) } : {}),
      ...(body.locationId !== undefined ? { locationId: body.locationId || null } : {}),
    },
  });
  if (body.automation === null) {
    await prisma.whatsAppNumberAutomation.deleteMany({
      where: { tenantId: scoped.tenantId, phoneNumberId: owned.phoneNumberId },
    });
  } else if (body.automation) {
    await prisma.whatsAppNumberAutomation.upsert({
      where: { tenantId_phoneNumberId: { tenantId: scoped.tenantId, phoneNumberId: owned.phoneNumberId } },
      create: {
        tenantId: scoped.tenantId,
        phoneNumberId: owned.phoneNumberId,
        inboundEnabled: body.automation.inboundEnabled ?? null,
        paymentFollowUpEnabled: body.automation.paymentFollowUpEnabled ?? null,
        marketingEnabled: body.automation.marketingEnabled ?? null,
        pilotMode: body.automation.pilotMode ?? null,
      },
      update: {
        ...(body.automation.inboundEnabled !== undefined ? { inboundEnabled: body.automation.inboundEnabled } : {}),
        ...(body.automation.paymentFollowUpEnabled !== undefined
          ? { paymentFollowUpEnabled: body.automation.paymentFollowUpEnabled }
          : {}),
        ...(body.automation.marketingEnabled !== undefined ? { marketingEnabled: body.automation.marketingEnabled } : {}),
        ...(body.automation.pilotMode !== undefined ? { pilotMode: body.automation.pilotMode } : {}),
      },
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const scoped = await targetTenant(request, await readSession());
  if ("error" in scoped) return scoped.error;
  const url = new URL(request.url);
  const phoneNumberId = (url.searchParams.get("phoneNumberId") || "").trim();
  const all = url.searchParams.get("all") === "1";
  if (phoneNumberId) {
    const owned = await prisma.wabaPhone.findUnique({ where: { phoneNumberId }, select: { tenantId: true } });
    if (owned && owned.tenantId !== scoped.tenantId) {
      return NextResponse.json({ error: "That WhatsApp number is not on this workspace." }, { status: 404 });
    }
    await disconnectCloudHq(scoped.tenantId, phoneNumberId);
    return NextResponse.json({ ok: true });
  }
  const connected = await prisma.connector.count({
    where: { tenantId: scoped.tenantId, provider: WHATSAPP_CLOUD_PROVIDER, status: { not: "DISCONNECTED" } },
  });
  if (connected > 1 && !all) {
    return NextResponse.json({ error: "Choose the WhatsApp number to disconnect." }, { status: 400 });
  }
  await disconnectCloudHq(scoped.tenantId);
  return NextResponse.json({ ok: true });
}
