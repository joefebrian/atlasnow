import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession, writeAudit } from "@/lib/auth";
import { publishReviewReply, saveReviewDraft } from "@/lib/reviews/service";
import { prisma } from "@/lib/db";
import { canAccessTenant } from "@/lib/locations/access";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  body: z.string().min(2).max(4000),
  /** draft = save only; publish = write to Google */
  action: z.enum(["draft", "publish"]).default("draft"),
});

export async function POST(request: Request, ctx: Ctx) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const review = await prisma.review.findUnique({
    where: { id },
    include: { location: { select: { tenantId: true, name: true } } },
  });
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  if (!(await canAccessTenant(session, review.location.tenantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Publish to Google is agency-only for MVP (approval gate)
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

  if (parsed.data.action === "publish" && !session.isAgencyStaff) {
    return NextResponse.json(
      { error: "Only agency staff can publish replies to Google (approval gate)." },
      { status: 403 }
    );
  }

  try {
    if (parsed.data.action === "draft") {
      const draft = await saveReviewDraft({
        reviewId: id,
        body: parsed.data.body,
        authorId: session.userId,
      });
      await writeAudit({
        tenantId: review.location.tenantId,
        actorId: session.userId,
        action: "REVIEW_REPLY_DRAFT",
        objectType: "review",
        objectId: id,
      });
      return NextResponse.json({ ok: true, draft });
    }

    await publishReviewReply({
      reviewId: id,
      body: parsed.data.body,
      authorId: session.userId,
    });
    await writeAudit({
      tenantId: review.location.tenantId,
      actorId: session.userId,
      action: "REVIEW_REPLY_PUBLISH",
      objectType: "review",
      objectId: id,
    });
    return NextResponse.json({ ok: true, published: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Reply failed" },
      { status: 400 }
    );
  }
}
