import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ReportsTabs } from "@/components/reports/ReportsTabs";
import type { Locale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";
import type { OutletReportRow } from "@/lib/reports/outlets";

export function OutletReport({
  locale,
  isAgency,
  clientId,
  brands,
  rows,
}: {
  locale: Locale;
  isAgency: boolean;
  clientId: string | null;
  brands: { id: string; name: string }[];
  rows: OutletReportRow[];
}) {
  const t = getMessages(locale).reports;

  if (isAgency && !clientId) {
    return (
      <div className="an-section">
        <PageHeader eyebrow={t.eyebrow} title={t.outletsTitle} description={t.pickBrand} />
        <ReportsTabs locale={locale} clientId={clientId} view="outlets" />
        {brands.length === 0 ? (
          <p className="text-sm text-slate-500">{t.noBrands}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {brands.map((b) => (
              <Link
                key={b.id}
                href={`/reports?client=${b.id}&view=outlets`}
                className="an-card p-5 transition hover:ring-2 hover:ring-[#b7e1ff]"
              >
                <div className="font-semibold text-slate-900">{b.name}</div>
                <p className="mt-1 text-[11px] text-slate-400">{t.tabOutlets}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="an-section">
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.outletsTitle}
        description={t.outletsHint}
        actions={
          <>
            {isAgency ? (
              <Link href="/reports?view=outlets" className="text-xs font-semibold text-[#2a9bb8] hover:underline">
                ← {t.allBrands}
              </Link>
            ) : null}
            <Link href="/locations" className="an-btn-ghost text-sm">
              {t.colOutlet}
            </Link>
            <Link href="/settings/google" className="an-btn-primary text-sm">
              Google
            </Link>
          </>
        }
      />
      <ReportsTabs locale={locale} clientId={clientId} view="outlets" />

      {rows.length === 0 ? (
        <div className="an-card px-6 py-12 text-center text-sm text-slate-500">{t.outletsEmpty}</div>
      ) : (
        <div className="an-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2.5">{t.colOutlet}</th>
                  <th className="px-5 py-2.5">{t.colCity}</th>
                  <th className="px-5 py-2.5">{t.colMapped}</th>
                  <th className="px-5 py-2.5">{t.colReviews}</th>
                  <th className="px-5 py-2.5">{t.colUnreplied}</th>
                  <th className="px-5 py-2.5">{t.colReady}</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-semibold text-slate-900">{row.name}</td>
                    <td className="px-5 py-3 text-slate-500">{row.city || "—"}</td>
                    <td className="px-5 py-3 text-[12px] font-semibold">
                      {row.mappedGbp ? (
                        <span className="text-emerald-700">{t.mappedYes}</span>
                      ) : (
                        <span className="text-amber-700">{t.mappedNo}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 tabular-nums">{row.reviewCount}</td>
                    <td className="px-5 py-3 tabular-nums">{row.unrepliedReviews}</td>
                    <td className="px-5 py-3 text-[12px] text-slate-500">{row.readiness}</td>
                    <td className="px-5 py-3">
                      <Link href={`/locations/${row.id}`} className="text-[12px] font-semibold text-[#2a9bb8]">
                        {t.openOutlet}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
