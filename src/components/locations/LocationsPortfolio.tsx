"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { readinessBadgeClass } from "@/lib/locations/readiness";
import { summarizeClientsForPortfolio } from "@/lib/locations/portfolio";
import { freeOutletCapMessage, freeOutletCapReached, freeStoreOutletCap } from "@/lib/locations/plan";
import { WhatsAppConnectPanel } from "@/components/locations/WhatsAppConnectPanel";

type ClientOpt = { id: string; name: string; slug: string; plan?: string; storeCount?: number };

type Loc = {
  id: string;
  atlasLocationId: string;
  name: string;
  code: string | null;
  city: string | null;
  region: string | null;
  status: string;
  readiness: string;
  phone: string | null;
  kind?: string;
  tenant: ClientOpt;
  mappings: { sourceType: string }[];
};

export function LocationsPortfolio({
  initialLocations,
  clients,
  isAgency,
  selectedClientId,
}: {
  initialLocations: Loc[];
  clients: ClientOpt[];
  isAgency: boolean;
  selectedClientId: string | null;
}) {
  const showClientCards = isAgency && !selectedClientId;

  if (showClientCards) {
    return <ClientCardGrid clients={clients} locations={initialLocations} />;
  }

  return (
    <BranchTable
      initialLocations={initialLocations}
      clients={clients}
      clientId={selectedClientId}
      showBack={isAgency}
    />
  );
}

