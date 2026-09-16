import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAgencySession, writeAudit } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { brandWhereForSession } from "@/lib/tenancy";
import { withoutLogoBytes } from "@/lib/brand-logo";

export async function GET() {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  try {
    const clients = await prisma.tenant.findMany({
      where: brandWhereForSession(session),
      orderBy: { createdAt: "desc" },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          include: {
            user: { select: { id: true, email: true, name: true, isActive: true } },
          },
        },
        _count: { select: { memberships: true } },
      },
    });
    return NextResponse.json({
      clients: clients.map((c) => withoutLogoBytes(c)),
    });
  } catch (e) {
    console.error("[GET /api/clients]", e);
    return NextResponse.json({ error: "Failed to load clients" }, { status: 500 });
  }
}

const emptyToUndefined = z.literal("").transform(() => undefined);

const createSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .union([z.string().min(2).max(48), emptyToUndefined])
    .optional()
    .nullable()
    .transform((v) => v || undefined),
  industry: z.string().max(120).optional().nullable(),
  contactName: z.string().max(120).optional().nullable(),
  contactEmail: z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  contactPhone: z.string().max(40).optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  address: z.string().max(400).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  timezone: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  const session = await requireAgencySession();
  if (!session) {
    return NextResponse.json(
      { error: "Agency staff only — log out and sign in again as admin@p2plabs.local" },
      { status: 403 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    const first = Object.values(fields).flat()[0] || "Validation failed";
    return NextResponse.json(
      { error: String(first), details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const data = parsed.data;
    let slug = slugify(data.slug || data.name);
    if (!slug) {
      return NextResponse.json({ error: "Invalid name/slug" }, { status: 400 });
    }

    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const client = await prisma.tenant.create({
      data: {
        name: data.name.trim(),
        slug,
        type: "CLIENT",
        status: "ACTIVE",
        loginEnabled: false,
        plan: "free",
        agencyId: session.tenantId,
        timezone: data.timezone || "Asia/Jakarta",
        industry: data.industry?.trim() || null,
        contactName: data.contactName?.trim() || null,
        contactEmail: data.contactEmail?.trim() || null,
        contactPhone: data.contactPhone?.trim() || null,
        website: data.website?.trim() || null,
        address: data.address?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    });

    await writeAudit({
      tenantId: client.id,
      actorId: session.userId,
      action: "CLIENT_CREATE",
      objectType: "tenant",
      objectId: client.id,
      meta: { name: client.name, slug: client.slug },
    });

    return NextResponse.json({ client: withoutLogoBytes(client) }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/clients]", e);
    return NextResponse.json(
      { error: "Could not create client. Try again or re-login." },
      { status: 500 }
    );
  }
}
