"use client";

import { useCallback, useEffect, useState } from "react";

type Activity = { id: string; purpose: string; status: string; to: string; detail: string; at: string };
type History = { id: string; action: string; summary: string; at: string };

type Settings = {
  configured?: boolean;
  connected?: boolean;
  yolaIsolated?: boolean;
  phoneNumberId?: string | null;
  inboundEnabled?: boolean;
  paymentFollowUpEnabled?: boolean;
  marketingEnabled?: boolean;
  marketingAuthorized?: boolean;
  pilotMode?: boolean;
  flowId?: string;
  flowScreen?: string;
  flowCta?: string;
  inboundBody?: string;
  triggerPhrases?: string;
  paymentTriggerPhrases?: string;
  paymentMessageText?: string;
  allowlistMasked?: string[];
  allowlistCount?: number;
  activity?: Activity[];
  history?: History[];
  error?: string;
};

export function WorkspaceAutomationPanel({ clientId, isAgency }: { clientId: string; isAgency: boolean }) {
  const [status, setStatus] = useState<Settings | null>(null);
  const [inboundEnabled, setInboundEnabled] = useState(false);
  const [paymentFollowUpEnabled, setPaymentFollowUpEnabled] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [pilotMode, setPilotMode] = useState(true);
  const [flowId, setFlowId] = useState("");
  const [flowScreen, setFlowScreen] = useState("");
  const [flowCta, setFlowCta] = useState("");
  const [inboundBody, setInboundBody] = useState("");
  const [triggerPhrases, setTriggerPhrases] = useState("");
  const [paymentTriggerPhrases, setPaymentTriggerPhrases] = useState("");
  const [paymentMessageText, setPaymentMessageText] = useState("");
  const [allowlist, setAllowlist] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const blocked = isAgency && !clientId;
  const qs = clientId ? `?client=${encodeURIComponent(clientId)}` : "";

  const apply = useCallback((data: Settings) => {
    setStatus(data);
    setInboundEnabled(Boolean(data.inboundEnabled));
    setPaymentFollowUpEnabled(Boolean(data.paymentFollowUpEnabled));
    setMarketingEnabled(Boolean(data.marketingEnabled));
    setPilotMode(data.pilotMode !== false);
    setFlowId(data.flowId || "");
    setFlowScreen(data.flowScreen || "");
    setFlowCta(data.flowCta || "");
    setInboundBody(data.inboundBody || "");
    setTriggerPhrases(data.triggerPhrases || "");
    setPaymentTriggerPhrases(data.paymentTriggerPhrases || "");
    setPaymentMessageText(data.paymentMessageText || "");
    setAllowlist("");
  }, []);

  const load = useCallback(async () => {
    if (blocked) {
      setStatus(null);
      return;
    }
    const res = await fetch(`/api/whatsapp-cloud/automation${qs}`, { credentials: "same-origin" });
    const data = (await res.json()) as Settings;
    if (!res.ok) {
      setErr(data.error || "Could not load automation");
      return;
    }
    apply(data);
  }, [apply, blocked, qs]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(extra?: { allowlist?: string[]; action?: string }) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/whatsapp-cloud/automation${qs}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: extra?.action,
          inboundEnabled,
          paymentFollowUpEnabled,
          marketingEnabled,
          pilotMode,
          flowId,
          flowScreen,
          flowCta,
          inboundBody,
          triggerPhrases,
          paymentTriggerPhrases,
          paymentMessageText,
          allowlist: extra?.allowlist,
        }),
      });
      const data = (await res.json()) as Settings;
      if (!res.ok) {
        setErr(data.error || "Could not save automation");
        return;
      }
      apply(data);
      setMsg(extra?.action === "authorize_marketing" ? "Marketing authorized. Nothing was sent." : "Automation saved. Nothing was sent.");
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="an-card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">WhatsApp automation</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          Workspace controls for this connected number. A missing setting stays off. Saving does not message anyone.
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Status:{" "}
          <span className="font-semibold">
            {!status?.configured ? "Not configured" : status.connected ? "Saved" : "Saved, WhatsApp not connected"}
          </span>
          {status?.phoneNumberId ? ` · phone ${status.phoneNumberId}` : ""}
        </p>
      </div>

      {blocked && <p className="text-xs text-slate-400">Select a workspace first.</p>}
      {status?.yolaIsolated && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This WhatsApp number stays on its own workspace flags. Generic automation cannot turn it on.
        </p>
      )}
      {err && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>}
      {msg && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{msg}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-2 text-[12px] text-slate-700">
          <input type="checkbox" className="mt-0.5" checked={inboundEnabled} disabled={blocked || busy} onChange={(e) => setInboundEnabled(e.target.checked)} />
          <span>Inbound Flow Automation. Replies only when a trigger matches.</span>
        </label>
        <label className="flex items-start gap-2 text-[12px] text-slate-700">
          <input type="checkbox" className="mt-0.5" checked={paymentFollowUpEnabled} disabled={blocked || busy} onChange={(e) => setPaymentFollowUpEnabled(e.target.checked)} />
          <span>Payment Link Automation. Session text only. Held outside 24 hours.</span>
        </label>
        <label className="flex items-start gap-2 text-[12px] text-slate-700">
          <input type="checkbox" className="mt-0.5" checked={marketingEnabled} disabled={blocked || busy} onChange={(e) => setMarketingEnabled(e.target.checked)} />
          <span>Outbound Marketing. This switch does not send a campaign.</span>
        </label>
        <fieldset className="text-[12px] text-slate-700">
          <legend className="mb-1 font-medium">Pilot / Production Mode</legend>
          <label className="mr-3">
            <input type="radio" name="automation-mode" checked={pilotMode} disabled={blocked || busy} onChange={() => setPilotMode(true)} /> Pilot
          </label>
          <label>
            <input type="radio" name="automation-mode" checked={!pilotMode} disabled={blocked || busy} onChange={() => setPilotMode(false)} /> Production
          </label>
          <p className="mt-1 text-[11px] text-slate-500">Pilot sends only to the test allowlist. Production replies to the person who messaged this workspace.</p>
        </fieldset>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Active Flow ID
          <input className="an-input mt-1 w-full py-2 font-mono text-xs" value={flowId} disabled={blocked || busy} onChange={(e) => setFlowId(e.target.value)} placeholder="Published Flow ID" />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Flow screen
          <input className="an-input mt-1 w-full py-2 font-mono text-xs" value={flowScreen} disabled={blocked || busy} onChange={(e) => setFlowScreen(e.target.value)} placeholder="START" />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Flow button
          <input className="an-input mt-1 w-full py-2 text-xs" value={flowCta} disabled={blocked || busy} onChange={(e) => setFlowCta(e.target.value)} placeholder="Continue" />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400 sm:col-span-2">
          Inbound message
          <textarea className="an-input mt-1 w-full py-2 text-xs" rows={2} value={inboundBody} disabled={blocked || busy} onChange={(e) => setInboundBody(e.target.value)} />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Trigger rules
          <textarea className="an-input mt-1 w-full py-2 text-xs" rows={3} value={triggerPhrases} disabled={blocked || busy} onChange={(e) => setTriggerPhrases(e.target.value)} placeholder="One phrase per line" />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Payment triggers
          <textarea className="an-input mt-1 w-full py-2 text-xs" rows={3} value={paymentTriggerPhrases} disabled={blocked || busy} onChange={(e) => setPaymentTriggerPhrases(e.target.value)} placeholder="Optional. One phrase per line" />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400 sm:col-span-2">
          Payment message
          <textarea className="an-input mt-1 w-full py-2 text-xs" rows={2} value={paymentMessageText} disabled={blocked || busy} onChange={(e) => setPaymentMessageText(e.target.value)} />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400 sm:col-span-2">
          Test recipient allowlist
          <textarea className="an-input mt-1 w-full py-2 font-mono text-xs" rows={2} value={allowlist} disabled={blocked || busy} onChange={(e) => setAllowlist(e.target.value)} placeholder="Leave blank to keep the current list. One number per line replaces it." />
        </label>
      </div>
      <p className="text-[11px] text-slate-500">
        Current test recipients: {status?.allowlistCount ? status.allowlistMasked?.join(", ") : "none"}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="an-btn-primary text-sm"
          disabled={blocked || busy}
          onClick={() => void save(allowlist.trim() ? { allowlist: allowlist.split(/\s+/) } : undefined)}
        >
          {busy ? "…" : "Save automation"}
        </button>
        <button
          type="button"
          className="an-btn-ghost text-sm"
          disabled={blocked || busy || !status?.marketingEnabled || status.yolaIsolated}
          onClick={() => void save({ action: "authorize_marketing" })}
        >
          Authorize marketing
        </button>
        <button type="button" className="an-btn-ghost text-sm" disabled={blocked || busy} onClick={() => void save({ allowlist: [] })}>
          Clear allowlist
        </button>
      </div>
      <p className="text-[11px] text-slate-500">Authorize records permission only. It does not send a template or a campaign.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-[12px] font-semibold text-slate-800">Automation activity</h3>
          <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
            {(status?.activity || []).length === 0 && <li>No automation sends.</li>}
            {(status?.activity || []).map((item) => (
              <li key={item.id}>
                {item.at.slice(0, 16)} · {item.purpose} · {item.status} · {item.to} · {item.detail}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-[12px] font-semibold text-slate-800">Activation history</h3>
          <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
            {(status?.history || []).length === 0 && <li>No saved changes.</li>}
            {(status?.history || []).map((item) => (
              <li key={item.id}>
                {item.at.slice(0, 16)} · {item.action} · {item.summary}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
