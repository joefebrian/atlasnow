import { notFound, redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { canManageClient } from "@/lib/tenancy";
import { prisma } from "@/lib/db";
import { withoutLogoBytes } from "@/lib/brand-logo";
import { BackLink, PageHeader } from "@/components/ui";
import { ClientDetailPanel } from "@/components/clients/ClientDetailPanel";

type Props = { params: Promise<{ id: string }> };

export default async function ClientDetailPage({ params }: Props) {
  const session = await readSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const client = await prisma.tenant.findFirst({
    where: { id, type: "CLIENT" },
    include: {
      memberships: {
        include: {
          user: {
            select: { id: true, email: true, name: true, isActive: true },
          },
          location: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      locations: {
        where: { status: { not: "ARCHIVED" }, kind: { not: "HQ" } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });

  if (!client) notFound();
  if (!canManageClient(session, client)) redirect("/control-tower");

  return (
    <div className="an-section mx-auto w-full max-w-3xl">
      <PageHeader
        back={<BackLink href="/clients">Back to brands</BackLink>}
        eyebrow="Brand"
        badge={client.loginEnabled ? "Login on" : "Login off"}
        title={client.name}
        description="Brand details, contact, and who can sign in."
      />
      <ClientDetailPanel
        client={{
          ...withoutLogoBytes(client),
          activatedAt: client.activatedAt?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
