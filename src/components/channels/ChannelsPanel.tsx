"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { InfoTip } from "@/components/InfoTip";
import { WhatsAppCloudPanel } from "@/components/channels/WhatsAppCloudPanel";
import { TikTokPanel } from "@/components/channels/TikTokPanel";
import { TikTokGoPanel } from "@/components/channels/TikTokGoPanel";

type PageAsset = {
  id: string;
  name: string;
  instagram?: { id: string; username: string } | null;
};

type Mapping = {
  id: string;
  sourceType: string;
  externalId: string;
  externalLabel: string | null;
  locationId: string;
  location: { name: string };
};

type Loc = { id: string; name: string; city: string | null };
type ClientOpt = { id: string; name: string; slug: string };

export function ChannelsPanel({
  isAgency,
  initialClientId,
}: {
  isAgency: boolean;
  initialClientId: string | null;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(initialClientId || "");
  const [configured, setConfigured] = useState(true);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [status, setStatus] = useState<string>("DISCONNECTED");
  const [pages, setPages] = useState<PageAsset[]>([]);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [mapTo, setMapTo] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("https://atlasnow.co/api/webhooks/meta");
  const [pageWebhookFields, setPageWebhookFields] = useState("messages");
  const [igWebhookFields, setIgWebhookFields] = useState("messages");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const qs = clientId ? `?client=${encodeURIComponent(clientId)}` : "";
    const res = await fetch(`/api/meta/status${qs}`, { credentials: "same-origin" });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Failed to load channels");
      setLoading(false);
      return;
    }
    setConfigured(Boolean(data.configured));
    setClients(data.clients || []);
    setStatus(data.connector?.status || "DISCONNECTED");
    setPages(data.pages || []);
    setLocations(data.locations || []);
    setMappings(data.mappings || []);
    if (typeof data.webhookUrl === "string" && data.webhookUrl) {
      setWebhookUrl(data.webhookUrl);
    }
    if (typeof data.pageWebhookFields === "string" && data.pageWebhookFields) {
      setPageWebhookFields(data.pageWebhookFields);
    }
    if (typeof data.igWebhookFields === "string" && data.igWebhookFields) {
      setIgWebhookFields(data.igWebhookFields);
    }
    if (!clientId && data.tenantId) setClientId(data.tenantId);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const e = sp.get("meta_error");
    const ok = sp.get("meta");
    if (e) setErr(e);
    if (ok === "connected") {
      setMsg(
        "Facebook Login granted. This Page is subscribed to message webhooks. Map each Page / Instagram account to a branch, then open Conversations to send a live reply."
      );
    }
  }, []);

  function mappedLabel(sourceType: string, externalId: string) {
    return mappings.find(
      (m) => m.sourceType === sourceType && m.externalId === externalId
    );
  }

  async function mapAsset(
    sourceType: "FACEBOOK" | "INSTAGRAM",
    externalId: string,
    label: string,
    key: string
  ) {
    const locationId = mapTo[key];
    if (!locationId) {
      setErr("Pick a branch first");
      return;
    }
    setErr(null);
    const res = await fetch("/api/meta/map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        tenantId: clientId || undefined,
        locationId,
        sourceType,
        externalId,
        label,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Map failed");
      return;
    }
    setMsg(
      "Mapped. Incoming DMs from this Page / Instagram account will open in Conversations for that branch."
    );
    await load();
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Meta for this client?")) return;
    const qs = clientId ? `?client=${encodeURIComponent(clientId)}` : "";
    await fetch(`/api/meta/disconnect${qs}`, {
      method: "POST",
      credentials: "same-origin",
    });
    await load();
  }

  const connectHref = `/api/meta/oauth/start${
    clientId ? `?client=${encodeURIComponent(clientId)}` : ""
  }`;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Chat"
        badge="WhatsApp · Facebook · Instagram · TikTok"
        title="Chat apps"
        description="Connect WhatsApp, Facebook / Instagram, and TikTok inbox here. TikTok GO till (voucher redeem) is on this page too — not DMs."
      />

      {isAgency && (
        <div className="an-card p-4">
          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
            Client
          </label>
          <select
            className="an-input max-w-sm py-2"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              router.replace(
                e.target.value
                  ? `/settings/chat-apps?client=${e.target.value}`
                  : "/settings/chat-apps"
              );
            }}
          >
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
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

      <WhatsAppCloudPanel clientId={clientId} isAgency={isAgency} />

      <TikTokGoPanel clientId={clientId} isAgency={isAgency} />

      <TikTokPanel clientId={clientId} isAgency={isAgency} />

      <div className="an-card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              Messenger + Instagram
              <InfoTip label="What Connect Meta does">
                Connect Meta opens Facebook Login. You grant this app access to a Facebook Page you
                admin and, if linked, its Instagram Professional account. After you allow, we
                subscribe that Page to message webhooks so customer DMs appear in Conversations.
                We do not read insights or Page comments.
              </InfoTip>
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Status:{" "}
              <span className="font-semibold">
                {loading ? "…" : status === "CONNECTED" ? "Connected" : "Not connected"}
              </span>
              {!configured && " · Meta App missing in Settings → API"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={connectHref}
              title="Opens Facebook Login so you can grant this app access to your Facebook Page and Instagram Professional account"
              className={`an-btn-primary text-sm ${
                !configured || (isAgency && !clientId) ? "pointer-events-none opacity-40" : ""
              }`}
            >
              {status === "CONNECTED" ? "Reconnect with Facebook Login" : "Connect Meta"}
            </a>
            {status === "CONNECTED" && (
              <button
                type="button"
                className="an-btn-ghost text-sm"
                title="Remove Page tokens and stop receiving Messenger and Instagram DMs"
                onClick={() => void disconnect()}
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-slate-600">
          <li>
            Click <strong>Connect Meta</strong> — Facebook Login asks you to grant this app access
            to the Page (and linked Instagram Professional account).
          </li>
          <li>
            Select the Page in the table below (Messenger) and the Instagram handle. Map each to a
            branch. Unmapped DMs do not appear in Conversations.
          </li>
          <li>
            On connect we subscribe the Page to <em>messages</em> events (not comments). New DMs
            arrive at{" "}
            <code className="text-[11px]">{webhookUrl}</code>.
          </li>
        </ol>
        {status === "CONNECTED" && pages.length > 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-[13px] leading-relaxed text-slate-700">
            <p className="font-semibold text-emerald-900">Facebook Login granted · Page events subscribed</p>
            <ul className="mt-2 space-y-1.5">
              {pages.map((p) => (
                <li key={p.id}>
                  <span className="font-medium text-slate-900">{p.name}</span>
                  <span className="text-slate-500"> · Messenger Page {p.id}</span>
                  {p.instagram?.id ? (
                    <span className="block text-slate-500">
                      Instagram{" "}
                      {p.instagram.username ? `@${p.instagram.username}` : p.instagram.id}
                      {` · ${p.instagram.id}`}
                    </span>
                  ) : (
                    <span className="block text-slate-500">
                      No Instagram Professional account linked to this Page.
                    </span>
                  )}
                </li>
              ))}
              <li>
                Page webhook fields: <code className="text-[11px]">{pageWebhookFields}</code>
              </li>
              <li>
                Instagram webhook fields: <code className="text-[11px]">{igWebhookFields}</code>
              </li>
              <li>
                Callback: <code className="text-[11px]">{webhookUrl}</code>
              </li>
            </ul>
            <p className="mt-2 text-[12px] text-slate-500">
              A new customer DM to this Page is the webhook event. We do not subscribe to comments
              or insights.
            </p>
          </div>
        ) : null}
        <p className="text-[12px] leading-relaxed text-slate-500">
          The app is in Development: only people with a role or tester seat on the Meta app can send
          DMs that ingest. Public customers need App Review (Advanced Access) and Live mode. This is
          not a deploy button.
        </p>
      </div>

      {pages.length > 0 && (
        <div className="an-card overflow-hidden p-0">
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-sm font-semibold text-slate-900">Select Page / Instagram account</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
              Each row is an asset from Facebook Login. Map it to a branch so live DMs and replies
              use that Page or Instagram account.
            </p>
          </div>
          <table className="an-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Channel</th>
                <th>Mapped branch</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pages.flatMap((p) => {
                const fbMap = mappedLabel("FACEBOOK", p.id);
                const rows = [
                  <tr key={`fb-${p.id}`}>
                    <td>
                      <div className="font-semibold text-slate-800">{p.name}</div>
                      <div className="text-[11px] text-slate-400">Page ID {p.id}</div>
                    </td>
                    <td className="text-sm text-slate-600">Messenger</td>
                    <td className="text-sm text-slate-600">
                      {fbMap ? (
                        fbMap.location.name
                      ) : (
                        <select
                          className="an-input py-1.5 text-xs"
                          value={mapTo[`fb:${p.id}`] || ""}
                          onChange={(e) =>
                            setMapTo((m) => ({ ...m, [`fb:${p.id}`]: e.target.value }))
                          }
                          title="Choose the branch that should receive Messenger DMs from this Page"
                          aria-label={`Branch for Facebook Page ${p.name}`}
                        >
                          <option value="">Choose branch…</option>
                          {locations.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="text-right">
                      {!fbMap && (
                        <button
                          type="button"
                          className="an-btn-soft text-xs"
                          title="Map this Facebook Page to a branch so Messenger DMs open in Conversations"
                          onClick={() => void mapAsset("FACEBOOK", p.id, p.name, `fb:${p.id}`)}
                        >
                          Map Page
                        </button>
                      )}
                    </td>
                  </tr>,
                ];
                if (p.instagram?.id) {
                  const igMap = mappedLabel("INSTAGRAM", p.instagram.id);
                  const igName = p.instagram.username
                    ? `@${p.instagram.username}`
                    : p.instagram.id;
                  rows.push(
                    <tr key={`ig-${p.instagram.id}`}>
                      <td>
                        <div className="font-semibold text-slate-800">{igName}</div>
                        <div className="text-[11px] text-slate-400">
                          Instagram ID {p.instagram.id}
                        </div>
                      </td>
                      <td className="text-sm text-slate-600">Instagram Direct</td>
                      <td className="text-sm text-slate-600">
                        {igMap ? (
                          igMap.location.name
                        ) : (
                          <select
                            className="an-input py-1.5 text-xs"
                            value={mapTo[`ig:${p.instagram!.id}`] || ""}
                            onChange={(e) =>
                              setMapTo((m) => ({
                                ...m,
                                [`ig:${p.instagram!.id}`]: e.target.value,
                              }))
                            }
                            title="Choose the branch that should receive Instagram Direct from this account"
                            aria-label={`Branch for Instagram ${igName}`}
                          >
                            <option value="">Choose branch…</option>
                            {locations.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="text-right">
                        {!igMap && (
                          <button
                            type="button"
                            className="an-btn-soft text-xs"
                            title="Map this Instagram Professional account to a branch so Direct messages open in Conversations"
                            onClick={() =>
                              void mapAsset(
                                "INSTAGRAM",
                                p.instagram!.id,
                                igName,
                                `ig:${p.instagram!.id}`
                              )
                            }
                          >
                            Map Instagram
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }
                return rows;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
