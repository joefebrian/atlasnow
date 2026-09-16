import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { JoinMemberForm } from "@/components/loyalty/JoinMemberForm";

type Props = { params: Promise<{ joinKey: string }>; searchParams: Promise<{ outlet?: string }> };

export const metadata = { robots: { index: false, follow: false } };

export default async function JoinPage({ params, searchParams }: Props) {
  const { joinKey } = await params;
  const { outlet } = await searchParams;
  const program = await prisma.loyaltyProgram.findUnique({
    where: { joinKey },
    include: { tenant: { select: { id: true, name: true, status: true, logoMime: true, updatedAt: true } } },
  });
  if (!program || program.tenant.status === "ARCHIVED") notFound();
  const locations = await prisma.location.findMany({
    where: { tenantId: program.tenantId, status: { not: "ARCHIVED" }, kind: { not: "HQ" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const outletOk = outlet && locations.some((l) => l.id === outlet) ? outlet : "";
  return (
    <JoinMemberForm
      joinKey={joinKey}
      brandName={program.tenant.name}
      qrScope={program.qrScope === "LOCATION" ? "LOCATION" : "BRAND"}
      outletId={outletOk}
      locations={locations}
      hasLogo={Boolean(program.tenant.logoMime)}
      logoVersion={program.tenant.updatedAt.getTime()}
    />
  );
}
