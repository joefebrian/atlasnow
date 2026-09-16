"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Loc = {
  id: string;
  name: string;
  atlasLocationId: string;
  shopId: string;
  mappingId: string | null;
};

type Status = {
  merchantId: string;
  status: string;
  mode: string;
  hasToken: boolean;
  appKeysReady: boolean;
  lastError: string | null;
  demo: boolean;
  locations: Loc[];
};

export function TikTokGoPanel({
  clientId,
  isAgency,
}: {
  clientId: string;
  isAgency: boolean;
}) {
  const [data, setData] = useState<Status | null>(null);
  const [merchantId, setMerchantId] = useState("");
  const [shopDraft, setShopDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qs = clientId ? `?client=${encodeURIComponent(clientId)}` : "";
  const loyaltyHref = clientId ? `/loyalty?client=${encodeURIComponent(clientId)}` : "/loyalty";

  const load = useCallback(async () => {
    if (isAgency && !clientId) {
      setData(null);
      return;
    }
    const res = await fetch(`/api/tiktok-go/connect${qs}`, { credentials: "same-origin" });
    const json = (await res.json()) as Status & { error?: string };
    if (!res.ok) {
      setErr(json.error || "Could not load TikTok GO");
      return;
    }
    setErr(null);
    setData(json);
    setMerchantId(json.merchantId || "");
    const draft: Record<string, string> = {};
    for (const l of json.locations) draft[l.id] = l.shopId;
    setShopDraft(draft);
  }, [clientId, isAgency, qs]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(action: string, extra?: Record<string, string>) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/tiktok-go/connect${qs}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, merchantId, ...extra }),
    });
    const json = (await res.json()) as Status & { error?: string };
    setBusy(false);
    if (!res.ok) {
      setErr(json.error || "Failed");
      return;
    }
    setData(json);
    setMerchantId(json.merchantId || merchantId);
    if (action === "save_merchant") setMsg("Merchant ID saved. Next: merchant accepts AtlasNow in TikTok Merchant Portal, then Fetch token.");
    if (action === "fetch_token") setMsg("Token saved. Map each outlet, then kasir can scan a live TT- QR.");
    if (action === "demo_on") setMsg("Demo till on. Loyalty → Scan QR → sample buttons. Not a live TikTok redeem.");
    if (action === "map_shop") setMsg("Outlet mapped.");
  }

  const blocked = isAgency && !clientId;
  const stateLabel = blocked
    ? "Select a brand first"
    : !data
      ? "…"
      : data.demo
        ? "Demo till"
        : data.hasToken
          ? "Live token"
          : data.merchantId
            ? "Merchant ID saved · waiting token"
            : "Not connected";

  return (
    <div className="an-card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">TikTok GO till</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Not inbox DMs. Kasir tebus voucher yang sudah dibayar di TikTok.{" "}
          <Link href="/demo/go" className="font-semibold text-slate-800 underline">
            Public demo
          </Link>
          {" · "}
          <Link href={loyaltyHref} className="font-semibold text-slate-800 underline">
            Open Loyalty
          </Link>
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Status: <span className="font-semibold">{stateLabel}</span>
        </p>
      </div>

      {err && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>
      )}
      {msg && (
        <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-slate-700">{msg}</p>
      )}
      {data?.lastError && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{data.lastError}</p>
      )}

      <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-slate-600">
        <li>
          Merchant already on TikTok GO. Copy <b>Merchant ID</b> from Merchant Portal.
        </li>
        <li>Paste it here and save.</li>
        <li>
          P2P Labs (Developer Portal → Collaborative → Dining merchant authorization) requests
          AtlasNow for that ID.
        </li>
        <li>Merchant Portal → Application authorization → <b>Accept</b> AtlasNow.</li>
        <li>Fetch token. Then map each outlet. Kasir scans. TikTok marks the voucher used after Tebus.</li>
      </ol>

      <label className="block text-[11px] font-semibold text-slate-500">
        Merchant ID
        <input
          className="an-input mt-1 w-full py-2 font-mono text-sm"
          value={merchantId}
          disabled={blocked || busy}
          onChange={(e) => setMerchantId(e.target.value)}
          placeholder="From TikTok GO Merchant Portal"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="an-btn-primary text-sm" disabled={blocked || busy} onClick={() => void post("save_merchant")}>
          Save merchant ID
        </button>
        <button type="button" className="an-btn-ghost text-sm" disabled={blocked || busy || !data?.merchantId} onClick={() => void post("fetch_token")}>
          Fetch token
        </button>
        <button type="button" className="an-btn-ghost text-sm" disabled={blocked || busy} onClick={() => void post(data?.demo ? "demo_off" : "demo_on")}>
          {data?.demo ? "Turn demo till off" : "Turn demo till on"}
        </button>
      </div>
      {!data?.appKeysReady && (
        <p className="text-[12px] text-slate-500">
          Fetch token needs the AtlasNow TikTok client key in Settings → API. Demo till does not.
        </p>
      )}

      {data && data.locations.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-100">
          <table className="an-table">
            <thead>
              <tr>
                <th>Outlet</th>
                <th>TikTok shop ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.locations.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div className="font-semibold text-slate-800">{l.name}</div>
                    <div className="font-mono text-[10px] text-slate-400">{l.atlasLocationId}</div>
                  </td>
                  <td>
                    <input
                      className="an-input py-1.5 font-mono text-xs"
                      value={shopDraft[l.id] || ""}
                      onChange={(e) => setShopDraft((s) => ({ ...s, [l.id]: e.target.value }))}
                      placeholder="third_shop_id"
                    />
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="an-btn-soft text-xs"
                      disabled={busy}
                      onClick={() => void post("map_shop", { locationId: l.id, shopId: shopDraft[l.id] || l.atlasLocationId })}
                    >
                      {l.shopId ? "Update" : "Map"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[12px] leading-relaxed text-slate-500">
        Shop ID = TikTok outlet id, or the Atlas id above if you uploaded it as third_shop_id in
        Merchant Portal. A paid voucher is not a stamp. This desk shows tebus per outlet, not TikTok GMV.
      </p>
    </div>
  );
}
