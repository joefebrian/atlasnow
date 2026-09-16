import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listAccessibleClientTenants } from "@/lib/locations/access";
import { PageHeader } from "@/components/ui";
import { BrandLogoSettings } from "@/components/brand/BrandLogoSettings";

type Props = { searchParams: Promise<{ client?: string }> };

export default async function BrandMarkPage({ searchParams }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");
  const { client } = await searchParams;
  const clients = await listAccessibleClientTenants(session);
  const selectedClientId = session.isAgencyStaff
    ? clients.find((c) => c.id === client)?.id ?? null
    : session.tenantId;

  const logoMime = selectedClientId
    ? (
        await prisma.tenant.findUnique({
          where: { id: selectedClientId },
          select: { logoMime: true },
        })
      )?.logoMime
    : "";

  return (
    <>
      <PageHeader
        eyebrow="Brand"
        title="Join page logo"
        description="The mark on the public daftar-member page. Not AtlasNow chrome — that stays in Settings → Branding."
      />
      <BrandLogoSettings
        isAgency={session.isAgencyStaff}
        brands={clients.map((c) => ({ id: c.id, name: c.name }))}
        clientId={selectedClientId}
        hasLogo={Boolean(logoMime)}
      />
    </>
  );
}
