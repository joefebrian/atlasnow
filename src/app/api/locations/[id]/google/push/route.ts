import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession, writeAudit } from "@/lib/auth";
import { getLocationForSession } from "@/lib/locations/access";
import { pushLocationProfileToGoogle } from "@/lib/google/business-info-write";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    fields: z
      .object({
        title: z.boolean().optional(),
        phone: z.boolean().optional(),
        website: z.boolean().optional(),
        address: z.boolean().optional(),
        storeCode: z.boolean().optional(),
      })
      .optional(),
  })
  .optional();

/** Push Atlas location profile → Google Business Profile. */
export async function POST(request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Agency operates write for managed service; client admins can push their own tenant
  if (!session.isAgencyStaff && session.tenantType !== "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const location = await getLocationForSession(session, id);
  if (!location) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let fields = undefined;
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (parsed.success) fields = parsed.data?.fields;
  } catch {
    /* empty body ok */
  }

  try {
    const result = await pushLocationProfileToGoogle(id, fields);
    await writeAudit({
      tenantId: location.tenantId,
      actorId: session.userId,
      action: "GOOGLE_PUSH_LOCATION",
      objectType: "location",
      objectId: id,
      meta: result,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      note:
        result.mode === "MOCK"
          ? "Mock push — updated local Google cache only. Connect LIVE OAuth for real Business Profile updates."
          : "Pushed to Google Business Profile (Business Information API).",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Push failed" },
      { status: 400 }
    );
  }
}
