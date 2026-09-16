"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ServiceQuotaChip } from "@/components/waba/ServiceQuotaChip";
import type { ServiceQuotaSnapshot } from "@/lib/waba/service-quota";

type Status = {
  connected?: boolean;
  phoneNumberId?: string | null;
  wabaId?: string | null;
  displayPhone?: string | null;
  webhookUrl?: string;
  error?: string;
  canEditOps?: boolean;
  quota?: ServiceQuotaSnapshot;
  es?: { appId?: string | null; configId?: string | null; ready?: boolean };
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
  const pending = useRef<{ code?: string; session?: unknown }>({});

  const qs = clientId ? `?client=${encodeURIComponent(clientId)}` : "";

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

  const finishEs = useCallback(async () => {
    const code = pending.current.code;
    const session = pending.current.session;
    if (!code || !session) return;
    pending.current = {};
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/whatsapp-cloud/embedded-signup${qs}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, session }),
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
      setMsg(
        data.coexistence
          ? `Connected${data.displayPhone ? ` · ${data.displayPhone}` : ""}. WhatsApp Business App stays on the phone.`
          : `HQ Cloud connected${data.displayPhone ? ` · ${data.displayPhone}` : ""}.`
      );
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }, [qs, load]);

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

  async function launchEs() {
    const appId = status?.es?.appId;
    const configId = status?.es?.configId;
    if (!appId || !configId) {
      setErr("Embedded Signup is not configured yet (Meta App ID + WhatsApp ES config).");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    pending.current = {};
    try {
      await loadFbSdk(appId);
      if (!window.FB) throw new Error("Facebook SDK missing");
      window.FB.login(
        (response) => {
          const code = response.authResponse?.code;
          if (!code) {
            setBusy(false);
            setErr("Facebook login did not return a code.");
            return;
          }
          pending.current.code = code;
          void finishEs();
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "whatsapp_business_app_onboarding",
            sessionInfoVersion: "3",
          },
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
    if (!window.confirm("Disconnect this brand HQ WhatsApp Cloud API?")) return;
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
        <h2 className="text-sm font-semibold text-slate-900">WhatsApp HQ (Cloud API)</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          One official business number per brand. Blast, loyalty, and HQ inbox use this
          number — not a store QR.
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
          Connect the shop WhatsApp <span className="font-medium text-slate-700">Business App</span>{" "}
          (green) — same number stays on the phone. Personal WhatsApp cannot; switch to Business App
          first. Webhook:{" "}
          <code className="font-mono text-[10px]">{status?.webhookUrl || "https://atlasnow.co/api/webhooks/whatsapp"}</code>
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Status:{" "}
          <span className="font-semibold">
            {status?.connected
              ? `Connected${status.displayPhone ? ` · ${status.displayPhone}` : ""}`
              : "Not connected"}
          </span>
        </p>
      </div>

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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="an-btn-primary text-sm"
          disabled={blocked || busy || !status?.es?.ready}
          onClick={() => void launchEs()}
        >
          {busy ? "…" : status?.connected ? "Reconnect WhatsApp Business" : "Connect WhatsApp Business"}
        </button>
        {status?.connected && (
          <button
            type="button"
            className="an-btn-ghost text-sm"
            disabled={busy}
            onClick={() => void disconnect()}
          >
            Disconnect
          </button>
        )}
      </div>
      {!status?.es?.ready && !blocked ? (
        <p className="text-[11px] text-amber-800">
          ES v4 needs Meta App ID + config in Settings → API. App is still In development — only
          testers/admins can finish the Facebook popup.
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
