import { redirect } from "next/navigation";
import { requirePlatformSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard } from "@/components/ui";
import { isPlatformMode } from "@/lib/tenancy";
import { PlatformFollowUpActions } from "@/components/clients/PlatformFollowUpActions";
import { ClientTable } from "@/components/clients/ClientTable";

export default async function PlatformFollowUpPage() {
  const session = await requirePlatformSession();
  if (!session) redirect("/control-tower");
  if (!isPlatformMode(session)) redirect("/clients/follow-up");

  const [agencies, standalone, upgrades] = await Promise.all([
    prisma.tenant.findMany({
      where: { type: "AGENCY", loginEnabled: false, status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tenant.findMany({
      where: { type: "CLIENT", agencyId: null, loginEnabled: false, status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { memberships: true } } },
    }),
    prisma.agencyUpgradeRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, slug: true, contactEmail: true } },
        applicant: { select: { email: true, name: true } },
      },
    }),
  ]);

  return (
    <div className="an-section">
      <PageHeader
        eyebrow="Platform"
        badge="Follow-up"
        title="Waiting for AtlasNow"
        description="New agencies, standalone brand sign-ups, and requests to become an agency. Turning login on does not put them in someone else’s agency."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Agencies" value={agencies.length} icon="!" accent="amber" />
        <StatCard label="Standalone brands" value={standalone.length} icon="◎" accent="indigo" />
        <StatCard label="Upgrade requests" value={upgrades.length} icon="◎" accent="sky" />
      </div>

      {agencies.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Agencies waiting for login</h2>
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th>Agency</th>
                  <th>Contact</th>
                  <th>Note</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {agencies.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="font-semibold">{a.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{a.slug}</div>
                    </td>
                    <td className="text-sm">
                      <div>{a.contactEmail || "—"}</div>
                      {a.contactPhone ? (
                        <div className="font-mono text-[11px] text-slate-500">{a.contactPhone}</div>
                      ) : null}
                    </td>
                    <td className="text-xs text-slate-500">{a.notes || "—"}</td>
                    <td className="text-right">
                      <PlatformFollowUpActions kind="agency" id={a.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {standalone.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Standalone brands waiting for login</h2>
          <ClientTable
            clients={standalone}
            labels={{
              colName: "Brand",
              colIndustry: "Industry",
              colContact: "Contact",
              colLogin: "Login",
              colUsers: "Users",
              colStatus: "Status",
              loginOn: "On",
              loginOff: "Off",
              view: "Open",
              selfServe: "Signed up on the site",
              turnOnLogin: "Turn on login",
            }}
            activatePending
          />
        </section>
      ) : null}

      {upgrades.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Apply to become an agency</h2>
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Applicant</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {upgrades.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="font-semibold">{u.client.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{u.client.slug}</div>
                    </td>
                    <td className="text-sm">
                      {u.applicant.name || u.applicant.email}
                      <div className="text-[11px] text-slate-400">{u.applicant.email}</div>
                    </td>
                    <td className="text-right">
                      <PlatformFollowUpActions kind="upgrade" id={u.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {agencies.length === 0 && standalone.length === 0 && upgrades.length === 0 ? (
        <div className="an-card px-6 py-12 text-center text-sm text-slate-500">
          Nothing waiting.
        </div>
      ) : null}
    </div>
  );
}
