import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession, writeAudit } from "@/lib/auth";
import { getBranding, updateBranding } from "@/lib/branding";
import { getLocale } from "@/lib/i18n/get-locale";
import { localizeBranding } from "@/lib/branding-defaults";
import { getSitePages } from "@/lib/site-pages";

export async function GET() {
  const branding = await getBranding();
  const locale = await getLocale();
  const { social } = await getSitePages();
  return NextResponse.json({
    branding,
    localized: localizeBranding(branding, locale),
    locale,
    social,
  });
}

const bodySchema = z.object({
  appName: z.string().min(1).max(80).optional(),
  logoUrl: z.string().nullable().optional(),
  logoLetter: z.string().min(1).max(2).optional(),
  tagline: z.string().min(1).max(200).optional(),
  heroHeadline: z.string().min(1).max(300).optional(),
  supportingNarrative: z.string().min(1).max(2000).optional(),
  productPromise: z.string().min(1).max(300).optional(),
  flowSteps: z.array(z.string().min(1).max(120)).min(1).max(8).optional(),
  taglineId: z.string().min(1).max(200).optional(),
  heroHeadlineId: z.string().min(1).max(300).optional(),
  supportingNarrativeId: z.string().min(1).max(2000).optional(),
  productPromiseId: z.string().min(1).max(300).optional(),
  flowStepsId: z.array(z.string().min(1).max(120)).min(1).max(8).optional(),
  supportEmail: z.string().max(120).nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .optional(),
});

export async function PUT(request: Request) {
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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.logoUrl && parsed.data.logoUrl.length > 900_000) {
    return NextResponse.json(
      { error: "Logo too large — use a smaller image (under ~600KB)" },
      { status: 400 }
    );
  }

  const branding = await updateBranding(parsed.data);

  await writeAudit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "BRANDING_UPDATE",
    objectType: "branding",
    objectId: "default",
    meta: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ branding });
}
