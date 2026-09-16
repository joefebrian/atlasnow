"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locale";

type SetupStep = {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  href?: string;
  hrefLabel?: string;
};

type Status = {
  oauthConfigured: boolean;
  mockPreferred?: boolean;
  appBaseUrl: string;
  productionOrigin?: string;
  productionRedirectUri?: string;
  redirectUri: string;
  redirectUris?: string[];
  connector: null | {
    id: string;
    status: string;
    mode: string;
    accountEmail: string | null;
    displayName: string | null;
    lastSyncAt: string | null;
    lastError: string | null;
  };
  stats: {
    remoteCount: number;
    mappedCount: number;
    locationCount: number;
    unmappedRemote: number;
    unmappedLocal: number;
  };
  recentRuns: {
    id: string;
    kind: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    error: string | null;
    statsJson: string | null;
  }[];
  setup: SetupStep[];
};

export function DataHealthPanel({ locale }: { locale: Locale }) {
  const router = useRouter();
  const search = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/google/status", { credentials: "same-origin" });
    if (res.status === 403) {
      setErr("Agency staff only — log in as admin@p2plabs.local");
      return;
    }
    const data = await res.json();
    setStatus(data);
  }, []);

  useEffect(() => {
    void load();
    const g = search.get("google");
    const m = search.get("msg");
    if (g === "connected") {
      setMsg(
        "Google OAuth connected. Next: click Refresh list to pull Business Profile locations."
      );
    }
    if (g === "error" && m) setErr(decodeURIComponent(m));
  }, [load, search]);

  async function sync(force = false) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/google/sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Sync failed");
        setBusy(false);
        return;
      }
      const src = data.source === "cache" ? "cache" : "Google live";
      setMsg(
        data.message ||
          `${src}: ${data.count} locations` +
            (data.cacheAgeSeconds != null ? ` (${data.cacheAgeSeconds}s old)` : "")
      );
      await load();
      setBusy(false);
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Google Business Profile connector?")) return;
    setBusy(true);
    await fetch("/api/google/disconnect", { method: "POST", credentials: "same-origin" });
    setMsg("Disconnected. Connect again with a live Google agency account when ready.");
    await load();
    setBusy(false);
  }

  async function autoMap() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/google/auto-map", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Auto-map failed");
        setBusy(false);
        return;
      }
      setMsg(`Auto-map: ${data.mapped} mapped, ${data.skipped} skipped (by store code)`);
      await load();
      setBusy(false);
      router.refresh();
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  const isMock = status?.connector?.mode === "MOCK";
  const hasLiveSession =
    !isMock &&
    Boolean(status?.connector?.accountEmail) &&
    (status?.connector?.status === "CONNECTED" ||
      status?.connector?.status === "ERROR" ||
      status?.connector?.mode === "LIVE");
  const liveConnected = hasLiveSession;
  const quotaBlocked = Boolean(
    status?.connector?.lastError?.toLowerCase().includes("quota")
  );

  return (
    <div className="an-section">
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

      {isMock && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Legacy mock connector detected</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
            Data Health no longer uses mock Google data. Disconnect this connector, configure
            OAuth under Settings → API, then Connect Google with your agency account.
          </p>
          <button
            type="button"
            className="mt-3 an-btn text-sm border border-amber-300 bg-white text-amber-900"
            disabled={busy}
            onClick={disconnect}
          >
            Disconnect mock
          </button>
        </div>
      )}

      {/* Connection process */}
      <div className="an-card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-900">
          How to connect Google Business Profile (live)
        </h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
          One agency Google account manages many client listings. AtlasNow stores{" "}
          <strong>one OAuth connection</strong>, then maps each Google location to a client
          branch (<code className="font-mono">atlas_location_id</code>). No per-client Gmail
          OAuth.
        </p>

        <ol className="mt-5 space-y-3">
          {(status?.setup || DEFAULT_SETUP).map((step, idx) => (
            <li
              key={step.id}
              className={`flex gap-3 rounded-2xl border px-4 py-3 ${
                step.done
                  ? "border-emerald-100 bg-emerald-50/50"
                  : "border-slate-100 bg-slate-50/80"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step.done
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-500 ring-1 ring-slate-200"
                }`}
              >
                {step.done ? "✓" : idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{step.title}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{step.detail}</p>
                {step.href && (
                  <Link
                    href={step.href}
                    className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    {step.hrefLabel || "Open"} →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>

        {status && (
          <div className="mt-4 space-y-3 rounded-xl bg-slate-50 px-4 py-3 text-[11px] text-slate-500 ring-1 ring-slate-100">
            <div>
              <span className="font-semibold text-slate-600">Domain</span>{" "}
              <code className="font-mono text-slate-800">
                {status.productionOrigin || "https://atlasnow.co"}
              </code>
            </div>
            <div>
              <span className="font-semibold text-slate-600">
                Authorized redirect URIs
              </span>{" "}
              (add <em>all</em> of these on the Google Cloud OAuth Web client —{" "}
              <code className="font-mono">/api/google/oauth/callback</code> is Business
              Profile; <code className="font-mono">/api/auth/google/callback</code> is
              Sign up with Google):
            </div>
            <ul className="mt-1 space-y-1">
              {(
                status.redirectUris || [
                  status.productionRedirectUri ||
                    "https://atlasnow.co/api/google/oauth/callback",
                  "http://localhost:3000/api/google/oauth/callback",
                ]
              ).map((uri) => (
                <li key={uri}>
                  <code className="block break-all font-mono text-slate-800">{uri}</code>
                </li>
              ))}
            </ul>
            <div className="mt-1 border-t border-slate-200/80 pt-2">
              Active for this environment:{" "}
              <code className="font-mono text-slate-700">{status.redirectUri}</code>
              <span className="text-slate-400">
                {" "}
                (from APP_BASE_URL / Settings → App base URL)
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Connector"
          value={status?.connector?.status || "—"}
          hint={
            status?.connector
              ? status.connector.mode === "LIVE"
                ? "LIVE Google API"
                : status.connector.mode
              : "not connected"
          }
        />
        <Stat label="Remote Google locs" value={status?.stats.remoteCount ?? "—"} />
        <Stat label="Mapped" value={status?.stats.mappedCount ?? "—"} />
        <Stat label="Atlas locations" value={status?.stats.locationCount ?? "—"} />
      </div>

      <div className="an-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Google Business Profile connector
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
              Live OAuth only. <strong>Refresh list</strong> uses cached locations when
              fresh (&lt;15 min) to protect Google RPM quota. <strong>Force refresh</strong>{" "}
              always calls Google (rate-limited ~5 req/s + exponential backoff on 429). Then
              map remotes to Atlas locations.
            </p>
            {status?.connector?.accountEmail && (
              <p className="mt-2 text-xs font-medium text-slate-700">
                Account: {status.connector.accountEmail}
                {isMock ? " · MOCK (disconnect)" : " · LIVE"}
              </p>
            )}
            {status?.connector?.lastSyncAt && (
              <p className="mt-1 text-[11px] text-slate-400">
                Last sync: {formatDateTime(status.connector.lastSyncAt, locale)}
              </p>
            )}
            {status?.connector?.lastError && (
              <div className="mt-2 max-w-xl rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-800">
                {status.connector.lastError}
                {quotaBlocked && (
                  <p className="mt-2 font-medium text-rose-900">
                    Tip: wait ~1–2 minutes, then use <strong>Refresh list</strong> (do not
                    spam Connect). OAuth already works — only the list API hit the RPM cap.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!liveConnected && (
              <>
                {status?.oauthConfigured ? (
                  <a href="/api/google/oauth/start" className="an-btn-primary text-sm">
                    Connect Google
                  </a>
                ) : (
                  <Link href="/settings/api" className="an-btn-primary text-sm">
                    Configure OAuth first
                  </Link>
                )}
              </>
            )}
            {liveConnected && (
              <>
                <button
                  type="button"
                  className="an-btn-primary text-sm"
                  disabled={busy}
                  onClick={() => sync(false)}
                  title="Use DB cache if last sync < 15 min (avoids Google quota). Safe default."
                >
                  {busy ? "Syncing…" : "Refresh list"}
                </button>
                <button
                  type="button"
                  className="an-btn-ghost text-sm"
                  disabled={busy}
                  onClick={() => sync(true)}
                  title="Always call Google APIs (rate-limited + exponential backoff on 429)"
                >
                  {busy ? "…" : "Force refresh"}
                </button>
                <button
                  type="button"
                  className="an-btn-soft text-sm"
                  disabled={busy}
                  onClick={autoMap}
                >
                  Auto-map by code
                </button>
                <Link href="/data-health/map" className="an-btn-primary text-sm">
                  Map locations
                </Link>
                <button
                  type="button"
                  className="an-btn text-sm border border-rose-200 bg-rose-50 text-rose-700"
                  disabled={busy}
                  onClick={disconnect}
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-100">
            <div className="text-[10px] font-bold uppercase text-slate-400">OAuth app</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">
              {status?.oauthConfigured ? "Ready" : "Missing credentials"}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-100">
            <div className="text-[10px] font-bold uppercase text-slate-400">
              Unmapped remotes
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-800">
              {status?.stats.unmappedRemote ?? "—"}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-100">
            <div className="text-[10px] font-bold uppercase text-slate-400">
              Local without Google map
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-800">
              {status?.stats.unmappedLocal ?? "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="an-table-wrap">
        <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Recent sync runs</h3>
        </div>
        <table className="an-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Kind</th>
              <th>Status</th>
              <th>Stats / error</th>
            </tr>
          </thead>
          <tbody>
            {!status?.recentRuns?.length ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-slate-400">
                  No sync runs yet — connect Google then Refresh list
                </td>
              </tr>
            ) : (
              status.recentRuns.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs text-slate-500">
                    {formatDateTime(r.startedAt, locale)}
                  </td>
                  <td className="text-xs font-medium">{r.kind}</td>
                  <td>
                    <span
                      className={
                        r.status === "SUCCESS"
                          ? "an-badge-yes"
                          : r.status === "ERROR"
                            ? "an-badge-no"
                            : "an-badge-warn"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500">
                    {r.error || r.statsJson || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="an-card flex flex-wrap items-center justify-between gap-3 p-4 text-xs">
        <div>
          <p className="font-semibold text-slate-800">Also in Google settings</p>
          <p className="mt-0.5 text-slate-500">
            Search Console stays portfolio-honest until a real GSC connector ships.
          </p>
        </div>
        <Link href="/data-health/gsc" className="an-btn-ghost text-sm">
          GSC honest mode
        </Link>
      </div>

      <div className="an-card p-5 text-xs leading-relaxed text-slate-500">
        <p className="font-semibold text-slate-700">Google Cloud checklist</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            Enable <strong>My Business Account Management API</strong> and{" "}
            <strong>My Business Business Information API</strong>
          </li>
          <li>
            OAuth consent screen + Web client; authorized redirect = URI above
          </li>
          <li>
            Sign in with the <strong>agency</strong> Google account that is manager/owner on
            client profiles (GBP Agency model)
          </li>
          <li>
            Scope: <code className="font-mono">business.manage</code>
          </li>
          <li>
            After map: Location 360 → Push / Pull profile fields to Google
          </li>
        </ul>
      </div>
    </div>
  );
}

const DEFAULT_SETUP: SetupStep[] = [
  {
    id: "gcp",
    title: "Google Cloud APIs",
    detail: "Enable Account Management + Business Information APIs on the P2P / AtlasNow project.",
    done: false,
  },
  {
    id: "oauth",
    title: "OAuth client credentials",
    detail: "Paste Client ID & Secret in Settings → API Configuration (Google Business Profile).",
    done: false,
    href: "/settings/api",
    hrefLabel: "Open API Configuration",
  },
  {
    id: "connect",
    title: "Connect agency Google account",
    detail: "Click Connect Google and approve access with the agency manager account.",
    done: false,
  },
  {
    id: "sync",
    title: "Sync & map locations",
    detail: "Refresh list, then map each Google listing to an Atlas location (or auto-map by store code).",
    done: false,
  },
];

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="an-card px-4 py-3">
      <div className="an-label">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
}
