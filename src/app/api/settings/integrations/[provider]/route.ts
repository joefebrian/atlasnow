import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession, writeAudit } from "@/lib/auth";
import { getIntegrationDef } from "@/lib/integrations/catalog";
import {
  listIntegrationViews,
  upsertIntegration,
} from "@/lib/integrations/service";
import { isAgencyStaff } from "@/lib/roles";

const bodySchema = z.object({
  mode: z.enum(["AUTO", "LIVE", "MOCK", "OFF"]).optional(),
  enabled: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
  displayName: z.string().max(120).nullable().optional(),
  publicFields: z.record(z.string(), z.string()).optional(),
  secretFields: z.record(z.string(), z.string()).optional(),
});

type Ctx = { params: Promise<{ provider: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAgencyStaff(session.role)) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  const { provider } = await ctx.params;
  if (!getIntegrationDef(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  const integrations = await listIntegrationViews();
  const item = integrations.find((i) => i.provider === provider);
  return NextResponse.json({ integration: item });
}

export async function PUT(request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAgencyStaff(session.role)) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  const { provider } = await ctx.params;
  if (!getIntegrationDef(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
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

  await upsertIntegration(provider, parsed.data);

  await writeAudit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "INTEGRATION_UPDATE",
    objectType: "integration",
    objectId: provider,
    meta: {
      mode: parsed.data.mode,
      enabled: parsed.data.enabled,
      publicKeys: Object.keys(parsed.data.publicFields || {}),
      secretKeys: Object.keys(parsed.data.secretFields || {}),
    },
  });

  const integrations = await listIntegrationViews();
  const item = integrations.find((i) => i.provider === provider);
  return NextResponse.json({ integration: item });
}
