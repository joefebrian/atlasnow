import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ReportsTabs } from "@/components/reports/ReportsTabs";
import type { Locale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";
import type { LoyaltyMonthReport } from "@/lib/loyalty/report";

function qs(clientId: string | null, month?: string | null) {
  const p = new URLSearchParams();
  if (clientId) p.set("client", clientId);
  if (month) p.set("month", month);
  const s = p.toString();
  return s ? `?${s}` : "";
}

function formatRp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function IconPeople() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 19a4.5 4.5 0 0 1 4.8-4.2" />
    </svg>
  );
}
function IconStamp() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="4" y="3" width="16" height="12" rx="2" />
      <path d="M8 21h8M12 15v6" />
    </svg>
  );
}
function IconGift() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="10" width="18" height="10" rx="1.5" />
      <path d="M12 10v10M3 14h18" />
      <path d="M12 10c-2.5-4-6-4-6-1.5S9 10 12 10c2.5-4 6-4 6-1.5S15 10 12 10Z" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="m12 3 2.6 5.4 6 .9-4.3 4.2 1 6-5.3-2.8L6.7 19.5l1-6L3.4 9.3l6-.9L12 3Z" />
    </svg>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 text-[var(--ink)] shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eef8ff] text-[#2a9bb8]">{icon}</span>
      </div>
      <p className="mt-3 text-[1.85rem] font-semibold leading-none tracking-tight tabular-nums sm:text-[2.1rem]">{value}</p>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">{hint}</p>
    </div>
  );
}

