"use client";

import { useCallback, useEffect, useState } from "react";

type Status = {
  configured?: boolean;
  connected?: boolean;
  webhookUrl?: string;
  redirectUri?: string;
  error?: string;
};

export function TikTokPanel({
  clientId,
  isAgency,
}: {
  clientId: string;
  isAgency: boolean;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const qs = clientId ? `?client=${encodeURIComponent(clientId)}` : "";

  const load = useCallback(async () => {
    if (isAgency && !clientId) {
      setStatus(null);
      return;
    }
    const res = await fetch(`/api/tiktok/status${qs}`, { credentials: "same-origin" });
    const data = (await res.json()) as Status;
    if (!res.ok) {
      setErr(data.error || "Could not load TikTok");
      return;
    }
    setErr(null);
    setStatus(data);
  }, [clientId, isAgency, qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const blocked = isAgency && !clientId;
  const configured = Boolean(status?.configured);

  return (
    <div className="an-card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">TikTok</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Connect TikTok Business accounts this brand admins. Map each handle to a location.
          Unmapped DMs do not appear in Inbox. Webhook:{" "}
          <code className="font-mono text-[10px]">
            {status?.webhookUrl || "https://atlasnow.co/api/webhooks/tiktok"}
          </code>
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Status:{" "}
          <span className="font-semibold">
            {blocked
              ? "Select a brand first"
              : !status
                ? "…"
                : !configured
                  ? "TikTok app missing in Settings → API"
                  : status.connected
                    ? "Connected"
                    : "Keys ready · Connect next"}
          </span>
        </p>
      </div>

      {err && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {err}
        </p>
      )}

      <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-slate-600">
        <li>
          Super Admin pastes the TikTok client key and secret in Settings → API (AtlasNow
          developer app — not Meta, not another product).
        </li>
        <li>
          Connect TikTok with a Business Account that can receive DMs. A brand may connect more
          than one handle.
        </li>
        <li>Map each @handle to a branch or HQ. Then DMs land in Conversations.</li>
      </ol>
      <p className="text-[12px] leading-relaxed text-slate-500">
        Official Business Messaging only. Public customers need TikTok’s own app review. Testers
        only until then. This is not posting, ads, or a deploy button. Connect OAuth ships next.
      </p>
    </div>
  );
}
