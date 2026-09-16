import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readSession, requireAgencySession, writeAudit } from "@/lib/auth";
import { canManageClient } from "@/lib/tenancy";
import { withoutLogoBytes } from "@/lib/brand-logo";
import { TENANT_PLANS } from "@/lib/locations/plan";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const client = await prisma.tenant.findFirst({
    where: { id, type: "CLIENT" },
    include: {
      memberships: {
        include: {
          user: { select: { id: true, email: true, name: true, isActive: true, createdAt: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (!canManageClient(session, client)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ client: withoutLogoBytes(client) });
}

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  industry: z.string().max(120).optional().nullable(),
  contactName: z.string().max(120).optional().nullable(),
  contactEmail: z.string().email().optional().nullable().or(z.literal("")),
  contactPhone: z.string().max(40).optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  address: z.string().max(400).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  timezone: z.string().max(60).optional(),
  loginEnabled: z.boolean().optional(),
  plan: z.enum(TENANT_PLANS).optional(),
});

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.tenant.findFirst({ where: { id, type: "CLIENT" } });
  if (!existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
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
    const d = parsed.data;
    const client = await prisma.tenant.update({
      where: { id },
      data: {
        name: d.name?.trim(),
        industry: d.industry === undefined ? undefined : d.industry?.trim() || null,
        contactName:
          d.contactName === undefined ? undefined : d.contactName?.trim() || null,
        contactEmail:
          d.contactEmail === undefined ? undefined : d.contactEmail?.trim() || null,
        contactPhone:
          d.contactPhone === undefined ? undefined : d.contactPhone?.trim() || null,
        website: d.website === undefined ? undefined : d.website?.trim() || null,
        address: d.address === undefined ? undefined : d.address?.trim() || null,
        notes: d.notes === undefined ? undefined : d.notes?.trim() || null,
        status: d.status,
        timezone: d.timezone,
        loginEnabled: d.loginEnabled,
        plan: d.plan,
        activatedAt:
          d.loginEnabled === true
            ? existing.activatedAt || new Date()
            : d.loginEnabled === false
              ? null
              : undefined,
      },
    });

    await writeAudit({
      tenantId: client.id,
      actorId: session.userId,
      action: "CLIENT_UPDATE",
      objectType: "tenant",
      objectId: client.id,
      meta: { fields: Object.keys(d) },
    });

    return NextResponse.json({ client: withoutLogoBytes(client) });
  } catch (e) {
    console.error("[PATCH /api/clients/:id]", e);
    return NextResponse.json({ error: "Could not save client" }, { status: 500 });
  }
}

/** Permanently remove a client workspace (memberships cascade; users remain for other tenants). */
export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.tenant.findFirst({ where: { id, type: "CLIENT" } });
  if (!existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  try {
    await writeAudit({
      tenantId: null,
      actorId: session.userId,
      action: "CLIENT_DELETE",
      objectType: "tenant",
      objectId: id,
      meta: { name: existing.name, slug: existing.slug },
    });

    await prisma.tenant.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[DELETE /api/clients/:id]", e);
    return NextResponse.json({ error: "Could not delete client" }, { status: 500 });
  }
}
