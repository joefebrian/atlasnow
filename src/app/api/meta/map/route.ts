import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession, writeAudit } from "@/lib/auth";
import { canAccessTenant } from "@/lib/locations/access";
import { mapMetaAsset } from "@/lib/meta/service";

const bodySchema = z.object({
  tenantId: z.string().min(1).optional(),
  locationId: z.string().min(1),
  sourceType: z.enum(["FACEBOOK", "INSTAGRAM"]),
  externalId: z.string().min(1),
  label: z.string().max(240).optional(),
});

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const tenantId = session.isAgencyStaff
    ? parsed.data.tenantId || session.tenantId
    : session.tenantId;
  if (!(await canAccessTenant(session, tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const mapping = await mapMetaAsset({
      tenantId,
      locationId: parsed.data.locationId,
      sourceType: parsed.data.sourceType,
      externalId: parsed.data.externalId,
      label: parsed.data.label || parsed.data.externalId,
    });
    await writeAudit({
      tenantId,
      actorId: session.userId,
      action: "META_MAP_ASSET",
      objectType: "source_mapping",
      objectId: mapping.id,
      meta: { sourceType: parsed.data.sourceType, externalId: parsed.data.externalId },
    });
    return NextResponse.json({ mapping });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Map failed" },
      { status: 400 }
    );
  }
}
