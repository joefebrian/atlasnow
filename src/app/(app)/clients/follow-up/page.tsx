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

export default async function FollowUpPage() {
  const session = await requireAgencySession();
  if (!session) {
    redirect("/control-tower");
  }

  const locale = await getLocale();
  const t = getMessages(locale).clients;

  const clients = await prisma.tenant.findMany({
    where: { ...brandWhereForSession(session), loginEnabled: false },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { memberships: true } },
    },
  });

  const pending = clients
    .filter((c) => needsFollowUp(c))
    .sort((a, b) => Number(isSelfServeSignup(b.notes)) - Number(isSelfServeSignup(a.notes)));
  const selfServe = pending.filter((c) => isSelfServeSignup(c.notes)).length;

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
        badge={t.followUp}
        title={t.followUpTitle}
        description={t.followUpHint}
        actions={
          <Link href="/clients" className="an-btn-ghost">
            {t.title}
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label={t.followUp} value={pending.length} icon="!" accent="amber" />
        <StatCard label={t.selfServe} value={selfServe} icon="◎" accent="indigo" />
      </div>

      {pending.length === 0 ? (
        <div className="an-card px-6 py-12 text-center">
          <h3 className="text-base font-semibold text-slate-900">{t.followUpEmpty}</h3>
          <p className="mt-2 text-sm text-slate-500">{t.followUpEmptyHint}</p>
        </div>
      ) : (
        <ClientTable clients={pending} labels={tableLabels} activatePending />
      )}
    </div>
  );
}
