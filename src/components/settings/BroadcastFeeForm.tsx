"use client";

import { useState } from "react";
import {
  DEFAULT_ATLAS_FEES,
  estimateBroadcast,
  formatIdr,
  INDONESIA,
  type AtlasFeeConfig,
} from "@/lib/broadcast/rates";

export function BroadcastFeeForm({ initial }: { initial: AtlasFeeConfig }) {
  const [fees, setFees] = useState<AtlasFeeConfig>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function set(key: keyof AtlasFeeConfig, raw: string) {
    const n = Number(raw.replace(",", "."));
    setFees((f) => ({ ...f, [key]: Number.isFinite(n) && n >= 0 ? n : 0 }));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/broadcast-fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(fees),
      });
      const json = (await res.json()) as { error?: string; fees?: AtlasFeeConfig };
      if (!res.ok) {
        setErr(json.error || "Could not save");
        return;
      }
      if (json.fees) setFees(json.fees);
      setMsg("Saved. Estimates on Broadcast use these numbers now.");
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  const m1 = estimateBroadcast({ kind: "marketing", count: 1, fees });
  const m100 = estimateBroadcast({ kind: "marketing", count: 100, fees });
  const u100 = estimateBroadcast({ kind: "utility", count: 100, fees });
  const s100 = estimateBroadcast({ kind: "session", count: 100, fees });

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-slate-600">
        Atlas fee per message = <strong>flat Rp</strong> + <strong>% of Meta</strong>. Meta’s Indonesia card
        (1 Oct 2026, used for estimates now): Marketing {formatIdr(INDONESIA.marketing)}, Utility / service{" "}
        {formatIdr(INDONESIA.utility)}. Change the margin here when you want more (or less) on top. Service
        Atlas add-on stays 0 until the founder locks it. The 24-hour window is only who we can reply to — it is not a free Meta category anymore.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Marketing · Rp
          <input
            className="an-input mt-1 w-full py-2"
            type="number"
            min={0}
            step="1"
            value={fees.marketing}
            onChange={(e) => set("marketing", e.target.value)}
          />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Utility · Rp
          <input
            className="an-input mt-1 w-full py-2"
            type="number"
            min={0}
            step="1"
            value={fees.utility}
            onChange={(e) => set("utility", e.target.value)}
          />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Service · Rp
          <span className="mt-0.5 block font-normal normal-case tracking-normal text-[11px] text-slate-400">
            Human HQ reply. Not “session 24h”. First 1,000/month are Meta-free.
          </span>
          <input
            className="an-input mt-1 w-full py-2"
            type="number"
            min={0}
            step="1"
            value={fees.session}
            onChange={(e) => set("session", e.target.value)}
          />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Authentication · Rp
          <input
            className="an-input mt-1 w-full py-2"
            type="number"
            min={0}
            step="1"
            value={fees.authentication}
            onChange={(e) => set("authentication", e.target.value)}
          />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400 sm:col-span-2">
          Extra margin on Meta (%)
          <input
            className="an-input mt-1 w-full max-w-xs py-2"
            type="number"
            min={0}
            step="1"
            value={fees.marginPct}
            onChange={(e) => set("marginPct", e.target.value)}
          />
          <span className="mt-1 block font-normal normal-case tracking-normal text-[12px] text-slate-500">
            Example: 25 = Atlas also takes 25% of Meta’s line. 0 = flat Rp only. Defaults: Marketing{" "}
            {DEFAULT_ATLAS_FEES.marketing}, Utility {DEFAULT_ATLAS_FEES.utility}, 0%.
          </span>
        </label>
      </div>

      <div className="rounded-2xl bg-[#eef8ff] px-4 py-3 text-[13px] text-slate-700 ring-1 ring-[#b7e1ff]/70">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">Live preview</p>
        <p className="mt-1">
          1 marketing: Meta {formatIdr(m1.metaEach)} + Atlas {formatIdr(m1.atlasEach)} + PPN {formatIdr(m1.ppnEstimate)} ={" "}
          <strong>{formatIdr(m1.total)}</strong>
        </p>
        <p>
          100 marketing: <strong>{formatIdr(m100.total)}</strong>
        </p>
        <p>
          100 utility: <strong>{formatIdr(u100.total)}</strong>
        </p>
        <p>
          100 service: <strong>{formatIdr(s100.total)}</strong> (Meta list rate; first 1,000/month are Meta-free)
        </p>
      </div>

      {err ? <p className="text-sm text-rose-700">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

      <button type="button" disabled={busy} className="an-btn-primary disabled:opacity-40" onClick={() => void save()}>
        {busy ? "Saving…" : "Save fees"}
      </button>
    </div>
  );
}
