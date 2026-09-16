import { NextResponse } from "next/server";
import { readSession, writeAudit } from "@/lib/auth";
import { getLocationForSession } from "@/lib/locations/access";
import { pullLocationProfileFromGoogle } from "@/lib/google/business-info-write";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Pull Google Business Profile → update Atlas location fields. */
export async function POST(_request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const location = await getLocationForSession(session, id);
  if (!location) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const result = await pullLocationProfileFromGoogle(id);
    await writeAudit({
      tenantId: location.tenantId,
      actorId: session.userId,
      action: "GOOGLE_PULL_LOCATION",
      objectType: "location",
      objectId: id,
      meta: result,
    });

    const refreshed = await prisma.location.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        mappings: true,
      },
    });

    return NextResponse.json({
      ok: true,
      ...result,
      location: refreshed,
      note:
        result.mode === "MOCK"
          ? "Pulled from mock Google cache."
          : "Pulled from Google Business Profile.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pull failed" },
      { status: 400 }
    );
  }
}
