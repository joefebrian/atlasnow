"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UiStatus = "none" | "starting" | "scan" | "working" | "failed" | "stopped" | "offline";

type StatusPayload = {
  configured?: boolean;
  uiStatus: UiStatus;
  label: string;
  phone?: string | null;
  atlasLocationId?: string;
  me?: { id?: string; pushName?: string } | null;
  error?: string;
};

/** Chromium stays up the whole time a QR is waiting. Kill it if nobody scans. */
const QR_WAIT_MS = 120_000;
const STATUS_POLL_MS = 4000;

export function WhatsAppConnectPanel({
  locationId,
  compact,
}: {
  locationId: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pairing, setPairing] = useState(false);
  const qrLoadedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch(`/api/locations/${locationId}/waha`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = (await res.json()) as StatusPayload & { error?: string };
    if (!res.ok) {
      setErr(data.error || "Could not read WhatsApp status");
      return data;
    }
    setStatus(data);
    return data;
  }, [locationId]);

  const loadQr = useCallback(async () => {
    const res = await fetch(`/api/locations/${locationId}/waha/qr`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) {
      setQr(null);
      return false;
    }
    const data = (await res.json()) as { mimetype?: string; data?: string };
    if (data.data) {
      setQr(`data:${data.mimetype || "image/png"};base64,${data.data}`);
      return true;
    }
    setQr(null);
    return false;
  }, [locationId]);

  const stopPairing = useCallback(async () => {
    setPairing(false);
    startedAtRef.current = null;
    qrLoadedRef.current = false;
    setQr(null);
    setCode(null);
    await fetch(`/api/locations/${locationId}/waha`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stop: true }),
    });
    await loadStatus();
  }, [locationId, loadStatus]);

  const connect = useCallback(
    async (reset = false) => {
      setBusy(true);
      setErr(null);
      setQr(null);
      setCode(null);
      setPairing(true);
      qrLoadedRef.current = false;
      startedAtRef.current = Date.now();
      try {
        const res = await fetch(`/api/locations/${locationId}/waha`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reset }),
        });
        const data = await res.json();
        if (!res.ok) {
          setPairing(false);
          startedAtRef.current = null;
          setErr(data.error || "Could not start WhatsApp session");
          setBusy(false);
          return;
        }
        setStatus((s) => ({
          ...(s || { uiStatus: "starting", label: data.label }),
          uiStatus: data.uiStatus,
          label: data.label,
          me: data.me,
        }));
        await loadStatus();
      } catch {
        setPairing(false);
        startedAtRef.current = null;
        setErr("Network error");
      } finally {
        setBusy(false);
      }
    },
    [locationId, loadStatus]
  );

  async function requestCode() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/locations/${locationId}/waha/pairing-code`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Pairing code not available — use the QR.");
        setBusy(false);
        return;
      }
      setCode(data.code);
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!window.confirm("Disconnect this branch WhatsApp from Atlas?")) return;
    setBusy(true);
    setPairing(false);
    try {
      await fetch(`/api/locations/${locationId}/waha`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      setQr(null);
      setCode(null);
      await loadStatus();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setPairing(false);
    qrLoadedRef.current = false;
    startedAtRef.current = null;
    setQr(null);
    setCode(null);
    setErr(null);
    void loadStatus();
  }, [locationId, loadStatus]);

  const ui = status?.uiStatus || "none";
  const waiting = ui === "scan" || ui === "starting";

  useEffect(() => {
    if (!pairing || (ui !== "scan" && ui !== "starting")) return;

    const t = window.setInterval(() => {
      if (startedAtRef.current && Date.now() - startedAtRef.current > QR_WAIT_MS) {
        setErr("QR expired. Click Connect when the store phone is ready to scan.");
        void stopPairing();
        return;
      }
      void (async () => {
        const s = await loadStatus();
        if (s?.uiStatus === "scan" && !qrLoadedRef.current) {
          const ok = await loadQr();
          if (ok) qrLoadedRef.current = true;
        }
        if (s?.uiStatus === "working") {
          setPairing(false);
          startedAtRef.current = null;
          qrLoadedRef.current = false;
          setQr(null);
          setCode(null);
        }
      })();
    }, STATUS_POLL_MS);

    return () => window.clearInterval(t);
  }, [pairing, ui, loadStatus, loadQr, stopPairing]);

  useEffect(() => {
    if (ui === "scan" && pairing && !qrLoadedRef.current) {
      void (async () => {
        const ok = await loadQr();
        if (ok) qrLoadedRef.current = true;
      })();
    }
    if (ui === "working") {
      setPairing(false);
      setQr(null);
      setCode(null);
    }
  }, [ui, pairing, loadQr]);

  return (
    <div className={compact ? "space-y-3" : "an-card space-y-3 p-5"}>
      {!compact && <h2 className="text-sm font-semibold text-slate-900">WhatsApp</h2>}
      <p className="text-[11px] leading-relaxed text-slate-500">
        Nothing starts until you click Connect. Then one QR appears for this branch.
        Scan it on the store phone (WhatsApp → Linked devices). After it shows
        Connected, chats land in Inbox. This server keeps a limited number of live
        numbers — connect one branch at a time.
      </p>
      {ui === "failed" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This number dropped. Reconnect wipes the dead session and shows a new QR —
          scan it again on the same store phone.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            ui === "working"
              ? "an-badge-yes"
              : waiting
                ? "an-badge-warn"
                : ui === "failed"
                  ? "an-badge-no"
                  : "an-badge-muted"
          }
        >
          {status?.label || "…"}
        </span>
        {status?.me?.id && (
          <span className="font-mono text-[11px] text-slate-500">
            {String(status.me.id).replace(/@c\.us$/i, "")}
          </span>
        )}
      </div>

      {pairing && ui === "scan" && qr && (
        <img
          src={qr}
          alt="WhatsApp QR"
          className="mx-auto h-48 w-48 rounded-xl border border-slate-200 bg-white p-2"
        />
      )}
      {pairing && ui === "starting" && (
        <p className="text-xs text-slate-400">Starting… QR appears in a few seconds.</p>
      )}
      {pairing && ui === "scan" && !qr && (
        <p className="text-xs text-slate-400">Waiting for QR…</p>
      )}
      {code && (
        <p className="text-center font-mono text-lg font-semibold tracking-[0.2em] text-slate-900">
          {code}
        </p>
      )}

      {err && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {err}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {ui !== "working" && !waiting && (
          <button
            type="button"
            className="an-btn-primary text-xs"
            disabled={busy}
            onClick={() => void connect(ui === "failed" || ui === "offline")}
          >
            {busy ? "…" : ui === "failed" || ui === "offline" ? "Reconnect WhatsApp" : "Connect WhatsApp"}
          </button>
        )}
        {waiting && pairing && (
          <button
            type="button"
            className="an-btn-ghost text-xs"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void stopPairing().finally(() => setBusy(false));
            }}
          >
            Cancel
          </button>
        )}
        {ui === "scan" && !pairing && (
          <button
            type="button"
            className="an-btn-primary text-xs"
            disabled={busy}
            onClick={() => {
              setPairing(true);
              startedAtRef.current = Date.now();
              qrLoadedRef.current = false;
              void loadQr().then((ok) => {
                if (ok) qrLoadedRef.current = true;
              });
            }}
          >
            Show QR
          </button>
        )}
        {ui === "scan" && pairing && (
          <button
            type="button"
            className="an-btn-ghost text-xs"
            disabled={busy}
            onClick={() => void requestCode()}
          >
            Pairing code
          </button>
        )}
        {ui === "working" && (
          <button
            type="button"
            className="an-btn-ghost text-xs text-rose-600"
            disabled={busy}
            onClick={() => void logout()}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