export function LoyaltyMonthReport({
  locale,
  isAgency,
  clientId,
  brands,
  report,
}: {
  locale: Locale;
  isAgency: boolean;
  clientId: string | null;
  brands: { id: string; name: string }[];
  report: LoyaltyMonthReport | null;
}) {
  const t = getMessages(locale).reports;
  const periodLabel = locale === "id" ? report?.periodLabelId : report?.periodLabelEn;

  if (isAgency && !clientId) {
    return (
      <div className="an-section">
        <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.pickBrand} />
        <ReportsTabs locale={locale} clientId={clientId} view="loyalty" />
        {brands.length === 0 ? (
          <p className="text-sm text-slate-500">{t.noBrands}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {brands.map((b) => (
              <Link key={b.id} href={`/reports?client=${b.id}`} className="an-card p-5 transition hover:ring-2 hover:ring-[#b7e1ff]">
                <div className="font-semibold text-slate-900">{b.name}</div>
                <p className="mt-1 text-[11px] text-slate-400">{t.openMonth}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!report) return null;

  const h = report.summary.hero;
  const p = report.program;
  const stampOn = p.stampEnabled;
  const spenderOn = p.spenderEnabled;
  const volumeLabel = h.volumeKind === "stamps" ? t.stampsThisMonth : t.receiptsThisMonth;
  const volumeHint = h.volumeKind === "stamps" ? t.stampsHint : t.receiptsHint;
  const topIsSpend = !stampOn && spenderOn;
  const topValue = topIsSpend
    ? h.topSpender
      ? formatRp(h.topSpender.spend)
      : "—"
    : h.topRegular
      ? h.topRegular.stamps
      : "—";
  const topHint = topIsSpend
    ? h.topSpender
      ? `${h.topSpender.label} · ${t.topSpenderHint}`
      : t.topEmpty
    : h.topRegular
      ? `${h.topRegular.label} · ${t.topRegularHint}`
      : t.topEmpty;

  const redeemHintParts = [
    h.redemptionByKind.stamp ? `${h.redemptionByKind.stamp} ${t.kindStamp}` : null,
    h.redemptionByKind.spender ? `${h.redemptionByKind.spender} ${t.kindSpender}` : null,
    h.redemptionByKind.birthday ? `${h.redemptionByKind.birthday} ${t.kindBirthday}` : null,
  ].filter(Boolean);
  const redeemHint = redeemHintParts.length ? redeemHintParts.join(" · ") : t.redeemHint;

  const chips = [
    { on: true, label: t.chipMembership, detail: t.chipMembershipDetail },
    {
      on: stampOn,
      label: t.chipStamp,
      detail: p.stampTiers.map((row) => `${row.stamps} → ${row.reward || "—"}`).join(" · ") || `${p.stampGoal}`,
    },
    {
      on: spenderOn,
      label: t.chipSpender,
      detail: t.chipSpenderDetail.replace("{n}", String(p.spenderTopN)),
    },
    { on: p.birthdayEnabled, label: t.chipBirthday, detail: t.chipBirthdayDetail },
  ];

  return (
    <div className="an-section">
      <PageHeader
        eyebrow={t.eyebrow}
        badge={t.badge}
        title={report.brandName || t.title}
        description={t.description}
        actions={
          <>
            {isAgency && (
              <Link href="/reports" className="text-xs font-semibold text-[#2a9bb8] hover:underline">
                ← {t.allBrands}
              </Link>
            )}
            <Link href={`/loyalty${qs(clientId)}`} className="an-btn-ghost text-sm">
              {t.toLoyalty}
            </Link>
            <Link href={`/settings/loyalty${qs(clientId)}`} className="an-btn-ghost text-sm">
              {t.toSettings}
            </Link>
          </>
        }
      />
      <ReportsTabs locale={locale} clientId={clientId} view="loyalty" />

      <section className="overflow-hidden rounded-[1.25rem] bg-[var(--ink)] text-white shadow-[var(--shadow-lg)]">
        <div className="px-5 pt-6 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7ee5d6]">{t.heroKicker}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[1.35rem] font-semibold tracking-tight sm:text-2xl">{periodLabel}</h2>
            <div className="inline-flex items-center rounded-xl bg-white/10 p-1 text-sm">
              <Link href={`/reports${qs(clientId, report.prevMonth)}`} className="rounded-lg px-3 py-1.5 text-white/80 hover:bg-white/10">
                ←
              </Link>
              <span className="px-2 text-[12px] tabular-nums text-white/70">{report.periodKey}</span>
              {report.nextMonth ? (
                <Link href={`/reports${qs(clientId, report.nextMonth)}`} className="rounded-lg px-3 py-1.5 text-white/80 hover:bg-white/10">
                  →
                </Link>
              ) : (
                <span className="px-3 py-1.5 text-white/30">→</span>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 pb-4">
            {chips.map((c) => (
              <span
                key={c.label}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  c.on ? "bg-[#7ee5d6]/20 text-[#c5f0c1]" : "bg-white/5 text-white/40"
                }`}
                title={c.detail}
              >
                {c.on ? "●" : "○"} {c.label}
                {c.on && c.detail ? (
                  <span className="ml-1 hidden font-normal opacity-80 sm:inline">· {c.detail}</span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 bg-[#2a2528] p-4 sm:grid-cols-2 sm:p-5">
          <MetricCard icon={<IconPeople />} label={t.membersReturned} value={h.membersReturned} hint={t.membersReturnedHint} />
          <MetricCard icon={<IconStamp />} label={volumeLabel} value={h.volume} hint={volumeHint} />
          <MetricCard icon={<IconGift />} label={t.rewardsRedeemed} value={h.rewardsRedeemed} hint={redeemHint} />
          <MetricCard icon={<IconStar />} label={topIsSpend ? t.topSpender : t.topRegular} value={topValue} hint={topHint} />
        </div>
        <p className="px-5 py-3 text-center text-[12px] text-white/45 sm:px-6">{t.withAtlasNow}</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="an-card p-4">
          <p className="an-label">{t.joined}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{h.joinedThisMonth}</p>
          <p className="mt-1 text-[11px] text-slate-400">{t.joinedHint}</p>
        </div>
        <div className="an-card p-4">
          <p className="an-label">{t.activated}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{h.activatedThisMonth}</p>
          <p className="mt-1 text-[11px] text-slate-400">{t.activatedHint}</p>
        </div>
        <div className="an-card p-4">
          <p className="an-label">{t.shoppers}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{h.uniqueShoppers}</p>
          <p className="mt-1 text-[11px] text-slate-400">{t.shoppersHint}</p>
        </div>
      </div>

      {stampOn && (
        <div className="an-card overflow-x-auto p-0">
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-sm font-semibold text-slate-900">{t.stampRankTitle}</p>
            <p className="text-[11px] text-slate-400">{t.stampRankHint}</p>
          </div>
          {report.summary.stampBoard.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">{t.stampRankEmpty}</p>
          ) : (
            <table className="an-table">
              <thead>
                <tr>
                  <th>{t.colRank}</th>
                  <th>{t.colMember}</th>
                  <th>{t.colStamps}</th>
                </tr>
              </thead>
              <tbody>
                {report.summary.stampBoard.map((row) => (
                  <tr key={row.phone}>
                    <td className="tabular-nums">{row.rank}</td>
                    <td>{row.label}</td>
                    <td className="tabular-nums">{row.stamps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {spenderOn && (
        <div className="an-card overflow-x-auto p-0">
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-sm font-semibold text-slate-900">{t.spenderTitle}</p>
            <p className="text-[11px] text-slate-400">{t.spenderHint}</p>
          </div>
          {report.summary.spenderBoard.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">{t.spenderEmpty}</p>
          ) : (
            <table className="an-table">
              <thead>
                <tr>
                  <th>{t.colRank}</th>
                  <th>{t.colMember}</th>
                  <th>{t.colSpend}</th>
                  <th>{t.colReward}</th>
                </tr>
              </thead>
              <tbody>
                {report.summary.spenderBoard.map((row) => (
                  <tr key={row.phone}>
                    <td className="tabular-nums">{row.rank}</td>
                    <td>{row.label}</td>
                    <td className="tabular-nums">{formatRp(row.spend)}</td>
                    <td className="text-slate-500">{row.reward || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {p.birthdayEnabled && (
        <div className="an-card overflow-x-auto p-0">
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-sm font-semibold text-slate-900">{t.birthdayTitle}</p>
            <p className="text-[11px] text-slate-400">{t.birthdayHint}</p>
          </div>
          {report.summary.birthdayBoard.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">{t.birthdayEmpty}</p>
          ) : (
            <table className="an-table">
              <thead>
                <tr>
                  <th>{t.colWhen}</th>
                  <th>{t.colMember}</th>
                  <th>{t.colCode}</th>
                  <th>{t.colValue}</th>
                  <th>{t.colOutlet}</th>
                </tr>
              </thead>
              <tbody>
                {report.summary.birthdayBoard.map((row) => (
                  <tr key={`${row.phone}-${row.voucherCode}-${row.redeemedAt.toISOString()}`}>
                    <td className="whitespace-nowrap text-xs tabular-nums text-slate-500">
                      {row.redeemedAt.toLocaleString("id-ID", { timeZone: report.timezone, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>{row.label}</td>
                    <td className="font-mono text-xs">{row.voucherCode || "—"}</td>
                    <td>{row.voucherValue || "—"}</td>
                    <td>{row.locationName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="an-card overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-semibold text-slate-900">{t.outletTitle}</p>
          <p className="text-[11px] text-slate-400">{t.outletHint}</p>
        </div>
        {report.summary.outlets.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">{t.outletEmpty}</p>
        ) : (
          <table className="an-table">
            <thead>
              <tr>
                <th>{t.colOutlet}</th>
                <th>{volumeLabel}</th>
                <th>{t.shoppers}</th>
              </tr>
            </thead>
            <tbody>
              {report.summary.outlets.map((row) => (
                <tr key={row.locationId}>
                  <td>{row.name}</td>
                  <td className="tabular-nums">{row.stamps}</td>
                  <td className="tabular-nums">{row.shoppers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="an-card p-5">
        <p className="text-sm font-semibold text-slate-900">{t.cardV1Title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{t.cardV1Body}</p>
        <p className="mt-2 text-[12px] text-slate-400">{t.cardV1Cost}</p>
      </div>
    </div>
  );
}
