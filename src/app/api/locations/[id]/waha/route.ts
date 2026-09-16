import { NextResponse } from "next/server";
import { readSession, writeAudit } from "@/lib/auth";
import { getLocationForSession } from "@/lib/locations/access";
import {
  ensureWahaSession,
  getWahaSession,
  logoutWahaSession,
  relinkWahaSession,
  stopWahaSession,
} from "@/lib/conversations/waha-client";
import { isWahaIngestEnabled } from "@/lib/conversations/waha-config";
import { mapWahaSessionStatus, sessionNeedsRelink, wahaStatusLabel } from "@/lib/conversations/waha-session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const location = await getLocationForSession(session, id);
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await isWahaIngestEnabled())) {
    return NextResponse.json({
      configured: false,
      uiStatus: "offline",
      label: "WAHA off",
      atlasLocationId: location.atlasLocationId,
      phone: location.phone,
    });
  }

  const raw = await getWahaSession(location.atlasLocationId);
  const uiStatus = mapWahaSessionStatus(raw?.status);
  return NextResponse.json({
    configured: true,
    atlasLocationId: location.atlasLocationId,
    phone: location.phone,
    name: location.name,
    status: raw?.status || null,
    uiStatus: raw ? uiStatus : "none",
    label: raw ? wahaStatusLabel(uiStatus) : "Not linked",
    me: raw?.me || null,
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const location = await getLocationForSession(session, id);
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!location.phone?.trim()) {
    return NextResponse.json(
      { error: "Add a phone number on this location first." },
      { status: 400 }
    );
  }

  let reset = false;
  let stop = false;
  try {
    const body = (await request.json()) as { reset?: boolean; stop?: boolean };
    reset = body.reset === true;
    stop = body.stop === true;
  } catch {
    /* no body */
  }

  if (stop) {
    const stopped = await stopWahaSession(location.atlasLocationId);
    if (!stopped.ok) {
      return NextResponse.json({ error: stopped.error || "Could not stop session" }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      stopped: true,
      atlasLocationId: location.atlasLocationId,
      uiStatus: "stopped",
      label: wahaStatusLabel("stopped"),
    });
  }

  const existing = await getWahaSession(location.atlasLocationId);
  const dead = sessionNeedsRelink(existing?.status);
  const r = reset || dead
    ? await relinkWahaSession({
        name: location.atlasLocationId,
        deviceName: location.name,
      })
    : await ensureWahaSession({
        name: location.atlasLocationId,
        deviceName: location.name,
      });
  if (!r.session) {
    const status = r.code === "WAHA_SLOT_FULL" ? 429 : 502;
    return NextResponse.json(
      {
        error: r.error || "Could not start WAHA session",
        code: r.code,
        live: r.live,
        max: r.max,
      },
      { status }
    );
  }
  if (reset || dead) {
    await writeAudit({
      tenantId: location.tenantId,
      actorId: session.userId,
      action: "WAHA_RELINK",
      objectType: "location",
      objectId: location.id,
      meta: { session: location.atlasLocationId, branch: location.name },
    });
  }
  const uiStatus = mapWahaSessionStatus(r.session.status);
  return NextResponse.json({
    ok: true,
    relinked: reset || dead,
    atlasLocationId: location.atlasLocationId,
    status: r.session.status,
    uiStatus,
    label: wahaStatusLabel(uiStatus),
    me: r.session.me || null,
  });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const location = await getLocationForSession(session, id);
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const r = await logoutWahaSession(location.atlasLocationId);
  if (!r.ok) return NextResponse.json({ error: r.error || "Logout failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
