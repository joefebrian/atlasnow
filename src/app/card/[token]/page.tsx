import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { inspectCardToken, memberAppPath } from "@/lib/loyalty/card-token";

type Props = { params: Promise<{ token: string }> };

export const metadata = { robots: { index: false, follow: false }, title: "Kartu stamp" };

export default async function MemberCardRedirect({ params }: Props) {
  const { token } = await params;
  const parsed = inspectCardToken(decodeURIComponent(token));
  if (!parsed.ok) notFound();
  const [tenant, member] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: parsed.claims.tid },
      select: { slug: true, status: true },
    }),
    prisma.loyaltyMember.findUnique({
      where: { tenantId_phone: { tenantId: parsed.claims.tid, phone: parsed.claims.phone } },
      select: { id: true },
    }),
  ]);
  if (!tenant || tenant.status === "ARCHIVED" || !member) notFound();
  redirect(memberAppPath(tenant.slug, member.id));
}
