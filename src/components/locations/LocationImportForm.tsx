"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CSV_TEMPLATE } from "@/lib/locations/csv";
import { freeOutletCapMessage, freeOutletCapReached } from "@/lib/locations/plan";

type ClientOpt = { id: string; name: string; slug: string; plan?: string; storeCount?: number };

type ReportRow = {
  row: number;
  action: string;
  name: string;
  code?: string;
  message?: string;
};

export function LocationImportForm({
  clients,
  defaultTenantId,
  isAgency,
}: {
  clients: ClientOpt[];
  defaultTenantId?: string;
  isAgency: boolean;
}) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState(defaultTenantId || clients[0]?.id || "");
  const [csv, setCsv] = useState(CSV_TEMPLATE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<{
    mode: string;
    summary: { rows: number; create: number; update: number; error: number };
    report: ReportRow[];
    parseIssues: { row: number; message: string }[];
  } | null>(null);

  async function run(mode: "dry-run" | "commit") {
    setBusy(true);
    setError("");
    setSummary(null);
    try {
      const res = await fetch("/api/locations/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ tenantId, csv, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
        setBusy(false);
        return;
      }
      setSummary(data);
      setBusy(false);
      if (mode === "commit") router.refresh();
    } catch {
      setError("Could not reach server");
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run("dry-run");
  }

  const selected = clients.find((c) => c.id === tenantId);
  const capped = Boolean(
    selected && freeOutletCapReached(selected.plan, selected.storeCount ?? 0)
  );

  if (clients.length === 0) {
    return (
      <div className="an-card p-6 text-sm text-slate-600">
        Create a client first, then import locations.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="an-card space-y-4 p-5 sm:p-6">
        {isAgency && (
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Client *
            </label>
            <select
              className="an-input"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            CSV
          </label>
          <textarea
            className="an-input min-h-[220px] resize-y font-mono text-xs leading-relaxed"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            required
          />
          <p className="mt-1.5 text-[11px] text-slate-400">
            Required column: <code>name</code>. Optional: code, address_line1, city, region,
            phone, website… Matching <code>code</code> updates existing rows.
          </p>
        </div>
        {capped && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            {freeOutletCapMessage()} New rows will fail until you upgrade.
          </p>
        )}
        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="an-btn-ghost" disabled={busy}>
            {busy ? "…" : "Dry-run"}
          </button>
          <button
            type="button"
            className="an-btn-primary"
            disabled={busy || !tenantId || capped}
            onClick={() => run("commit")}
          >
            {busy ? "…" : "Commit import"}
          </button>
          <button
            type="button"
            className="an-btn-soft text-xs"
            onClick={() => setCsv(CSV_TEMPLATE)}
          >
            Reset template
          </button>
        </div>
      </form>

      {summary && (
        <div className="an-card p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            {summary.mode === "commit" ? "Import committed" : "Dry-run report"}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Rows {summary.summary.rows} · create {summary.summary.create} · update{" "}
            {summary.summary.update} · errors {summary.summary.error}
          </p>
          {summary.parseIssues.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-rose-600">
              {summary.parseIssues.map((i, idx) => (
                <li key={idx}>
                  Row {i.row}: {i.message}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-slate-100">
            <table className="an-table text-xs">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Action</th>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {summary.report.map((r, i) => (
                  <tr key={i}>
                    <td>{r.row}</td>
                    <td>
                      <span className="an-badge-muted">{r.action}</span>
                    </td>
                    <td>{r.name}</td>
                    <td className="font-mono">{r.code || "—"}</td>
                    <td className="text-slate-500">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary.mode === "commit" && (
            <button
              type="button"
              className="an-btn-primary mt-4 text-sm"
              onClick={() => router.push("/locations")}
            >
              Back to portfolio
            </button>
          )}
        </div>
      )}
    </div>
  );
}
