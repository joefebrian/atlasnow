import { NextResponse } from "next/server";
import { readSession, writeAudit } from "@/lib/auth";
import { branchLocationId, canAccessTenant, canUseLocation } from "@/lib/locations/access";
import { prisma } from "@/lib/db";
import { isGoDemoPayload, isTikTokGoPayload, qrInfoFromRaw } from "@/lib/tiktok-go/detect";
import { resolvedTikTokGoForTenant } from "@/lib/tiktok-go/connector";
import { demoCodeHint, queryGoDemo } from "@/lib/tiktok-go/demo";
import { queryGoVoucher, redeemGoVoucher } from "@/lib/tiktok-go/fulfill";
import { recordGoEvent } from "@/lib/tiktok-go/ledger";

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

async function shopIdForLocation(locationId: string) {
  const map = await prisma.sourceMapping.findFirst({
    where: { locationId, sourceType: "TIKTOK_GO_SHOP", status: "ACTIVE" },
    select: { externalId: true },
  });
  return map?.externalId || null;
}

export async function POST(request: Request) {
  const scoped = await tenantOf(request);
  if ("error" in scoped) return scoped.error;
  const body = (await request.json().catch(() => ({}))) as {
    raw?: string;
    action?: string;
    locationId?: string;
    shopOrderId?: string;
    codes?: string[];
  };
  const go = await resolvedTikTokGoForTenant(scoped.tenantId);

  const locked = branchLocationId(scoped.session);
  const locationId = locked || (body.locationId || "").trim();
  if (!locationId) {
    return NextResponse.json({ error: "Pick the outlet first." }, { status: 400 });
  }
  if (!canUseLocation(scoped.session, locationId)) {
    return NextResponse.json({ error: "This outlet is not yours to redeem." }, { status: 403 });
  }
  const loc = await prisma.location.findFirst({
    where: { id: locationId, tenantId: scoped.tenantId, status: { not: "ARCHIVED" } },
    select: { id: true, name: true },
  });
  if (!loc) return NextResponse.json({ error: "Outlet not found" }, { status: 404 });
  const rawPeek = typeof body.raw === "string" ? body.raw : "";
  const demoQuery = isGoDemoPayload(rawPeek);
  const demoRedeem = String(body.shopOrderId || "").startsWith("demo-order-");
  const thirdShopId = await shopIdForLocation(loc.id);
  if (!thirdShopId && !demoQuery && !demoRedeem) {
    return NextResponse.json(
      { error: "Map TikTok GO shop ID on this outlet (Location 360 → Sources), or try a sample QR TT-DEMO-OK." },
      { status: 400 }
    );
  }

  const action = body.action === "redeem" ? "redeem" : "query";
  if (action === "query") {
    const raw = rawPeek;
    if (!isTikTokGoPayload(raw)) {
      return NextResponse.json({ error: "This is not a TikTok GO QR (it should start with TT-)." }, { status: 400 });
    }
    const demo = demoQuery;
    try {
      const voucher = demo
        ? queryGoDemo(raw)
        : await (async () => {
            if (!go.configured) {
              throw new Error(
                "TikTok GO is not connected. Chat apps → TikTok GO: paste merchant ID, or try a sample QR (TT-DEMO-OK)."
              );
            }
            return queryGoVoucher({
              token: go.accessToken,
              merchantId: go.merchantId,
              thirdShopId: thirdShopId!,
              qrInfo: qrInfoFromRaw(raw),
            });
          })();
      await recordGoEvent({
        tenantId: scoped.tenantId,
        locationId: loc.id,
        kind: "QUERY",
        demo,
        title: voucher.title,
        detail: voucher.detail,
        codeHint: demo ? demoCodeHint(raw) : "TT-",
        shopOrderId: voucher.shopOrderId,
      });
      return NextResponse.json({
        kind: "tiktok_go",
        demo,
        locationId: loc.id,
        locationName: loc.name,
        ...voucher,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "TikTok GO query failed";
      await recordGoEvent({
        tenantId: scoped.tenantId,
        locationId: loc.id,
        kind: "DENY",
        demo,
        title: "TikTok GO voucher",
        detail: message,
        codeHint: demo ? demoCodeHint(raw) : "TT-",
      });
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const shopOrderId = (body.shopOrderId || "").trim();
  const codes = Array.isArray(body.codes) ? body.codes.map(String) : [];
  if (!shopOrderId || !codes.length) {
    return NextResponse.json({ error: "Query the voucher before redeeming." }, { status: 400 });
  }
  const demo = demoRedeem;
  try {
    if (!demo) {
      if (!go.configured || !thirdShopId) {
        throw new Error("TikTok GO is not connected for a live redeem.");
      }
      await redeemGoVoucher({
        token: go.accessToken,
        merchantId: go.merchantId,
        thirdShopId,
        shopOrderId,
        codes,
      });
    }
    await recordGoEvent({
      tenantId: scoped.tenantId,
      locationId: loc.id,
      kind: "REDEEM",
      demo,
      title: demo ? "Ngopi berdua" : "TikTok GO voucher",
      detail: `Redeemed at ${loc.name}. Not a stamp.`,
      codeHint: demo ? "TT-DEMO-OK" : "TT-",
      shopOrderId,
    });
    await writeAudit({
      tenantId: scoped.tenantId,
      actorId: scoped.session.userId,
      action: demo ? "tiktok_go.demo_redeem" : "tiktok_go.redeem",
      objectType: "Location",
      objectId: loc.id,
    });
    return NextResponse.json({ ok: true, kind: "tiktok_go", demo, locationName: loc.name });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "TikTok GO redeem failed" },
      { status: 400 }
    );
  }
}
