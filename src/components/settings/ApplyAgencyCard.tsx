"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n/locale";

export function ApplyAgencyCard({ locale }: { locale: Locale }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const id = locale === "id";

  async function apply() {
    setBusy(true);
    const res = await fetch("/api/upgrade-requests", { method: "POST" });
    setBusy(false);
    if (res.ok) setDone(true);
    else alert(id ? "Tidak bisa mengajukan" : "Could not apply");
  }

  return (
    <div className="an-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900">
        {id ? "Jadi agency" : "Become an agency"}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {id
          ? "Kalau kamu punya lebih dari satu merek, ajukan ke AtlasNow. Merek ini tetap merek pertama. Super Admin yang menyetujui dulu."
          : "If you run more than one brand, apply. This merk stays your first brand. Super Admin at atlasnow.co approves first."}
      </p>
      {done ? (
        <p className="mt-3 text-xs font-semibold text-emerald-700">
          {id ? "Pengajuan terkirim. Kami follow up." : "Request sent. We’ll follow up."}
        </p>
      ) : (
        <button
          type="button"
          className="an-btn-primary mt-3 text-xs"
          disabled={busy}
          onClick={apply}
        >
          {busy ? "…" : id ? "Ajukan jadi agency" : "Apply to become an agency"}
        </button>
      )}
    </div>
  );
}
