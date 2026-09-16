import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { listAccessibleClientTenants } from "@/lib/locations/access";
import { canEditRoleMenus } from "@/lib/role-menu";
import { RoleMenuForm } from "@/components/settings/RoleMenuForm";

type Props = { searchParams: Promise<{ client?: string }> };

export const metadata = { title: "Menu access · AtlasNow" };

export default async function RoleMenuPage({ searchParams }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!canEditRoleMenus(session)) redirect("/settings");
  const { client } = await searchParams;
  const brands = await listAccessibleClientTenants(session);
  const clientId = session.isAgencyStaff ? brands.find((b) => b.id === client)?.id ?? null : session.tenantId;

  return (
    <div className="an-section">
      <PageHeader
        eyebrow="Roles"
        title="Menu access"
        description="Tick what each role may open on this brand. Branch PIC is always one cabang — assign the outlet on the user."
      />
      <RoleMenuForm
        clientId={clientId}
        isGroup={session.isAgencyStaff}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
