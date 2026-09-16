import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { loadMemberApp, stampCardMetadata } from "@/lib/loyalty/card-public";
import { signCardToken } from "@/lib/loyalty/card-token";
import { memberState } from "@/lib/loyalty/members";
import { getOrCreateProgram, memberStampStatus } from "@/lib/loyalty/service";
import { prisma } from "@/lib/db";
import { MemberStampCard } from "@/components/loyalty/MemberStampCard";

type Props = { params: Promise<{ slug: string; memberId: string }> };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf8fc",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, memberId } = await params;
  const app = await loadMemberApp(decodeURIComponent(slug), decodeURIComponent(memberId));
  if (!app) return { title: { absolute: "Kartu stamp" }, robots: { index: false, follow: false } };
  return stampCardMetadata(app.tenant.name, app.tenant.slug, app.member.id);
}

export default async function BrandMemberCardPage({ params }: Props) {
  const { slug, memberId } = await params;
  const app = await loadMemberApp(decodeURIComponent(slug), decodeURIComponent(memberId));
  if (!app) notFound();
  const [stamp, membership, program, locations] = await Promise.all([
    memberStampStatus(app.tenant.id, app.member.phone),
    memberState(app.tenant.id, app.member.phone),
    getOrCreateProgram(app.tenant.id),
    prisma.location.findMany({
      where: { tenantId: app.tenant.id, status: { not: "ARCHIVED" }, kind: { not: "HQ" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!membership.registered) notFound();
  return (
    <MemberStampCard
      token={signCardToken(app.tenant.id, app.member.phone)}
      brandName={app.tenant.name}
      brandSlug={app.tenant.slug}
      memberId={app.member.id}
      name={membership.member?.name || app.member.name || ""}
      phone={membership.phone}
      life={membership.life}
      stamp={stamp}
      guestReceiptUpload={program.guestReceiptUpload}
      locations={locations}
    />
  );
}
