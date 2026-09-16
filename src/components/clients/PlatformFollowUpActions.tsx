"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PlatformFollowUpActions({
  kind,
  id,
}: {
  kind: "agency" | "upgrade";
  id: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(path: string, body?: object) {
    setBusy(true);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : "{}",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  if (kind === "agency") {
    return (
      <button
        type="button"
        className="an-btn-primary text-xs"
        disabled={busy}
        onClick={() => run(`/api/agencies/${id}/activate`)}
      >
        {busy ? "…" : "Turn on login"}
      </button>
    );
  }

  return (
    <div className="flex justify-end gap-1.5">
      <button
        type="button"
        className="an-btn-ghost text-xs"
        disabled={busy}
        onClick={() => run(`/api/upgrade-requests/${id}`, { action: "reject" })}
      >
        Reject
      </button>
      <button
        type="button"
        className="an-btn-primary text-xs"
        disabled={busy}
        onClick={() => run(`/api/upgrade-requests/${id}`, { action: "approve" })}
      >
        {busy ? "…" : "Approve"}
      </button>
    </div>
  );
}
