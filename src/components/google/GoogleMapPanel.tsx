"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Remote = {
  id: string;
  externalId: string;
  title: string;
  storeCode: string | null;
  addressLine: string | null;
  locality: string | null;
  administrativeArea: string | null;
  phone: string | null;
  mapping: null | {
    locationId: string;
    locationName: string;
    atlasLocationId: string;
    code: string | null;
    clientName: string;
  };
};

type LocOpt = {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  atlasLocationId: string;
  tenant: { id: string; name: string };
  readiness: string;
};

type ClientOpt = { id: string; name: string; slug: string };

export function GoogleMapPanel({
  locations,
  clients,
}: {
  locations: LocOpt[];
  clients: ClientOpt[];
}) {
  const router = useRouter();
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [q, setQ] = useState("");
  const [unmappedOnly, setUnmappedOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [createTenant, setCreateTenant] = useState(clients[0]?.id || "");

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (unmappedOnly) qs.set("unmapped", "1");
    const res = await fetch(`/api/google/remote-locations?${qs}`, {
      credentials: "same-origin",
    });
    const data = await res.json();
    if (res.ok) setRemotes(data.remotes || []);
  }, [q, unmappedOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mapToExisting(remoteId: string) {
    const locationId = pick[remoteId];
    if (!locationId) {
      setErr("Select an Atlas location first");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/google/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ remoteId, locationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(
          data.error +
            (data.conflict ? ` (${data.conflict.name})` : "")
        );
        setBusy(false);
        return;
      }
      setMsg(`Mapped → ${data.location?.name}`);
      await load();
      setBusy(false);
      router.refresh();
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  async function createAndMap(remoteId: string) {
    if (!createTenant) {
      setErr("Select client for new location");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/google/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ remoteId, createUnderTenantId: createTenant }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Create+map failed");
        setBusy(false);
        return;
      }
      setMsg(`Created & mapped → ${data.location?.name}`);
      await load();
      setBusy(false);
      router.refresh();
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  return (
    <div className="an-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
            S3 · Map
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Google → Atlas locations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Link Google Business Profile remotes to immutable{" "}
            <code className="font-mono text-xs">atlas_location_id</code>.
          </p>
        </div>
        <Link href="/settings/google" className="an-btn-ghost text-sm">
          Google
        </Link>
      </div>

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

      <div className="an-card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
            Search remotes
          </label>
          <input
            className="an-input py-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title, code, city…"
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={unmappedOnly}
            onChange={(e) => setUnmappedOnly(e.target.checked)}
          />
          Unmapped only
        </label>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
            Create under client
          </label>
          <select
            className="an-input py-2"
            value={createTenant}
            onChange={(e) => setCreateTenant(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="an-table-wrap">
        <table className="an-table">
          <thead>
            <tr>
              <th>Google location</th>
              <th>Code</th>
              <th>City</th>
              <th>Mapped to</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {remotes.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-slate-400">
                  No remote locations. Connect Google (live OAuth) on Data Health, then Refresh list.
                </td>
              </tr>
            ) : (
              remotes.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{r.title}</div>
                    <div className="max-w-xs truncate font-mono text-[10px] text-slate-400">
                      {r.externalId}
                    </div>
                    <div className="text-[11px] text-slate-400">{r.addressLine || "—"}</div>
                  </td>
                  <td className="font-mono text-xs">{r.storeCode || "—"}</td>
                  <td className="text-sm text-slate-600">
                    {r.locality || "—"}
                    {r.administrativeArea ? (
                      <span className="block text-[11px] text-slate-400">
                        {r.administrativeArea}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {r.mapping ? (
                      <div>
                        <Link
                          href={`/locations/${r.mapping.locationId}`}
                          className="text-sm font-semibold text-indigo-600 hover:underline"
                        >
                          {r.mapping.locationName}
                        </Link>
                        <div className="text-[11px] text-slate-400">
                          {r.mapping.clientName} · {r.mapping.atlasLocationId}
                        </div>
                        <span className="an-badge-yes mt-1">MAPPED</span>
                      </div>
                    ) : (
                      <span className="an-badge-warn">Unmapped</span>
                    )}
                  </td>
                  <td>
                    {!r.mapping && (
                      <div className="flex min-w-[220px] flex-col gap-2">
                        <select
                          className="an-input py-1.5 text-xs"
                          value={pick[r.id] || ""}
                          onChange={(e) =>
                            setPick((p) => ({ ...p, [r.id]: e.target.value }))
                          }
                        >
                          <option value="">Select atlas location…</option>
                          {locations.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.tenant.name} · {l.name}
                              {l.code ? ` (${l.code})` : ""} · {l.readiness}
                            </option>
                          ))}
                        </select>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="an-btn-soft text-[11px] px-2 py-1"
                            disabled={busy}
                            onClick={() => mapToExisting(r.id)}
                          >
                            Map existing
                          </button>
                          <button
                            type="button"
                            className="an-btn-ghost text-[11px] px-2 py-1"
                            disabled={busy}
                            onClick={() => createAndMap(r.id)}
                          >
                            Create + map
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
