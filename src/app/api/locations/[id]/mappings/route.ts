import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession, writeAudit } from "@/lib/auth";
import { getLocationForSession } from "@/lib/locations/access";
import { applyReadiness, assertExternalIdFree } from "@/lib/locations/service";

type Ctx = { params: Promise<{ id: string }> };

const SOURCE_TYPES = [
  "GOOGLE_BUSINESS_PROFILE",
  "GSC",
  "ADS",
  "WAHA",
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK_GO_SHOP",
  "SOCIAL",
  "REDEMPTION",
  "MANUAL",
] as const;

const bodySchema = z.object({
  sourceType: z.enum(SOURCE_TYPES),
  externalId: z.string().min(1).max(240),
  externalLabel: z.string().max(240).optional().nullable(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
});

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
  return NextResponse.json({ mappings: location.mappings });
}

export async function POST(request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const location = await getLocationForSession(session, id);
  if (!location) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const externalId = parsed.data.externalId.trim();
  const clash = await assertExternalIdFree(
    parsed.data.sourceType,
    externalId,
    id
  );
  if (clash) {
    return NextResponse.json(
      {
        error: "External ID already mapped to another location",
        conflict: {
          locationId: clash.location.id,
          name: clash.location.name,
          atlasLocationId: clash.location.atlasLocationId,
        },
      },
      { status: 409 }
    );
  }

  const mapping = await prisma.sourceMapping.create({
    data: {
      locationId: id,
      sourceType: parsed.data.sourceType,
      externalId,
      externalLabel: parsed.data.externalLabel?.trim() || null,
      confidence: parsed.data.confidence || "HIGH",
      status: "ACTIVE",
    },
  });

  await applyReadiness(id);

  await writeAudit({
    tenantId: location.tenantId,
    actorId: session.userId,
    action: "SOURCE_MAPPING_CREATE",
    objectType: "source_mapping",
    objectId: mapping.id,
    meta: {
      sourceType: mapping.sourceType,
      externalId: mapping.externalId,
      locationId: id,
    },
  });

  const refreshed = await getLocationForSession(session, id);
  return NextResponse.json({ mapping, location: refreshed }, { status: 201 });
}
