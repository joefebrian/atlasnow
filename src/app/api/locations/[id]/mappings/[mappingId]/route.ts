import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readSession, writeAudit } from "@/lib/auth";
import { getLocationForSession } from "@/lib/locations/access";
import { applyReadiness } from "@/lib/locations/service";

type Ctx = { params: Promise<{ id: string; mappingId: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, mappingId } = await ctx.params;
  const location = await getLocationForSession(session, id);
  if (!location) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const mapping = await prisma.sourceMapping.findFirst({
    where: { id: mappingId, locationId: id },
  });
  if (!mapping) {
    return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
  }

  await prisma.sourceMapping.delete({ where: { id: mappingId } });
  await applyReadiness(id);

  await writeAudit({
    tenantId: location.tenantId,
    actorId: session.userId,
    action: "SOURCE_MAPPING_DELETE",
    objectType: "source_mapping",
    objectId: mappingId,
    meta: { sourceType: mapping.sourceType, externalId: mapping.externalId },
  });

  return NextResponse.json({ ok: true });
}
