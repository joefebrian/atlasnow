"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ServiceQuotaChip } from "@/components/waba/ServiceQuotaChip";
import type { ServiceQuotaSnapshot } from "@/lib/waba/service-quota";
import { embeddedSignupExtras, type ConnectionMode, type EsVersion } from "@/lib/conversations/es-launch";

type ConnectionView = {
  verifiedName?: string;
  displayPhone?: string;
  wabaId?: string;
  phoneNumberId?: string;
  connectionMode?: ConnectionMode;
  coexistence?: boolean;
  connectionStatus?: string;
  syncStatus?: string;
  syncDetail?: string;
  contactSync?: string;
  codeVerificationStatus?: string;
  lastWebhookAt?: string;
  lastHealthAt?: string;
  onboardingError?: string;
  status?: string;
};

type Status = {
  connected?: boolean;
  phoneNumberId?: string | null;
  wabaId?: string | null;
  displayPhone?: string | null;
  webhookUrl?: string;
  error?: string;
  canEditOps?: boolean;
  quota?: ServiceQuotaSnapshot;
  connection?: ConnectionView | null;
  automation?: {
    inboundEnabled: boolean;
    paymentFollowUpEnabled: boolean;
    marketingEnabled: boolean;
    pilotMode: boolean;
    configured: boolean;
  };
  es?: {
    appId?: string | null;
    configId?: string | null;
    ready?: boolean;
    version?: EsVersion;
    coexistenceLaunch?: boolean;
  };
};

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (r: { authResponse?: { code?: string } | null }) => void,
        opts: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

function loadFbSdk(appId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const init = () => {
      window.FB?.init({ appId, cookie: true, xfbml: false, version: "v21.0" });
      resolve();
    };
    if (window.FB) {
      init();
      return;
    }
    const prev = window.fbAsyncInit;
    window.fbAsyncInit = () => {
      prev?.();
      init();
    };
    if (document.querySelector('script[src*="connect.facebook.net"]')) return;
    const s = document.createElement("script");
    s.async = true;
    s.defer = true;
    s.crossOrigin = "anonymous";
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.onerror = () => reject(new Error("Could not load Facebook SDK"));
    document.head.appendChild(s);
  });
}

