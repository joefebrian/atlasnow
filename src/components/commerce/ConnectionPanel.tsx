"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CommerceConnectionView } from "@/lib/commerce/connection";

type Asset = { id: string; name: string };
type Phone = { id: string; wabaId: string; wabaName: string; masked: string };

function stateLabel(status: string) {
  switch (status) {
    case "SETUP_REQUIRED":
      return "Setup required";
    case "CONNECTED":
      return "Connected";
    case "PERMISSION_ERROR":
      return "Permission error";
    case "DISCONNECTED":
      return "Disconnected";
    default:
      return "Not connected";
  }
}

export function ConnectionPanel({
  tenantId,
  canWrite,
  initial,
}: {
  tenantId: string;
  canWrite: boolean;
  initial: CommerceConnectionView;
}) {
  const router = useRouter();
  const [connection, setConnection] = useState(initial);
  const [businesses, setBusinesses] = useState<Asset[]>([]);
  const [catalogs, setCatalogs] = useState<Asset[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [businessId, setBusinessId] = useState(initial.businessId);
  const [catalogId, setCatalogId] = useState(initial.catalogId);
  const [phoneId, setPhoneId] = useState(initial.phoneNumberId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const started = connection.whatsapp.status !== "NOT_CONNECTED" || connection.catalog.status !== "NOT_CONNECTED";

  async function read(response: Response) {
    return (await response.json()) as {
      error?: string;
      connection?: CommerceConnectionView;
      businesses?: Asset[];
      catalogs?: Asset[];
      phones?: Phone[];
    };
  }

  async function discover(selectedBusinessId = "") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/commerce/connection/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, businessId: selectedBusinessId }),
      });
      const body = await read(response);
      if (body.connection) setConnection(body.connection);
      if (!response.ok) {
        setError(body.error || "Could not read Meta assets");
        return;
      }
      setBusinesses(body.businesses || []);
      setCatalogs(body.catalogs || []);
      setPhones(body.phones || []);
    } catch {
      setError("Could not read Meta assets");
    } finally {
      setBusy(false);
    }
  }

  async function link() {
    const phone = phones.find((row) => row.id === phoneId);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/commerce/connection/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId,
          businessId,
          catalogId,
          wabaId: phone?.wabaId || "",
          phoneNumberId: phoneId,
        }),
      });
      const body = await read(response);
      if (!response.ok || !body.connection) {
        setError(body.error || "Could not link the catalog");
        return;
      }
      setConnection(body.connection);
      router.refresh();
    } catch {
      setError("Could not link the catalog");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/commerce/connection/disconnect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const body = await read(response);
      if (!response.ok || !body.connection) {
        setError(body.error || "Could not disconnect");
        return;
      }
      setConnection(body.connection);
      setCatalogs([]);
      setPhones([]);
      router.refresh();
    } catch {
      setError("Could not disconnect");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="an-card mb-4 space-y-3 px-4 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Catalog connection</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
            WhatsApp {stateLabel(connection.whatsapp.status)}. Catalog {stateLabel(connection.catalog.status)}. Checkout stays off.
            Live catalog push is off.
          </p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <a className="an-btn-primary text-sm" href={`/api/commerce/connection/start?tenantId=${encodeURIComponent(tenantId)}`}>
              Connect Meta
            </a>
            {started ? (
              <button type="button" className="an-btn-ghost text-sm" disabled={busy} onClick={() => void discover()}>
                {busy ? "Checking…" : "Find catalogs"}
              </button>
            ) : null}
            {started ? (
              <button type="button" className="an-btn-ghost text-sm" disabled={busy} onClick={disconnect}>
                Disconnect
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {connection.lastError ? <p className="text-[12px] text-red-700">{connection.lastError}</p> : null}
      {connection.missingScopes.length > 0 && started ? (
        <p className="text-[12px] text-slate-500">Missing permission: {connection.missingScopes.join(", ")}.</p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {businesses.length > 0 || catalogs.length > 0 || phones.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm text-slate-600">
            Business
            <select
              className="an-input mt-1"
              value={businessId}
              onChange={(event) => {
                const next = event.target.value;
                setBusinessId(next);
                setCatalogId("");
                setPhoneId("");
                setCatalogs([]);
                setPhones([]);
                if (next) void discover(next);
              }}
            >
              <option value="">Choose</option>
              {businesses.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name || row.id}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-600">
            Catalog
            <select className="an-input mt-1" value={catalogId} onChange={(event) => setCatalogId(event.target.value)}>
              <option value="">Choose</option>
              {catalogs.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name || row.id}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-600">
            WhatsApp number
            <select className="an-input mt-1" value={phoneId} onChange={(event) => setPhoneId(event.target.value)}>
              <option value="">Choose</option>
              {phones.map((row) => (
                <option key={row.id} value={row.id}>
                  {(row.wabaName || "WhatsApp") + (row.masked ? ` ${row.masked}` : "")}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {canWrite && catalogs.length > 0 ? (
        <button type="button" className="an-btn-primary text-sm" disabled={busy} onClick={link}>
          Link this catalog
        </button>
      ) : null}
      {connection.catalogId ? (
        <p className="text-[12px] text-slate-500">
          Linked catalog {connection.catalogName || connection.catalogId}. Offer status stays separate from Meta review.
        </p>
      ) : null}
    </section>
  );
}
