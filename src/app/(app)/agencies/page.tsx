import { redirect } from "next/navigation";
import { requirePlatformSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard } from "@/components/ui";
import { isPlatformMode } from "@/lib/tenancy";
import { EnterAgencyButton } from "@/components/auth/EnterAgencyButton";

export default async function AgenciesPage() {
  const session = await requirePlatformSession();
  if (!session) redirect("/control-tower");
  if (!isPlatformMode(session)) redirect("/clients");

  const agencies = await prisma.tenant.findMany({
    where: { type: "AGENCY", status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    include: { _count: { select: { managedBrands: true } } },
  });
  const standalone = await prisma.tenant.count({
    where: { type: "CLIENT", agencyId: null, status: { not: "ARCHIVED" } },
  });
  const waiting = agencies.filter((a) => !a.loginEnabled).length;

  return (
    <div className="an-section">
      <PageHeader
        eyebrow="Platform"
        badge="Super Admin"
        title="Agencies"
        description="Every agency on AtlasNow. Open one to work inside it. Standalone brands sit in Follow-up until they belong to an agency or stay independent."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Agencies" value={agencies.length} icon="◎" accent="indigo" />
        <StatCard label="Waiting login" value={waiting} icon="!" accent="amber" />
        <StatCard label="Standalone brands" value={standalone} icon="◎" accent="sky" />
      </div>
      <div className="an-table-wrap">
        <table className="an-table">
          <thead>
            <tr>
              <th>Agency</th>
              <th>Login</th>
              <th>Brands</th>
              <th>Contact</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agencies.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="font-semibold text-slate-900">{a.name}</div>
                  <div className="font-mono text-[11px] text-slate-400">{a.slug}</div>
                </td>
                <td>
                  {a.loginEnabled ? (
                    <span className="an-badge-yes">On</span>
                  ) : (
                    <span className="an-badge-warn">Off</span>
                  )}
                </td>
                <td className="tabular-nums">{a._count.managedBrands}</td>
                <td className="text-sm text-slate-600">{a.contactEmail || "—"}</td>
                <td className="text-right">
                  <EnterAgencyButton agencyId={a.id} label="Open" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
