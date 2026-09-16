"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function EnterAgencyButton({ agencyId, label = "Open" }: { agencyId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    setBusy(true);
    const res = await fetch("/api/auth/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "agency", agencyId }),
    });
    const data = (await res.json()) as { home?: string };
    if (!res.ok) {
      setBusy(false);
      return;
    }
    router.push(data.home || "/clients");
    router.refresh();
  }
  return (
    <button type="button" className="an-btn-primary text-xs" disabled={busy} onClick={onClick}>
      {busy ? "…" : label}
    </button>
  );
}