export function WhatsAppCloudPanel({
  clientId,
  isAgency,
}: {
  clientId: string;
  isAgency: boolean;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<ConnectionMode | null>(null);
  const [choosing, setChoosing] = useState(false);
  const pending = useRef<{ code?: string; session?: unknown; mode?: ConnectionMode | null }>({});

  const qs = clientId ? `?client=${encodeURIComponent(clientId)}` : "";
  const modeKey = `atlasnow.waConnectMode.${clientId || "self"}`;

  const load = useCallback(async () => {
    if (isAgency && !clientId) {
      setStatus(null);
      return;
    }
    const res = await fetch(`/api/whatsapp-cloud${qs}`, { credentials: "same-origin" });
    const data = (await res.json()) as Status;
    if (!res.ok) {
      setErr(data.error || "Could not load HQ WhatsApp");
      return;
    }
    setStatus(data);
    setPhoneNumberId(data.phoneNumberId || "");
    setWabaId(data.wabaId || "");
  }, [clientId, isAgency, qs]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(modeKey);
      if (stored === "COEXISTENCE" || stored === "CLOUD_API_ONLY") setMode(stored);
    } catch {
      /* session storage is only a convenience */
    }
  }, [modeKey]);

  const finishEs = useCallback(async () => {
    const code = pending.current.code;
    const session = pending.current.session;
    const chosen = pending.current.mode || mode;
    if (!code || !session || !chosen) return;
    pending.current = {};
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/whatsapp-cloud/embedded-signup${qs}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, session, mode: chosen }),
      });
      const data = (await res.json()) as {
        error?: string;
        displayPhone?: string | null;
        coexistence?: boolean;
      };
      if (!res.ok) {
        setErr(data.error || "Embedded Signup did not finish");
        return;
      }
      setChoosing(false);
      setMsg(
        data.coexistence
          ? `Connected${data.displayPhone ? ` · ${data.displayPhone}` : ""}. WhatsApp Business App + AtlasNow Cloud API. Automation stays off until you turn it on.`
          : `Cloud API connected${data.displayPhone ? ` · ${data.displayPhone}` : ""}. Automation stays off until you turn it on.`
      );
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }, [qs, load, mode]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (typeof event.origin !== "string" || !event.origin.endsWith("facebook.com")) return;
      let parsed: unknown = event.data;
      try {
        if (typeof event.data === "string") parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object") return;
      const data = parsed as { type?: string; event?: string };
      if (data.type !== "WA_EMBEDDED_SIGNUP") return;
      if (data.event === "CANCEL" || data.event === "ERROR") {
        pending.current = {};
        setErr(data.event === "CANCEL" ? "WhatsApp connect was cancelled." : "WhatsApp connect hit an error in Meta.");
        setBusy(false);
        return;
      }
      pending.current.session = data;
      void finishEs();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [finishEs]);

  function choose(next: ConnectionMode) {
    setMode(next);
    setErr(null);
    setMsg(null);
    try {
      window.sessionStorage.setItem(modeKey, next);
    } catch {
      /* the server still receives the mode on finish */
    }
  }

  async function launchEs(next: ConnectionMode) {
    if (next === "COEXISTENCE" && !status?.es?.coexistenceLaunch) {
      setErr("Coexistence launch stays off until an eligible WhatsApp Business App number is verified.");
      return;
    }
    const appId = status?.es?.appId;
    const configId = status?.es?.configId;
    if (!appId || !configId) {
      setErr("Embedded Signup is not configured yet (Meta App ID + WhatsApp ES config).");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    pending.current = { mode: next };
    try {
      await loadFbSdk(appId);
      if (!window.FB) throw new Error("Facebook SDK missing");
      const version: EsVersion = status?.es?.version === "v5" ? "v5" : "v4";
      window.FB.login(
        (response) => {
          const code = response.authResponse?.code;
          if (!code) {
            setBusy(false);
            setErr("Facebook login did not return a code. You can retry. AtlasNow does not ask for the WhatsApp code or Meta password.");
            return;
          }
          pending.current.code = code;
          pending.current.mode = next;
          void finishEs();
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: embeddedSignupExtras(next, version),
        }
      );
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : "Could not open Facebook");
    }
  }

  async function connect() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/whatsapp-cloud${qs}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId, wabaId, accessToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Could not connect");
        setBusy(false);
        return;
      }
      setAccessToken("");
      setMsg(
        data.displayPhone
          ? `HQ number ${data.displayPhone} connected. Chats land in Inbox.`
          : "HQ Cloud API connected. Chats land in Inbox."
      );
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function tickPayment(ok: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/whatsapp-cloud${qs}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodOk: ok }),
      });
      const data = (await res.json()) as Status;
      if (!res.ok) {
        setErr(data.error || "Could not save");
        return;
      }
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (
      !window.confirm(
        "Disconnect AtlasNow from this WhatsApp number? This does not delete the WhatsApp account or unregister the number at Meta. New Cloud API events stop until you connect again."
      )
    ) {
      return;
    }
    setBusy(true);
    await fetch(`/api/whatsapp-cloud${qs}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    setAccessToken("");
    await load();
    setBusy(false);
  }

  const blocked = isAgency && !clientId;

  return (
    <div className="an-card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">WhatsApp</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          One official business number per workspace. Inbox and automation use this number.
        </p>
      </div>

      {status?.connected && status.connection ? (
        <dl className="grid gap-2 text-[12px] text-slate-600 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-bold uppercase text-slate-400">Business display name</dt>
            <dd className="text-slate-900">{status.connection.verifiedName || "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase text-slate-400">Connected number</dt>
            <dd className="text-slate-900">{status.connection.displayPhone || status.displayPhone || "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase text-slate-400">WABA</dt>
            <dd className="font-mono text-[11px] text-slate-900">{status.connection.wabaId || "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase text-slate-400">Connection mode</dt>
            <dd className="text-slate-900">
              {status.connection.connectionMode === "COEXISTENCE" ? "Coexistence" : "Cloud API"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase text-slate-400">Connection health</dt>
            <dd className="text-slate-900">
              {status.connection.connectionStatus === "needs_attention" || status.connection.onboardingError
                ? "Needs attention"
                : "Healthy"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase text-slate-400">Meta verification</dt>
            <dd className="text-slate-900">{status.connection.codeVerificationStatus || "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase text-slate-400">Synchronization</dt>
            <dd className="text-slate-900">
              {status.connection.syncStatus || "—"}
              {status.connection.syncDetail ? ` · ${status.connection.syncDetail}` : ""}
              {status.connection.contactSync ? ` · ${status.connection.contactSync}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase text-slate-400">Last activity</dt>
            <dd className="text-slate-900">{status.connection.lastWebhookAt || status.connection.lastHealthAt || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-bold uppercase text-slate-400">Automation</dt>
            <dd className="text-slate-900">
              {`Inbound ${status.automation?.inboundEnabled ? "on" : "off"} · Follow-up ${
                status.automation?.paymentFollowUpEnabled ? "on" : "off"
              } · Marketing ${status.automation?.marketingEnabled ? "on" : "off"} · ${
                status.automation?.pilotMode === false ? "Production" : "Pilot"
              }`}
            </dd>
          </div>
          {status.connection.connectionMode === "COEXISTENCE" ? (
            <p className="sm:col-span-2 text-[12px] font-medium text-slate-800">
              WhatsApp Business App + AtlasNow Cloud API
            </p>
          ) : null}
          {status.connection.onboardingError ? (
            <p className="sm:col-span-2 text-[12px] text-amber-800">{status.connection.onboardingError}</p>
          ) : null}
        </dl>
      ) : (
        <p className="text-[11px] text-slate-500">Not connected</p>
      )}

      {status?.quota?.connected ? (
        <ServiceQuotaChip quota={status.quota} locale="en" />
      ) : null}

      {status?.canEditOps && status.quota?.connected ? (
        <label className="flex items-start gap-2 text-[12px] text-slate-600">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={Boolean(status.quota.paymentMethodOk)}
            disabled={busy}
            onChange={(e) => void tickPayment(e.target.checked)}
          />
          <span>Payment method on file in WhatsApp Manager (Super Admin). Needed before 30 Sep 2026.</span>
        </label>
      ) : null}

      {blocked && (
        <p className="text-xs text-slate-400">Select a brand first.</p>
      )}

      {err && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {err}
        </p>
      )}
      {msg && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {msg}
        </p>
      )}

      {(choosing || !status?.connected) && !blocked ? (
        <div className="space-y-3">
          <p className="text-[12px] font-medium text-slate-700">Connect WhatsApp</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={`rounded-xl border px-3 py-3 text-left ${mode === "COEXISTENCE" ? "border-slate-900" : "border-slate-200"}`}
              onClick={() => choose("COEXISTENCE")}
              disabled={busy}
            >
              <span className="block text-sm font-semibold text-slate-900">Use Existing WhatsApp Business App</span>
              <span className="mt-1 block text-[12px] leading-relaxed text-slate-500">
                Keep using your existing WhatsApp Business number and mobile app while enabling AtlasNow automation, shared inbox, and business workflows.
              </span>
            </button>
            <button
              type="button"
              className={`rounded-xl border px-3 py-3 text-left ${mode === "CLOUD_API_ONLY" ? "border-slate-900" : "border-slate-200"}`}
              onClick={() => choose("CLOUD_API_ONLY")}
              disabled={busy}
            >
              <span className="block text-sm font-semibold text-slate-900">Connect via WhatsApp Cloud API</span>
              <span className="mt-1 block text-[12px] leading-relaxed text-slate-500">
                Connect a dedicated business number to WhatsApp Business Platform for API messaging and automation.
              </span>
            </button>
          </div>
          {mode === "COEXISTENCE" ? (
            <ul className="list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-slate-600">
              <li>The number must already be an eligible WhatsApp Business App number. Meta decides eligibility.</li>
              <li>The WhatsApp Business App can stay in use for supported manual messaging.</li>
              <li>Some app features and companion-device behavior can change after onboarding.</li>
              <li>Group conversations and other unsupported data may not sync to AtlasNow.</li>
              <li>Cloud API messaging can incur Meta charges.</li>
              <li>Back up important business records before onboarding.</li>
              {!status?.es?.coexistenceLaunch ? (
                <li>Coexistence launch is off until a real Business App number is verified. Cloud API onboarding stays available.</li>
              ) : null}
            </ul>
          ) : null}
          <button
            type="button"
            className="an-btn-primary text-sm"
            disabled={blocked || busy || !status?.es?.ready || !mode || (mode === "COEXISTENCE" && !status?.es?.coexistenceLaunch)}
            onClick={() => mode && void launchEs(mode)}
          >
            {busy ? "…" : "Continue with Meta"}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status?.connected && !choosing ? (
          <button type="button" className="an-btn-ghost text-sm" disabled={busy} onClick={() => setChoosing(true)}>
            Reconnect
          </button>
        ) : null}
        {status?.connected ? (
          <button type="button" className="an-btn-ghost text-sm" disabled={busy} onClick={() => void disconnect()}>
            Disconnect
          </button>
        ) : null}
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        If Meta rejects the number, the reason appears here. Retry Embedded Signup, or ask a workspace admin for help.
        AtlasNow does not delete or migrate the WhatsApp account. Webhook:{" "}
        <code className="font-mono text-[10px]">{status?.webhookUrl || "https://atlasnow.co/api/webhooks/whatsapp"}</code>
      </p>
      {!status?.es?.ready && !blocked ? (
        <p className="text-[11px] text-amber-800">
          Embedded Signup needs Meta App ID + config in Settings → API. Only testers and admins can finish the Facebook popup while the app is in development.
        </p>
      ) : null}

      <details className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
        <summary className="cursor-pointer text-[12px] font-medium text-slate-600">
          P2P fallback — paste token (not coexistence)
        </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Phone number ID
          <input
            className="an-input mt-1 w-full py-2 font-mono text-xs"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            disabled={blocked || busy}
            placeholder="123456789012345"
          />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          WABA ID
          <input
            className="an-input mt-1 w-full py-2 font-mono text-xs"
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            disabled={blocked || busy}
            placeholder="WhatsApp Business Account ID"
          />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400 sm:col-span-2">
          System user access token
          <input
            className="an-input mt-1 w-full py-2 font-mono text-xs"
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            disabled={blocked || busy}
            placeholder={status?.connected ? "Paste a new token to rotate" : "EAAB…"}
            autoComplete="off"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="an-btn-ghost text-sm"
          disabled={blocked || busy}
          onClick={() => void connect()}
        >
          {busy ? "…" : "Save pasted token"}
        </button>
      </div>
      </details>
    </div>
  );
}
