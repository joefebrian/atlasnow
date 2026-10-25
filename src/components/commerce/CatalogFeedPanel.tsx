"use client";

import { useState } from "react";

type Issue = { sku: string; field: string; message: string };

type FeedResponse = {
  error?: string;
  ok?: boolean;
  networkCalled?: boolean;
  note?: string;
  missing?: Issue[];
  blockers?: Issue[];
  csv?: string;
  filename?: string;
};

export function CatalogFeedPanel({ tenantId, canRead }: { tenantId: string; canRead: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);

  async function download() {
    if (!canRead) return;
    setBusy(true);
    setError("");
    setNote("");
    setIssues([]);
    try {
      const response = await fetch("/api/commerce/catalog/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const body = (await response.json()) as FeedResponse;
      if (!response.ok) {
        setError(body.error || "Could not build the catalog file");
        return;
      }
      if (body.networkCalled) {
        setError("The catalog file tried to reach Meta. It was stopped.");
        return;
      }
      const found = [...(body.missing || []), ...(body.blockers || [])];
      if (!body.ok || !body.csv) {
        setIssues(found);
        setNote(body.note || "The file was not created.");
        return;
      }
      const blob = new Blob([body.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = body.filename || "meta-catalog.csv";
      link.click();
      URL.revokeObjectURL(url);
      setNote(body.note || "Catalog file downloaded. It was not sent to Meta.");
    } catch {
      setError("Could not build the catalog file");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="an-card mb-4 space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Meta catalog file</h2>
        <button type="button" className="an-btn-ghost text-sm" disabled={!canRead || busy} onClick={() => void download()}>
          {busy ? "Checking…" : "Download feed"}
        </button>
      </div>
      <p className="text-[12px] leading-relaxed text-slate-500">
        Downloads a file for a manual Meta upload. It does not send products to Meta. Live catalog push stays off. The file
        is created only after the catalog type matches a confirmed schema. An unknown type is not treated as commerce. A
        missing required field stops the file.
      </p>
      {note ? <p className="text-sm text-slate-700">{note}</p> : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {issues.length > 0 ? (
        <ul className="space-y-1 text-sm text-slate-700">
          {issues.map((issue, index) => (
            <li key={`${issue.sku}-${issue.field}-${index}`}>
              {issue.sku ? `${issue.sku}: ` : ""}
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
