import Link from "next/link";
import { PageHeader, StatCard } from "@/components/ui";
import { DeskRangeBar } from "@/components/home/DeskRangeBar";
import type { HomeDeskData } from "@/lib/home/desk";
import { formatDelta } from "@/lib/home/range";
import type { Messages } from "@/lib/i18n/messages";

type Props = {
  t: Messages["controlTower"];
  data: HomeDeskData;
  isGroup: boolean;
};

function clientQs(isGroup: boolean, brandId: string) {
  return isGroup ? `?client=${encodeURIComponent(brandId)}` : "";
}

export function HomeDesk({ t, data, isGroup }: Props) {
  const setupNeeded = data.brandCount > 0 && data.stampOnCount < data.brandCount;
  const hqNeeded = data.brandCount > 0 && data.hqOnCount < data.brandCount;
  const single = !isGroup || data.brandCount === 1;
  const brandId = data.brands[0]?.id || "";
  const outletsReportHref =
    isGroup && brandId
      ? `/reports?client=${encodeURIComponent(brandId)}&view=outlets`
      : "/reports?view=outlets";

  return (
    <div className="an-section">
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        actions={
          <>
            <Link href="/conversations" className="an-btn-ghost">
              {t.openInbox}
            </Link>
            <Link href="/loyalty" className="an-btn-ghost">
              {t.openLoyalty}
            </Link>
            <Link href="/settings/loyalty" className="an-btn-primary">
              {t.setupLoyalty}
            </Link>
          </>
        }
      />

      <DeskRangeBar
        from={data.rangeFrom}
        to={data.rangeTo}
        compare={data.compare}
        t={t}
      />

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
          {t.periodTitle}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PeriodCard
            label={t.stampsRange}
            hint={t.stampsRangeHint}
            value={data.period.stamps}
            prior={data.prior?.stamps}
            icon="✦"
            accent="sky"
            vsPrior={t.vsPrior}
          />
          <PeriodCard
            label={t.newMembers}
            hint={t.newMembersHint}
            value={data.period.newMembers}
            prior={data.prior?.newMembers}
            icon="◎"
            accent="indigo"
            vsPrior={t.vsPrior}
          />
          <PeriodCard
            label={t.inboundChats}
            hint={t.inboundChatsHint}
            value={data.period.inboundChats}
            prior={data.prior?.inboundChats}
            icon="✉"
            accent="amber"
            vsPrior={t.vsPrior}
          />
          <PeriodCard
            label={t.newReviews}
            hint={t.newReviewsHint}
            value={data.period.newReviews}
            prior={data.prior?.newReviews}
            icon="★"
            accent="emerald"
            vsPrior={t.vsPrior}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
          {t.liveTitle}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t.waitingReply}
            value={data.unreplied}
            hint={t.waitingReplyHint}
            icon="✉"
            accent={data.unreplied > 0 ? "amber" : "emerald"}
          />
          <StatCard
            label={t.pendingStamps}
            value={data.pendingStamps}
            hint={t.pendingStampsHint}
            icon="▣"
            accent={data.pendingStamps > 0 ? "amber" : "slate"}
          />
          <StatCard
            label={t.members}
            value={data.members}
            hint={`${data.prospects} ${t.prospectsHint}`}
            icon="◎"
            accent="indigo"
          />
          <StatCard
            label={t.potential}
            value={data.potential}
            hint={t.potentialHint}
            icon="○"
            accent="slate"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Mini label={t.reviews} value={data.unrepliedReviews} hint={t.reviewsHint} />
        <Mini label={t.outlets} value={data.outlets} hint={isGroup ? `${data.brandCount} ${t.brands}` : undefined} />
        <Mini
          label="HQ WhatsApp"
          value={data.hqOnCount}
          hint={hqNeeded ? t.hqOff : t.hqOn}
        />
      </div>

      <div className="an-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{t.mapsTitle}</p>
            <p className="mt-1 text-[13px] text-slate-500">{t.mapsNote}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={outletsReportHref} className="an-btn-ghost text-sm">
              {t.mapsOpen}
            </Link>
            {!data.googleOn ? (
              <Link href="/settings/google" className="an-btn-primary text-sm">
                {t.mapsConnect}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Mini
            label={t.mapsMapped}
            value={`${data.gbpMapped}/${data.outlets}`}
            hint={data.googleOn ? t.googleOn : t.googleOff}
          />
          <Mini label={t.mapsNeedLook} value={data.gbpNeedLook} hint={t.mapsNeedLookHint} />
          <Mini label={t.mapsReviews} value={data.unrepliedReviews} hint={t.reviewsHint} />
        </div>
      </div>

      {(setupNeeded || hqNeeded || data.pendingStamps > 0 || data.unreplied > 0) && (
        <div className="an-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{t.nextTitle}</p>
          <ul className="mt-3 space-y-2">
            {setupNeeded ? (
              <li>
                <Link href="/settings/loyalty" className="text-sm font-semibold text-slate-800 hover:text-[#2a9bb8]">
                  {t.nextSetup}
                </Link>
              </li>
            ) : null}
            {hqNeeded ? (
              <li>
                <Link href="/settings/chat-apps" className="text-sm font-semibold text-slate-800 hover:text-[#2a9bb8]">
                  {t.hqOff}
                </Link>
              </li>
            ) : null}
            {data.pendingStamps > 0 ? (
              <li>
                <Link href="/loyalty" className="text-sm font-semibold text-slate-800 hover:text-[#2a9bb8]">
                  {t.nextApprove.replace("{n}", String(data.pendingStamps))}
                </Link>
              </li>
            ) : null}
            {data.unreplied > 0 ? (
              <li>
                <Link href="/conversations" className="text-sm font-semibold text-slate-800 hover:text-[#2a9bb8]">
                  {t.nextInbox.replace("{n}", String(data.unreplied))}
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="an-card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{t.waitingReply}</p>
            <Link href="/conversations" className="text-[12px] font-semibold text-[#2a9bb8]">
              {t.openInbox}
            </Link>
          </div>
          {data.waiting.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t.inboxEmpty}</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {data.waiting.map((row) => (
                <li key={row.id} className="py-3">
                  <Link href="/conversations" className="block min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                      <p className="shrink-0 text-[11px] text-slate-400">{row.locationName}</p>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-slate-500">{row.preview || "—"}</p>
                    {isGroup && data.brandCount > 1 ? (
                      <p className="mt-0.5 text-[11px] text-slate-400">{row.brandName}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="an-card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{t.pendingStamps}</p>
            <Link href="/loyalty" className="text-[12px] font-semibold text-[#2a9bb8]">
              {t.openLoyalty}
            </Link>
          </div>
          {data.pending.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t.queueEmpty}</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {data.pending.map((row) => (
                <li key={row.id} className="py-3">
                  <Link href="/loyalty" className="block min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-mono text-sm font-semibold text-slate-900">{row.phone}</p>
                      <p className="shrink-0 text-[11px] text-slate-400">{row.locationName}</p>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-slate-500">
                      {t.receipt} {row.trxId}
                    </p>
                    {isGroup && data.brandCount > 1 ? (
                      <p className="mt-0.5 text-[11px] text-slate-400">{row.brandName}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isGroup && data.brands.length > 1 ? (
        <div className="an-card overflow-hidden p-0">
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{t.brands}</p>
            <Link href="/clients" className="text-[12px] font-semibold text-[#2a9bb8]">
              {t.openBrands}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2.5">{t.brands}</th>
                  <th className="px-5 py-2.5">{t.outlets}</th>
                  <th className="px-5 py-2.5">{t.waitingReply}</th>
                  <th className="px-5 py-2.5">{t.pendingStamps}</th>
                  <th className="px-5 py-2.5">{t.members}</th>
                  <th className="px-5 py-2.5">HQ</th>
                </tr>
              </thead>
              <tbody>
                {data.brands.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="px-5 py-3">
                      <Link href={`/conversations${clientQs(true, b.id)}`} className="font-semibold text-slate-900 hover:text-[#2a9bb8]">
                        {b.name}
                      </Link>
                      <p className="font-mono text-[11px] text-slate-400">{b.slug}</p>
                    </td>
                    <td className="px-5 py-3 tabular-nums">{b.outlets}</td>
                    <td className="px-5 py-3 tabular-nums">{b.unreplied}</td>
                    <td className="px-5 py-3 tabular-nums">{b.pending}</td>
                    <td className="px-5 py-3 tabular-nums">{b.members}</td>
                    <td className="px-5 py-3 text-[12px] font-semibold">
                      {b.hqOn ? (
                        <span className="text-emerald-700">{t.hqOn}</span>
                      ) : (
                        <span className="text-amber-700">{t.hqOff}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {data.brandCount === 0 ? (
        <div className="an-card px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-800">{t.emptyTitle}</p>
          <p className="mt-1 text-sm text-slate-500">{t.emptyBody}</p>
          {isGroup ? (
            <Link href="/clients" className="an-btn-primary mt-4 inline-flex">
              {t.openBrands}
            </Link>
          ) : (
            <Link href="/settings/loyalty" className="an-btn-primary mt-4 inline-flex">
              {t.setupLoyalty}
            </Link>
          )}
        </div>
      ) : null}

      {single && brandId ? (
        <div className="flex flex-wrap gap-2">
          <Link href="/customers" className="an-btn-ghost text-sm">
            {t.openCustomers}
          </Link>
          <Link href="/locations" className="an-btn-ghost text-sm">
            {t.outlets}
          </Link>
          <Link href="/reputation" className="an-btn-ghost text-sm">
            {t.reviews}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function PeriodCard({
  label,
  hint,
  value,
  prior,
  icon,
  accent,
  vsPrior,
}: {
  label: string;
  hint: string;
  value: number;
  prior: number | undefined;
  icon: string;
  accent: "indigo" | "emerald" | "amber" | "sky" | "slate";
  vsPrior: string;
}) {
  const cmp = prior == null ? null : formatDelta(value, prior);
  return (
    <StatCard
      label={label}
      value={value}
      hint={prior == null ? hint : `${hint} · ${vsPrior} ${prior}`}
      icon={icon}
      accent={accent}
      delta={cmp?.delta}
      deltaUp={cmp?.deltaUp}
    />
  );
}

function Mini({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="an-card px-4 py-3">
      <div className="an-label">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}