function ClientCardGrid({
  clients,
  locations,
}: {
  clients: ClientOpt[];
  locations: Loc[];
}) {
  const [q, setQ] = useState("");
  const summaries = useMemo(
    () => summarizeClientsForPortfolio(clients, locations),
    [clients, locations]
  );
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return summaries;
    return summaries.filter((c) =>
      `${c.name} ${c.slug} ${c.cities.join(" ")}`.toLowerCase().includes(needle)
    );
  }, [summaries, q]);

  const totals = useMemo(
    () => ({
      clients: summaries.length,
      locations: summaries.reduce((n, c) => n + c.locationCount, 0),
      ready: summaries.reduce((n, c) => n + c.readyCount, 0),
      mapped: summaries.reduce((n, c) => n + c.mappedCount, 0),
    }),
    [summaries]
  );

  return (
    <div className="an-section">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Clients" value={totals.clients} />
        <Stat label="Locations" value={totals.locations} />
        <Stat label="Ready / Mapped" value={totals.ready} />
        <Stat label="Google mapped" value={totals.mapped} />
      </div>

      <div className="an-card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Search clients
          </label>
          <input
            className="an-input py-2"
            placeholder="Brand, slug, city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Link href="/locations/new" className="an-btn-primary text-sm">
          Add location
        </Link>
        <Link href="/locations/import" className="an-btn-ghost text-sm">
          CSV import
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="an-card px-6 py-14 text-center">
          <p className="text-sm font-semibold text-slate-800">No clients match</p>
          <p className="mt-1 text-xs text-slate-500">
            Create a client first, then add their branches.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/locations?client=${c.id}`}
              className="an-card group p-5 transition hover:ring-2 hover:ring-indigo-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 group-hover:text-indigo-700">
                    {c.name}
                  </h2>
                  <p className="font-mono text-[11px] text-slate-400">{c.slug}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700">
                  {c.locationCount} {c.locationCount === 1 ? "branch" : "branches"}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <MiniStat
                  label="Ready"
                  value={c.readyCount}
                  hint="Name + address + phone filled"
                />
                <MiniStat
                  label="Phone"
                  value={c.phoneCount}
                  hint="From Maps fetch or typed in profile"
                />
                <MiniStat
                  label="Google"
                  value={c.mappedCount}
                  hint="Linked in Data Health → Map locations"
                />
              </dl>
              <p className="mt-3 truncate text-[11px] text-slate-500">
                {c.cities.length ? c.cities.slice(0, 3).join(" · ") : "No branches yet"}
                {c.cities.length > 3 ? ` +${c.cities.length - 3}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function BranchTable({
  initialLocations,
  clients,
  clientId,
  showBack,
}: {
  initialLocations: Loc[];
  clients: ClientOpt[];
  clientId: string | null;
  showBack: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialLocations);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [readiness, setReadiness] = useState("");
  const [city, setCity] = useState("");
  const [waha, setWaha] = useState<
    Record<string, { uiStatus: string; label: string }>
  >({});
  const [connectId, setConnectId] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialLocations);
  }, [initialLocations]);

  useEffect(() => {
    if (!clientId) return;
    void fetch(`/api/locations/waha-status?client=${encodeURIComponent(clientId)}`, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.sessions) setWaha(data.sessions);
      })
      .catch(() => {});
  }, [clientId]);

  async function deleteLocation(loc: Loc) {
    if (
      !window.confirm(
        `Delete “${loc.name}”? It leaves the portfolio (archived). atlas_location_id is kept and not reused.`
      )
    ) {
      return;
    }
    setDeletingId(loc.id);
    try {
      const res = await fetch(`/api/locations/${loc.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Delete failed");
        setDeletingId(null);
        return;
      }
      setRows((list) => list.filter((r) => r.id !== loc.id));
      setDeletingId(null);
      router.refresh();
    } catch {
      window.alert("Network error");
      setDeletingId(null);
    }
  }

  const scoped = useMemo(
    () => (clientId ? rows.filter((l) => l.tenant.id === clientId) : rows),
    [rows, clientId]
  );

  const filtered = useMemo(() => {
    return scoped.filter((l) => {
      if (readiness && l.readiness !== readiness) return false;
      if (city && !(l.city || "").toLowerCase().includes(city.toLowerCase())) return false;
      if (q) {
        const hay = `${l.name} ${l.code || ""} ${l.city || ""} ${l.atlasLocationId}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [scoped, readiness, city, q]);

  const stats = useMemo(
    () => ({
      total: scoped.length,
      ready: scoped.filter((l) => l.readiness === "READY" || l.readiness === "MAPPED").length,
      mapped: scoped.filter((l) => l.readiness === "MAPPED").length,
      partial: scoped.filter((l) => l.readiness === "PARTIAL" || l.readiness === "DRAFT").length,
    }),
    [scoped]
  );

  const addHref = clientId ? `/locations/new?tenantId=${clientId}` : "/locations/new";
  const importHref = clientId ? `/locations/import?tenantId=${clientId}` : "/locations/import";
  const selected = clients.find((c) => c.id === clientId);
  const storeCount = scoped.filter((l) => l.kind !== "HQ").length;
  const capped = Boolean(
    selected && freeOutletCapReached(selected.plan, storeCount)
  );

  return (
    <div className="an-section">
      {showBack && (
        <div>
          <Link href="/locations" className="text-xs font-semibold text-indigo-600 hover:underline">
            ← All clients
          </Link>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Locations" value={stats.total} />
        <Stat label="Ready / Mapped" value={stats.ready} />
        <Stat label="Google mapped" value={stats.mapped} />
        <Stat label="Draft / Partial" value={stats.partial} />
      </div>

      <div className="an-card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Search
          </label>
          <input
            className="an-input py-2"
            placeholder="Name, code, city, atlas id…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="min-w-[120px]">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
            City
          </label>
          <input
            className="an-input py-2"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Filter city"
          />
        </div>
        <div className="min-w-[140px]">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Readiness
          </label>
          <select
            className="an-input py-2"
            value={readiness}
            onChange={(e) => setReadiness(e.target.value)}
          >
            <option value="">All</option>
            {["DRAFT", "PARTIAL", "READY", "MAPPED", "BLOCKED"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {capped ? (
            <span className="an-btn-primary cursor-not-allowed text-sm opacity-50">Add location</span>
          ) : (
            <Link href={addHref} className="an-btn-primary text-sm">
              Add location
            </Link>
          )}
          <Link href={importHref} className="an-btn-ghost text-sm">
            CSV import
          </Link>
        </div>
      </div>

      {capped && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {freeOutletCapMessage()} Now at {storeCount}/{freeStoreOutletCap()} store outlets.
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="an-card px-6 py-14 text-center">
          <p className="text-sm font-semibold text-slate-800">No locations match</p>
          <p className="mt-1 text-xs text-slate-500">
            Add stores manually or import CSV for this client.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {capped ? (
              <span className="an-btn-primary cursor-not-allowed text-sm opacity-50">Add location</span>
            ) : (
              <Link href={addHref} className="an-btn-primary text-sm">
                Add location
              </Link>
            )}
            <button
              type="button"
              className="an-btn-ghost text-sm"
              onClick={() => {
                setQ("");
                setCity("");
                setReadiness("");
                router.refresh();
              }}
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : (
        <div className="an-table-wrap">
          <table className="an-table">
            <thead>
              <tr>
                <th>Location</th>
                <th>City</th>
                <th>Code</th>
                <th>Readiness</th>
                <th>WhatsApp</th>
                <th>Sources</th>
                <th>atlas_location_id</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{l.name}</div>
                    <div className="text-[11px] text-slate-400">{l.phone || "—"}</div>
                  </td>
                  <td className="text-sm text-slate-600">
                    {l.city || "—"}
                    {l.region ? (
                      <span className="block text-[11px] text-slate-400">{l.region}</span>
                    ) : null}
                  </td>
                  <td className="font-mono text-xs text-slate-600">{l.code || "—"}</td>
                  <td>
                    <span className={readinessBadgeClass(l.readiness)}>{l.readiness}</span>
                  </td>
                  <td>
                    {(() => {
                      const w = waha[l.id];
                      const ui = w?.uiStatus || "none";
                      const label = w?.label || (l.phone ? "Not linked" : "No phone");
                      const cls =
                        ui === "working"
                          ? "an-badge-yes"
                          : ui === "scan" || ui === "starting"
                            ? "an-badge-warn"
                            : ui === "failed"
                              ? "an-badge-no"
                              : "an-badge-muted";
                      if (l.kind === "HQ") {
                        return <span className="an-badge-muted">HQ Cloud API</span>;
                      }
                      return l.phone ? (
                        <button
                          type="button"
                          className={cls}
                          onClick={() => setConnectId(l.id)}
                        >
                          {label}
                        </button>
                      ) : (
                        <span className="an-badge-muted">{label}</span>
                      );
                    })()}
                  </td>
                  <td className="text-xs text-slate-500">
                    {l.mappings.length === 0
                      ? "—"
                      : l.mappings.map((m) => shortSource(m.sourceType)).join(", ")}
                  </td>
                  <td className="font-mono text-[10px] text-slate-400">
                    {l.atlasLocationId}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/locations/${l.id}`} className="an-btn-soft text-xs">
                        Open 360
                      </Link>
                      <Link href={`/locations/${l.id}?tab=Reputation`} className="an-btn-ghost text-xs">
                        Review QR
                      </Link>
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                        disabled={deletingId === l.id}
                        onClick={() => deleteLocation(l)}
                      >
                        {deletingId === l.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {connectId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div
            className="absolute inset-0"
            onClick={() => setConnectId(null)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {rows.find((r) => r.id === connectId)?.name || "WhatsApp"}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {rows.find((r) => r.id === connectId)?.phone}
                </p>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-700"
                onClick={() => setConnectId(null)}
              >
                ✕
              </button>
            </div>
            <WhatsAppConnectPanel locationId={connectId} compact />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="an-card px-4 py-3">
      <div className="an-label">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2" title={hint}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">{value}</div>
    </div>
  );
}

function shortSource(t: string) {
  if (t === "GOOGLE_BUSINESS_PROFILE") return "Google BP";
  if (t === "GOOGLE_MAPS") return "Maps";
  return t;
}
