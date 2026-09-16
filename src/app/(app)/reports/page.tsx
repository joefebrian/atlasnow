import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/get-locale";
import { listAccessibleClientTenants } from "@/lib/locations/access";
import { loadLoyaltyMonthReport } from "@/lib/loyalty/report";
import { loadOutletReport } from "@/lib/reports/outlets";
import { LoyaltyMonthReport } from "@/components/reports/LoyaltyMonthReport";
import { OutletReport } from "@/components/reports/OutletReport";

type Props = { searchParams: Promise<{ client?: string; month?: string; view?: string }> };

export default async function ReportsPage({ searchParams }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");
  const locale = await getLocale();
  const { client, month, view } = await searchParams;
  const clients = await listAccessibleClientTenants(session);
  const selectedClientId = session.isAgencyStaff
    ? clients.find((c) => c.id === client)?.id ?? null
    : session.tenantId;
  const brands = clients.map((c) => ({ id: c.id, name: c.name }));

  if (view === "outlets") {
    const rows = selectedClientId ? await loadOutletReport(selectedClientId) : [];
    return (
      <OutletReport
        locale={locale}
        isAgency={session.isAgencyStaff}
        clientId={selectedClientId}
        brands={brands}
        rows={rows}
      />
    );
  }

  const report =
    selectedClientId ? await loadLoyaltyMonthReport(selectedClientId, month) : null;

  return (
    <LoyaltyMonthReport
      locale={locale}
      isAgency={session.isAgencyStaff}
      clientId={selectedClientId}
      brands={brands}
      report={report}
    />
  );
}
