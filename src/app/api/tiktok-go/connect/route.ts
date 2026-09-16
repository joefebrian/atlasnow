import { NextResponse } from "next/server";
import { readSession, writeAudit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessTenant } from "@/lib/locations/access";
import { resolvedTikTokApp } from "@/lib/tiktok/config";
import {
  disconnectGo,
  exchangeGoToken,
  getGoConnector,
  goMerchantIdOf,
  markGoError,
  saveGoMerchantId,
  setGoDemoMode,
} from "@/lib/tiktok-go/connector";
import { assertExternalIdFree } from "@/lib/locations/service";

async function tenantOf(request: Request) {
  const session = await readSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const url = new URL(request.url);
  const tenantId = session.isAgencyStaff ? url.searchParams.get("client") : session.tenantId;
  if (!tenantId || !(await canAccessTenant(session, tenantId))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, tenantId };
}

async function snapshot(tenantId: string) {
  const [row, app, locations] = await Promise.all([
    getGoConnector(tenantId),
    resolvedTikTokApp(),
    prisma.location.findMany({
      where: { tenantId, status: { not: "ARCHIVED" }, kind: { not: "HQ" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        atlasLocationId: true,
        mappings: {
          where: { sourceType: "TIKTOK_GO_SHOP", status: "ACTIVE" },
          select: { id: true, externalId: true, externalLabel: true },
        },
      },
    }),
  ]);
  const merchantId = goMerchantIdOf(row);
  return {
    merchantId,
    status: row?.status || "DISCONNECTED",
    mode: row?.mode || "LIVE",
    hasToken: Boolean(row?.accessTokenEnc),
    appKeysReady: app.configured,
    lastError: row?.lastError || null,
    demo: row?.mode === "MOCK",
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      atlasLocationId: l.atlasLocationId,
      shopId: l.mappings[0]?.externalId || "",
      mappingId: l.mappings[0]?.id || null,
    })),
  };
}

export async function GET(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  return NextResponse.json(await snapshot(scoped.tenantId));
}

export async function POST(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    merchantId?: string;
    locationId?: string;
    shopId?: string;
  };
  const action = body.action || "";

  try {
    if (action === "save_merchant") {
      const merchantId = (body.merchantId || "").trim();
      if (merchantId.length < 3) {
        return NextResponse.json({ error: "Paste the Merchant ID from TikTok GO Merchant Portal." }, { status: 400 });
      }
      await saveGoMerchantId(scoped.tenantId, merchantId);
      await writeAudit({
        tenantId: scoped.tenantId,
        actorId: scoped.session.userId,
        action: "tiktok_go.save_merchant",
        objectType: "Connector",
      });
    } else if (action === "fetch_token") {
      await exchangeGoToken(scoped.tenantId);
      await writeAudit({
        tenantId: scoped.tenantId,
        actorId: scoped.session.userId,
        action: "tiktok_go.fetch_token",
        objectType: "Connector",
      });
    } else if (action === "demo_on") {
      await setGoDemoMode(scoped.tenantId, true);
    } else if (action === "demo_off") {
      await setGoDemoMode(scoped.tenantId, false);
    } else if (action === "map_shop") {
      const locationId = (body.locationId || "").trim();
      const shopId = (body.shopId || "").trim();
      if (!locationId || !shopId) {
        return NextResponse.json({ error: "Pick an outlet and paste the TikTok shop ID." }, { status: 400 });
      }
      const loc = await prisma.location.findFirst({
        where: { id: locationId, tenantId: scoped.tenantId, status: { not: "ARCHIVED" } },
        select: { id: true, name: true },
      });
      if (!loc) return NextResponse.json({ error: "Outlet not found" }, { status: 404 });
      const clash = await assertExternalIdFree("TIKTOK_GO_SHOP", shopId, loc.id);
      if (clash) {
        return NextResponse.json(
          { error: `That shop ID is already mapped to ${clash.location.name}.` },
          { status: 409 }
        );
      }
      await prisma.sourceMapping.deleteMany({
        where: { locationId: loc.id, sourceType: "TIKTOK_GO_SHOP" },
      });
      await prisma.sourceMapping.create({
        data: {
          locationId: loc.id,
          sourceType: "TIKTOK_GO_SHOP",
          externalId: shopId,
          externalLabel: loc.name,
          confidence: "HIGH",
          status: "ACTIVE",
        },
      });
    } else if (action === "disconnect") {
      await disconnectGo(scoped.tenantId);
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "TikTok GO connect failed";
    await markGoError(scoped.tenantId, message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json(await snapshot(scoped.tenantId));
}
