import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession, writeAudit } from "@/lib/auth";
import { getLocationForSession } from "@/lib/locations/access";
import { isLocationCapError } from "@/lib/locations/plan";
import { updateLocation } from "@/lib/locations/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const location = await getLocationForSession(session, id);
  if (!location) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ location });
}

const patchSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  code: z.string().max(40).optional().nullable(),
  addressLine1: z.string().max(240).optional().nullable(),
  addressLine2: z.string().max(240).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  region: z.string().max(80).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  country: z.string().max(8).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  waOutletPhone: z.string().max(40).optional().nullable(),
  waOutletConfirmed: z.boolean().optional(),
  website: z.string().max(240).optional().nullable(),
  timezone: z.string().max(60).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await getLocationForSession(session, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    if (parsed.data.code) {
      const clash = await prisma.location.findFirst({
        where: {
          tenantId: existing.tenantId,
          code: parsed.data.code.trim(),
          id: { not: id },
        },
      });
      if (clash) {
        return NextResponse.json(
          { error: `Store code already used: ${parsed.data.code}` },
          { status: 409 }
        );
      }
    }

    const location = await updateLocation(id, parsed.data);
    await writeAudit({
      tenantId: existing.tenantId,
      actorId: session.userId,
      action: "LOCATION_UPDATE",
      objectType: "location",
      objectId: id,
      meta: { fields: Object.keys(parsed.data) },
    });
    return NextResponse.json({ location });
  } catch (e) {
    if (isLocationCapError(e)) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 403 });
    }
    console.error("[PATCH /api/locations/:id]", e);
    return NextResponse.json({ error: "Could not update location" }, { status: 500 });
  }
}

/** Soft-archive: status ARCHIVED, atlas_location_id retained forever (no reuse). */
export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await getLocationForSession(session, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const location = await updateLocation(id, { status: "ARCHIVED" });
  await writeAudit({
    tenantId: existing.tenantId,
    actorId: session.userId,
    action: "LOCATION_ARCHIVE",
    objectType: "location",
    objectId: id,
    meta: { atlasLocationId: existing.atlasLocationId },
  });
  return NextResponse.json({ location });
}
