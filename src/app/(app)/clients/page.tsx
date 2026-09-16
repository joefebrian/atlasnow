import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAgencySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard } from "@/components/ui";
import { ClientTable } from "@/components/clients/ClientTable";
import { getLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";
import { isSelfServeSignup, needsFollowUp } from "@/lib/clients";
import { brandWhereForSession } from "@/lib/tenancy";

export default async function ClientsPage() {
  const session = await requireAgencySession();
  if (!session) {
    redirect("/control-tower");
  }

  const locale = await getLocale();
  const t = getMessages(locale).clients;

  const clients = await prisma.tenant.findMany({
    where: brandWhereForSession(session),
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { memberships: true } },
    },
  });

  const loginOn = clients.filter((c) => c.loginEnabled).length;
  const pending = clients
    .filter((c) => needsFollowUp(c))
    .sort((a, b) => Number(isSelfServeSignup(b.notes)) - Number(isSelfServeSignup(a.notes)));
  const tableLabels = {
    colName: t.colName,
    colIndustry: t.colIndustry,
    colContact: t.colContact,
    colLogin: t.colLogin,
    colUsers: t.colUsers,
    colStatus: t.colStatus,
    loginOn: t.loginOn,
    loginOff: t.loginOff,
    view: t.view,
    selfServe: t.selfServe,
    turnOnLogin: t.turnOnLogin,
  };

  return (
    <div className="an-section">
      <PageHeader
        eyebrow={t.eyebrow}
        badge={t.badge}
        title={t.title}
        description={t.description}
        actions={
          <Link href="/clients/new" className="an-btn-primary">
            {t.newClient}
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard compact label={t.total} value={clients.length} icon="◎" accent="indigo" />
        <StatCard compact label={t.loginOn} value={loginOn} icon="✓" accent="emerald" />
        <StatCard compact label={t.followUp} value={pending.length} icon="!" accent="amber" />
      </div>

      {pending.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{t.followUpTitle}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{t.followUpHint}</p>
            </div>
            <Link href="/clients/follow-up" className="text-xs font-semibold text-indigo-600 hover:underline">
              {t.followUpMenu}
            </Link>
          </div>
          <ClientTable clients={pending} labels={tableLabels} activatePending />
        </section>
      ) : null}

      {clients.length === 0 ? (
        <div className="an-card flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
            ◎
          </div>
          <h3 className="text-base font-semibold text-slate-900">{t.empty}</h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500">{t.emptyHint}</p>
          <Link href="/clients/new" className="an-btn-primary mt-5">
            {t.newClient}
          </Link>
        </div>
      ) : (
        <section className="space-y-3">
          {pending.length > 0 ? (
            <h2 className="text-sm font-semibold text-slate-900">{t.allBrands}</h2>
          ) : null}
          <ClientTable clients={clients} labels={tableLabels} activatePending={false} />
        </section>
      )}
    </div>
  );
}
