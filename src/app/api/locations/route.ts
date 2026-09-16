import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession, writeAudit } from "@/lib/auth";
import { branchLocationId, canAccessTenant, listAccessibleClientTenants } from "@/lib/locations/access";
import { isLocationCapError } from "@/lib/locations/plan";
import { createLocation } from "@/lib/locations/service";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tenantIdParam = url.searchParams.get("tenantId");
  const status = url.searchParams.get("status");
  const city = url.searchParams.get("city");
  const readiness = url.searchParams.get("readiness");
  const q = url.searchParams.get("q");

  const clients = await listAccessibleClientTenants(session);
  if (clients.length === 0) {
    return NextResponse.json({ locations: [], clients: [] });
  }

  let tenantIds = clients.map((c) => c.id);
  if (tenantIdParam) {
    if (!(await canAccessTenant(session, tenantIdParam))) {
      return NextResponse.json({ error: "Forbidden tenant" }, { status: 403 });
    }
    tenantIds = [tenantIdParam];
  }

  const locked = branchLocationId(session);
  const locations = await prisma.location.findMany({
    where: {
      tenantId: { in: tenantIds },
      ...(locked ? { id: locked } : {}),
      ...(status ? { status } : { status: { not: "ARCHIVED" } }),
      ...(city ? { city: { contains: city } } : {}),
      ...(readiness ? { readiness } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { code: { contains: q } },
              { city: { contains: q } },
              { atlasLocationId: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
      mappings: {
        where: { status: "ACTIVE" },
        select: { id: true, sourceType: true, externalId: true, externalLabel: true },
      },
      _count: { select: { mappings: true } },
    },
  });

  return NextResponse.json({ locations, clients });
}

const createSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(2).max(160),
  code: z.string().max(40).optional().nullable(),
  addressLine1: z.string().max(500).optional().nullable(),
  addressLine2: z.string().max(500).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  region: z.string().max(120).optional().nullable(),
  postalCode: z.string().max(32).optional().nullable(),
  country: z.string().max(8).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  // Google Maps share URLs are often 300–800+ chars
  website: z.string().max(2000).optional().nullable(),
  timezone: z.string().max(60).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  latitude: z.number().finite().optional().nullable(),
  longitude: z.number().finite().optional().nullable(),
});

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const fieldMsg = Object.entries(flat.fieldErrors)
      .map(([k, v]) => `${k}: ${(v || []).join(", ")}`)
      .join("; ");
    return NextResponse.json(
      {
        error: fieldMsg || flat.formErrors[0] || "Validation failed",
        details: flat,
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (!(await canAccessTenant(session, data.tenantId))) {
    return NextResponse.json({ error: "Forbidden tenant" }, { status: 403 });
  }

  try {
    if (data.code) {
      const clash = await prisma.location.findFirst({
        where: { tenantId: data.tenantId, code: data.code.trim() },
      });
      if (clash) {
        return NextResponse.json(
          { error: `Store code already used: ${data.code}` },
          { status: 409 }
        );
      }
    }

    const location = await createLocation(data);
    await writeAudit({
      tenantId: data.tenantId,
      actorId: session.userId,
      action: "LOCATION_CREATE",
      objectType: "location",
      objectId: location.id,
      meta: { atlasLocationId: location.atlasLocationId, name: location.name },
    });
    return NextResponse.json({ location }, { status: 201 });
  } catch (e) {
    if (isLocationCapError(e)) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 403 });
    }
    console.error("[POST /api/locations]", e);
    return NextResponse.json({ error: "Could not create location" }, { status: 500 });
  }
}
