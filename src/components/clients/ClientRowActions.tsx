"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClientRowActions({
  clientId,
  clientName,
  openLabel = "Open",
  contactEmail,
  canActivate = false,
  activateLabel = "Turn on login",
}: {
  clientId: string;
  clientName: string;
  openLabel?: string;
  contactEmail?: string | null;
  canActivate?: boolean;
  activateLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const ok = window.confirm(
      `Delete client “${clientName}”?\n\nThis removes the client workspace and all memberships on it. User accounts are kept (they may still exist on other clients).`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Delete failed");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      alert("Could not reach server");
      setBusy(false);
    }
  }

  async function onActivate() {
    if (!contactEmail) {
      alert("Add a contact email on the brand first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: contactEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Could not turn on login");
        setBusy(false);
        return;
      }
      if (data.login?.temporaryPassword) {
        alert(
          `Login is on.\n\nEmail: ${data.login.email}\nPassword: ${data.login.temporaryPassword}\n\nCopy this now — we do not show it again.`
        );
      }
      router.refresh();
    } catch {
      alert("Could not reach server");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {canActivate ? (
        <button
          type="button"
          className="an-btn-primary text-xs"
          disabled={busy}
          onClick={onActivate}
        >
          {busy ? "…" : activateLabel}
        </button>
      ) : null}
      <Link href={`/clients/${clientId}`} className="an-btn-soft text-xs">
        {openLabel}
      </Link>
      <button
        type="button"
        className="an-btn text-xs border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
        disabled={busy}
        onClick={onDelete}
      >
        {busy ? "…" : "Delete"}
      </button>
    </div>
  );
}
