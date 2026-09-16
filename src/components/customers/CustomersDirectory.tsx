"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, SearchField, TableShell, Toolbar } from "@/components/ui";
import type { CustomerBookRow, CustomerBookStatus, CustomerChatThread } from "@/lib/customers/book";
import type { Locale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";

type Detail = CustomerBookRow & { threads: CustomerChatThread[] };

function sourceLabel(
  t: ReturnType<typeof getMessages>["customers"],
  source: string,
  outlet?: string | null
) {
  if (source === "STAFF") return t.sourceStaff;
  if (source === "CHAT_HQ") return t.sourceHqChat;
  if (source === "CHAT_BRANCH") return outlet ? `${t.sourceBranchChat} · ${outlet}` : t.sourceBranchChat;
  if (source === "QR_OUTLET") return outlet ? `${t.sourceJoinQr} · ${outlet}` : t.sourceJoinQr;
  if (source === "QR") return t.sourceJoinQr;
  return outlet || source;
}

function chipClass(status: CustomerBookStatus) {
  if (status === "member") return "an-chip-on";
  if (status === "prospect") return "an-chip bg-[#eef8ff] text-[#2a9bb8] ring-1 ring-[#2a9bb8]/20";
  return "an-chip-off";
}

function chipText(t: ReturnType<typeof getMessages>["customers"], status: CustomerBookStatus) {
  if (status === "member") return t.chipMember;
  if (status === "prospect") return t.chipProspect;
  return t.chipPotential;
}

function fmtBirth(iso: string | null, locale: Locale) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale === "id" ? "id-ID" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function n(template: string, value: number) {
  return template.replace("{n}", String(value));
}

export function CustomersDirectory({
  locale,
  isAgencyStaff,
  selectedClientId,
  selectedClientName,
}: {
  locale: Locale;
  isAgencyStaff: boolean;
  selectedClientId: string | null;
  selectedClientName: string | null;
}) {
  const t = getMessages(locale).customers;
  const [rows, setRows] = useState<CustomerBookRow[]>([]);
  const [stats, setStats] = useState({ total: 0, potential: 0, prospect: 0, member: 0 });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Detail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const qsClient = selectedClientId ? `client=${encodeURIComponent(selectedClientId)}` : "";

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams();
    if (selectedClientId) qs.set("client", selectedClientId);
    if (q.trim()) qs.set("q", q.trim());
    if (status) qs.set("status", status);
    const res = await fetch(`/api/customers/book?${qs}`, { credentials: "same-origin" });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Could not load");
      setRows([]);
    } else {
      setRows(data.people || []);
      setStats(data.stats || { total: 0, potential: 0, prospect: 0, member: 0 });
    }
    setLoading(false);
  }, [selectedClientId, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPerson(row: CustomerBookRow) {
    setDetailBusy(true);
    const qs = new URLSearchParams();
    if (selectedClientId) qs.set("client", selectedClientId);
    qs.set("phone", row.phone);
    const res = await fetch(`/api/customers/book?${qs}`, { credentials: "same-origin" });
    const data = await res.json();
    setDetailBusy(false);
    if (res.ok && data.person) setOpen(data.person as Detail);
    else setOpen({ ...row, threads: [] });
  }

  return (
    <div className="an-section">
      <PageHeader
        eyebrow={t.eyebrow}
        badge={t.badge}
        title={selectedClientName || t.title}
        description={t.description}
        actions={
          <>
            <span className="an-badge-muted">{n(t.countPotential, stats.potential)}</span>
            <span className="an-badge-muted">{n(t.countProspect, stats.prospect)}</span>
            <span className="an-badge-muted">{n(t.countMember, stats.member)}</span>
            <a className="an-btn-primary text-sm" href={`/api/customers/export?${qsClient}`}>
              {t.export}
            </a>
          </>
        }
      />
      {isAgencyStaff && (
        <Link href="/customers" className="text-xs font-semibold text-indigo-600 hover:underline">
          ← {t.allClients}
        </Link>
      )}
      {err && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</p>}
      <Toolbar>
        <SearchField placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="an-input w-auto py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t.statusAll}</option>
          <option value="potential">{t.statusPotential}</option>
          <option value="prospect">{t.statusProspect}</option>
          <option value="member">{t.statusMember}</option>
        </select>
      </Toolbar>
      <TableShell metaLeft={loading ? "…" : n(t.peopleCount, rows.length)}>
        <table className="an-table">
          <thead>
            <tr>
              <th>{t.colPhone}</th>
              <th>{t.colName}</th>
              <th>{t.colStatus}</th>
              <th>{t.colSource}</th>
              <th>{t.colActiveAt}</th>
              <th>{t.colStamps}</th>
              <th>{t.colBirthday}</th>
              <th>{t.colBirthdayWa}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center">
                  <p className="text-sm text-slate-500">{t.empty}</p>
                  <p className="mt-1 text-xs text-slate-400">{t.emptyHint}</p>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.key}
                  className="cursor-pointer hover:bg-[#eef8ff]/60"
                  onClick={() => void openPerson(r)}
                >
                  <td className="font-mono text-xs tabular-nums">{r.phone}</td>
                  <td className="text-sm text-slate-700">{r.name || "—"}</td>
                  <td>
                    <span className={chipClass(r.status)}>{chipText(t, r.status)}</span>
                  </td>
                  <td className="text-xs text-slate-500">
                    {sourceLabel(t, r.source, r.signupLocation?.name)}
                  </td>
                  <td className="text-xs text-slate-500">{r.activatedLocation?.name || "—"}</td>
                  <td className="text-xs tabular-nums">{r.stampCount}</td>
                  <td className="text-xs text-slate-500">{fmtBirth(r.birthDate, locale)}</td>
                  <td className="text-xs">{r.birthdayWaOptIn ? t.yes : t.no}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableShell>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center"
          onClick={() => setOpen(null)}
        >
          <div
            className="an-card max-h-[88vh] w-full max-w-lg overflow-y-auto p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="customer-detail-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.detailTitle}</p>
                <h2 id="customer-detail-title" className="mt-1 text-lg font-semibold text-slate-900">
                  {open.name || open.phone}
                </h2>
                <span className={`mt-2 inline-flex ${chipClass(open.status)}`}>{chipText(t, open.status)}</span>
              </div>
              <button type="button" className="an-btn-ghost text-sm" onClick={() => setOpen(null)}>
                {t.detailClose}
              </button>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
              {open.status === "member"
                ? t.detailExplainMember
                : open.status === "prospect"
                  ? t.detailExplainProspect
                  : t.detailExplainPotential}
            </p>
            {detailBusy && <p className="mt-2 text-xs text-slate-400">…</p>}
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">{t.colPhone}</dt>
                <dd className="mt-0.5 font-mono text-sm tabular-nums">{open.phone}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">{t.colName}</dt>
                <dd className="mt-0.5 text-sm">{open.name || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">{t.colEmail}</dt>
                <dd className="mt-0.5 break-all text-sm">{open.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">{t.colBirthday}</dt>
                <dd className="mt-0.5 text-sm">{fmtBirth(open.birthDate, locale)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">{t.colProvince}</dt>
                <dd className="mt-0.5 text-sm">{open.province || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">{t.colCity}</dt>
                <dd className="mt-0.5 text-sm">{open.city || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">{t.colSource}</dt>
                <dd className="mt-0.5 text-sm">{sourceLabel(t, open.source, open.signupLocation?.name)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">{t.colStamps}</dt>
                <dd className="mt-0.5 text-sm tabular-nums">{open.stampCount}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">{t.detailJoined}</dt>
                <dd className="mt-0.5 text-sm">{open.signupLocation?.name || sourceLabel(t, open.source)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">{t.detailActivated}</dt>
                <dd className="mt-0.5 text-sm">{open.activatedLocation?.name || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">{t.colBirthdayWa}</dt>
                <dd className="mt-0.5 text-sm">{open.birthdayWaOptIn ? t.yes : t.no}</dd>
              </div>
            </dl>
            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase text-slate-400">{t.detailChats}</p>
              {open.threads?.length ? (
                <ul className="mt-2 space-y-1.5">
                  {open.threads.map((th) => (
                    <li key={th.conversationId} className="text-sm text-slate-600">
                      {th.kind === "HQ" ? t.hq : t.branch}
                      {" · "}
                      {th.locationName}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-slate-400">{t.detailNoChat}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
