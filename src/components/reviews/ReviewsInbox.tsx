"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Avatar,
  MetricTile,
  PageHeader,
  SearchField,
  Stars,
  TableShell,
  Toolbar,
} from "@/components/ui";
import type { ReviewListItem } from "@/lib/reviews/service";
import { formatDateTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locale";
import { ReviewCapturePanel } from "@/components/reviews/ReviewCapturePanel";

type Stats = { total: number; unreplied: number; avg: number };

export function ReviewsInbox({
  isAgencyStaff,
  locale,
  selectedClientId,
  selectedClientName,
  locations,
}: {
  isAgencyStaff: boolean;
  locale: Locale;
  selectedClientId: string | null;
  selectedClientName: string | null;
  locations: { id: string; name: string }[];
}) {
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, unreplied: 0, avg: 0 });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<
    "all" | "unreplied" | "5" | "4" | "3" | "2" | "1" | "lte3"
  >("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState<ReviewListItem | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [pullMode, setPullMode] = useState<"maps" | "gbp">("maps");
  const [locationId, setLocationId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set("q", q.trim());
      if (filter !== "all") qs.set("filter", filter);
      if (selectedClientId) qs.set("clientId", selectedClientId);
      if (locationId) qs.set("locationId", locationId);
      const res = await fetch(`/api/reviews?${qs}`, { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Failed to load reviews");
        setLoading(false);
        return;
      }
      setReviews(data.reviews || []);
      setStats(data.stats || { total: 0, unreplied: 0, avg: 0 });
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }, [q, filter, selectedClientId, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncReviews() {
    if (!isAgencyStaff) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/reviews/sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: pullMode === "maps" ? "maps" : "gbp",
          ...(selectedClientId ? { clientId: selectedClientId } : {}),
          ...(locationId ? { locationId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Sync failed");
        setBusy(false);
        return;
      }
      setMsg(data.message || `Synced ${data.upserted} reviews`);
      if (data.errors?.length) {
        setErr(data.errors.slice(0, 3).join(" · "));
      }
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  function openReview(r: ReviewListItem) {
    setActive(r);
    setReplyBody(r.draft?.body || r.replyComment || "");
    setErr(null);
    setMsg(null);
  }

  async function saveDraft() {
    if (!active) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/reviews/${active.id}/reply`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody, action: "draft" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Save draft failed");
        setBusy(false);
        return;
      }
      setMsg("Draft saved on this page — not yet on Google.");
      await load();
      setBusy(false);
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  async function publishReply() {
    if (!active) return;
    if (
      !window.confirm(
        "Publish this reply to Google Business Profile / Maps? It will be public."
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/reviews/${active.id}/reply`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody, action: "publish" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Publish failed");
        setBusy(false);
        return;
      }
      setMsg("Reply published to Google.");
      setActive(null);
      await load();
      setBusy(false);
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  const filters = useMemo(
    () =>
      [
        { id: "all" as const, label: "All" },
        { id: "unreplied" as const, label: "Unreplied" },
        { id: "5" as const, label: "5★" },
        { id: "4" as const, label: "4★" },
        { id: "lte3" as const, label: "≤3★" },
        { id: "2" as const, label: "2★" },
        { id: "1" as const, label: "1★" },
      ] as const,
    []
  );

  const visible = reviews;

  return (
    <div className="an-section">
      <PageHeader
        eyebrow="Reputation"
        badge="Google Maps reviews"
        title={selectedClientName || "Reviews"}
        description={
          selectedClientName
            ? locale === "id"
              ? `Ulasan ${selectedClientName}. Pilih semua cabang atau satu outlet.`
              : `Reviews for ${selectedClientName}. All branches, or one outlet.`
            : "Two ways in: pull public reviews from each outlet’s Maps link (last 1 month, then 2 months back if empty), or connect Google Business Profile to list everything and reply on Google."
        }
        actions={
          <>
            <span className="an-badge-warn">{stats.unreplied} unreplied</span>
            <Link href="/control-tower" className="an-btn-ghost">
              Performance
            </Link>
            {isAgencyStaff ? (
              <button
                type="button"
                className="an-btn-primary"
                disabled={busy}
                onClick={syncReviews}
                title={
                  pullMode === "maps"
                    ? "Public reviews from the Maps link on each outlet"
                    : "Official Google Business Profile list + reply"
                }
              >
                {busy
                  ? "Working…"
                  : pullMode === "maps"
                    ? "Pull from Maps"
                    : "Sync from Google"}
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">Agency pulls reviews</span>
            )}
          </>
        }
      />

      {isAgencyStaff && selectedClientId ? (
        <div>
          <Link href="/reputation" className="text-xs font-semibold text-indigo-600 hover:underline">
            {locale === "id" ? "← Semua merek" : "← All brands"}
          </Link>
        </div>
      ) : null}

      {(msg || err) && (
        <p
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            err
              ? "border border-rose-200 bg-rose-50 text-rose-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {err || msg}
        </p>
      )}

      <div className="an-card space-y-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={pullMode === "maps" ? "an-chip-on" : "an-chip-off"}
            onClick={() => setPullMode("maps")}
          >
            Maps link
          </button>
          <button
            type="button"
            className={pullMode === "gbp" ? "an-chip-on" : "an-chip-off"}
            onClick={() => setPullMode("gbp")}
          >
            Google Business Profile
          </button>
        </div>
        {pullMode === "maps" ? (
          <p className="text-xs leading-relaxed text-slate-500">
            <strong className="text-slate-700">Maps pull</strong> uses the Google Maps
            link on each outlet. Starts with the last 1 month. If that month is empty,
            it takes the 2 months before that, and repeats the same pattern. You can
            draft replies here; posting them live on Google needs Business Profile
            connected.
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-slate-500">
            <strong className="text-slate-700">Google Business Profile</strong> is the
            official list + reply. Connect LIVE Google and map outlets on{" "}
            <Link href="/settings/google" className="font-semibold text-indigo-600 hover:underline">
              Settings → Google
            </Link>
            . Needs Google My Business API access on the Cloud project (the quota
            request in progress). Experience signal only — not visits or sales.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile
          icon="★"
          value={stats.avg ? stats.avg.toFixed(2) : "—"}
          label="Avg in this view"
          tone="amber"
        />
        <MetricTile icon="#" value={stats.total} label="Reviews loaded" tone="indigo" />
        <MetricTile
          icon="!"
          value={stats.unreplied}
          label="Need reply (SLA risk)"
          tone="rose"
        />
      </div>

      {selectedClientId ? (
        <ReviewCapturePanel
          locale={locale}
          clientId={selectedClientId}
          locationId={locationId || undefined}
        />
      ) : null}

      <Toolbar>
        <SearchField
          placeholder="Search reviewer or text…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              className={filter === f.id ? "an-chip-on" : "an-chip-off"}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <select
            className="an-input w-auto min-w-[180px] text-xs"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="">
              {locale === "id" ? "Semua cabang" : "All branches"}
            </option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </Toolbar>

      <TableShell
        metaLeft={
          <>
            Showing{" "}
            <span className="font-semibold text-slate-800">{visible.length}</span> of{" "}
            {stats.total} rows
            {loading ? " · loading…" : ""}
          </>
        }
        metaRight="Google Maps reviews · not visits or sales"
      >
        <table className="an-table">
          <thead>
            <tr>
              <th>Updated</th>
              <th>Customer</th>
              <th>Review</th>
              <th>Location</th>
              <th>Rating</th>
              <th>Reply</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!loading && visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-slate-400">
                  No reviews loaded yet. Open the outlet, make sure a Google Maps
                  link is saved, then click <strong>Pull from Maps</strong>
                  {isAgencyStaff ? "" : " (agency staff runs the pull)"}. If pull
                  already ran and this is still empty, the Maps pin was too short —
                  we now recover the place from the outlet name and coordinates.
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={r.id} className={!r.replied ? "bg-rose-50/20" : undefined}>
                  <td className="whitespace-nowrap text-xs tabular-nums text-slate-400">
                    {formatDateTime(r.updateTime || r.createTime, locale)}
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.reviewerName || "?"} />
                      <span className="font-semibold text-slate-800">
                        {r.reviewerName || "Anonymous"}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-[260px]">
                    <p className="line-clamp-2 leading-snug text-slate-600">
                      {r.comment || "(no text)"}
                    </p>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <span className="an-badge-muted" title={r.clientName}>
                        {r.locationName}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        {r.sourceType === "GOOGLE_MAPS" ? "Maps" : "Google"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <Stars n={r.starRating} />
                  </td>
                  <td>
                    {r.replied ? (
                      <span className="an-badge-yes">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Replied
                      </span>
                    ) : r.draft ? (
                      <span className="an-badge-warn">Draft</span>
                    ) : (
                      <span className="an-badge-no">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        Open
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="an-btn-soft text-xs"
                      onClick={() => openReview(r)}
                    >
                      {r.replied ? "View" : "Draft reply"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableShell>

      {/* Slide-over / modal for draft + publish on same page */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div
            className="absolute inset-0"
            onClick={() => !busy && setActive(null)}
            aria-hidden
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {active.reviewerName || "Anonymous"} · {active.locationName}
                </h3>
                <div className="mt-1">
                  <Stars n={active.starRating} />
                </div>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-700"
                onClick={() => setActive(null)}
              >
                ✕
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              {active.comment || "(no text)"}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {formatDateTime(active.updateTime || active.createTime, locale)}
            </p>

            {active.replyComment && (
              <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 ring-1 ring-emerald-100">
                <div className="font-semibold">Published on Google</div>
                <p className="mt-1 whitespace-pre-wrap">{active.replyComment}</p>
              </div>
            )}

            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Your reply (this page)
            </label>
            <textarea
              className="an-input mt-1.5 min-h-[120px] resize-y text-sm"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Thank the customer, address the issue…"
              disabled={busy}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="an-btn-ghost text-sm"
                disabled={busy}
                onClick={saveDraft}
              >
                Save draft
              </button>
              {isAgencyStaff && active.canPublish && (
                <button
                  type="button"
                  className="an-btn-primary text-sm"
                  disabled={busy || replyBody.trim().length < 2}
                  onClick={publishReply}
                >
                  {busy ? "…" : "Publish to Google"}
                </button>
              )}
              {isAgencyStaff && !active.canPublish && (
                <p className="text-[11px] text-slate-400">
                  Maps pull can’t post the reply on Google. Connect Business Profile
                  in Settings → Google, then sync from Google.
                </p>
              )}
              {!isAgencyStaff && (
                <p className="text-[11px] text-slate-400">
                  Agency staff publish to Google (approval gate).
                </p>
              )}
            </div>
            {active.draft?.lastError && (
              <p className="mt-2 text-xs text-rose-600">{active.draft.lastError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
