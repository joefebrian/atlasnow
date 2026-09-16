import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession, writeAudit } from "@/lib/auth";
import { sanitizeFaqList } from "@/lib/faq";
import { getSitePages, pointsFromText, updateSitePages } from "@/lib/site-pages";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.isAgencyStaff && !session.isPlatformAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const pages = await getSitePages();
  return NextResponse.json({ pages });
}

const bodySchema = z.object({
  aboutHeadlineEn: z.string().min(1).max(200).optional(),
  aboutBodyEn: z.string().min(1).max(4000).optional(),
  aboutPointsEnText: z.string().max(2000).optional(),
  aboutHeadlineId: z.string().min(1).max(200).optional(),
  aboutBodyId: z.string().min(1).max(4000).optional(),
  aboutPointsIdText: z.string().max(2000).optional(),
  contactHeadlineEn: z.string().min(1).max(200).optional(),
  contactBodyEn: z.string().min(1).max(2000).optional(),
  contactHeadlineId: z.string().min(1).max(200).optional(),
  contactBodyId: z.string().min(1).max(2000).optional(),
  contactNoteEn: z.string().max(300).optional(),
  contactNoteId: z.string().max(300).optional(),
  socialInstagram: z.string().max(300).optional(),
  socialFacebook: z.string().max(300).optional(),
  socialThreads: z.string().max(300).optional(),
  socialTiktok: z.string().max(300).optional(),
  socialX: z.string().max(300).optional(),
  socialIconInstagram: z.string().max(120_000).nullable().optional(),
  socialIconFacebook: z.string().max(120_000).nullable().optional(),
  socialIconThreads: z.string().max(120_000).nullable().optional(),
  socialIconTiktok: z.string().max(120_000).nullable().optional(),
  socialIconX: z.string().max(120_000).nullable().optional(),
  faqs: z
    .array(
      z.object({
        id: z.string().max(40),
        qEn: z.string().min(1).max(200),
        aEn: z.string().min(1).max(2000),
        qId: z.string().max(200),
        aId: z.string().max(2000),
      })
    )
    .max(30)
    .optional(),
});

export async function PUT(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.isAgencyStaff && !session.isPlatformAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const d = parsed.data;
  const pages = await updateSitePages({
    aboutHeadlineEn: d.aboutHeadlineEn,
    aboutBodyEn: d.aboutBodyEn,
    aboutPointsEn: d.aboutPointsEnText !== undefined ? pointsFromText(d.aboutPointsEnText) : undefined,
    aboutHeadlineId: d.aboutHeadlineId,
    aboutBodyId: d.aboutBodyId,
    aboutPointsId: d.aboutPointsIdText !== undefined ? pointsFromText(d.aboutPointsIdText) : undefined,
    contactHeadlineEn: d.contactHeadlineEn,
    contactBodyEn: d.contactBodyEn,
    contactHeadlineId: d.contactHeadlineId,
    contactBodyId: d.contactBodyId,
    contactNoteEn: d.contactNoteEn,
    contactNoteId: d.contactNoteId,
    social: {
      instagram: { href: d.socialInstagram, icon: d.socialIconInstagram },
      facebook: { href: d.socialFacebook, icon: d.socialIconFacebook },
      threads: { href: d.socialThreads, icon: d.socialIconThreads },
      tiktok: { href: d.socialTiktok, icon: d.socialIconTiktok },
      x: { href: d.socialX, icon: d.socialIconX },
    },
    faqs: d.faqs !== undefined ? sanitizeFaqList(d.faqs) : undefined,
  });

  await writeAudit({
    tenantId: session.tenantId,
    actorId: session.userId,
    action: "SITE_PAGES_UPDATE",
    objectType: "site_pages",
    objectId: "default",
    meta: { fields: Object.keys(d) },
  });

  return NextResponse.json({ pages });
}
