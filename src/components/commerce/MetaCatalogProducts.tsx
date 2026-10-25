"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogPreviewItem } from "@/lib/commerce/catalog-import";

function formatIdr(amount: number) {
  return `IDR ${amount.toLocaleString("en-US")}`;
}

function mappingLabel(mapping: CatalogPreviewItem["mapping"]) {
  if (mapping === "IMPORTED") return "Imported";
  if (mapping === "CONFLICT") return "Conflict";
  return "Meta only";
}

function reviewLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "pending") return "Pending";
  if (status === "rejected") return "Rejected";
  if (status === "outdated") return "Outdated";
  return "Not reviewed";
}

function availabilityLabel(value: string) {
  if (value === "in stock") return "In stock";
  if (!value) return "Not set";
  return value;
}

export function MetaCatalogProducts({ tenantId, canWrite }: { tenantId: string; canWrite: boolean }) {
  const router = useRouter();
  const [products, setProducts] = useState<CatalogPreviewItem[]>([]);
  const [catalogId, setCatalogId] = useState("");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [importEnabled, setImportEnabled] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProducts([]);
    setCatalogId("");
    setEnabled(null);
    setImportEnabled(false);
    setSelected([]);
    setError("");
    setNotice("");
  }, [tenantId]);

  async function load() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/commerce/catalog/products?tenantId=${encodeURIComponent(tenantId)}`);
      const body = (await response.json()) as {
        error?: string;
        enabled?: boolean;
        discoveryEnabled?: boolean;
        importEnabled?: boolean;
        catalogId?: string;
        products?: CatalogPreviewItem[];
        truncated?: boolean;
      };
      if (!response.ok) {
        setError(body.error || "Meta products could not be loaded.");
        return;
      }
      const discovery = body.discoveryEnabled === true || (body.discoveryEnabled == null && body.enabled !== false);
      const writing = body.importEnabled === true;
      setEnabled(discovery);
      setImportEnabled(writing);
      setCatalogId(body.catalogId || "");
      setProducts(body.products || []);
      setTruncated(Boolean(body.truncated));
      setSelected([]);
      if (!discovery && !writing) setNotice("Catalog import is off. Live catalog push stays off.");
      else if (!writing) setNotice("This catalog list is read-only. Import into AtlasNow is off.");
    } catch {
      setError("Meta products could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function importSelected() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/commerce/catalog/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, catalogId, retailerIds: selected }),
      });
      const body = (await response.json()) as {
        error?: string;
        results?: { retailerId: string; outcome: string }[];
      };
      if (!response.ok) {
        setError(body.error || "Import did not finish.");
        return;
      }
      const created = (body.results || []).filter((row) => row.outcome === "created").length;
      const skipped = (body.results || []).filter((row) => row.outcome !== "created").length;
      setNotice(`${created} imported. ${skipped} left unchanged.`);
      setSelected([]);
      router.refresh();
      await load();
    } catch {
      setError("Import did not finish.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(retailerId: string) {
    setSelected((current) =>
      current.includes(retailerId) ? current.filter((id) => id !== retailerId) : [...current, retailerId]
    );
  }

  return (
    <section className="an-card mb-4 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Meta Catalog Products</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
            Products already in the connected Meta catalog. Import copies a selected item into the product master. It does not push changes back to Meta.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="an-btn-ghost text-sm" onClick={load} disabled={busy}>
            Load Meta products
          </button>
          {canWrite && importEnabled ? (
            <button type="button" className="an-btn-primary text-sm" onClick={importSelected} disabled={busy || selected.length === 0}>
              Import to AtlasNow
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="px-4 py-3 text-sm text-red-700" role="alert">{error}</p> : null}
      {notice ? <p className="px-4 py-3 text-sm text-slate-600" role="status">{notice}</p> : null}
      {truncated ? <p className="px-4 pb-3 text-[12px] text-slate-500">This list stopped after 500 Meta items.</p> : null}
      {enabled === null ? (
        <p className="px-4 py-4 text-sm text-slate-600">Load the connected catalog to see its products.</p>
      ) : products.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-600">{enabled ? "No Meta products were returned." : "Catalog import is off."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Use</th>
                <th className="px-4 py-2 font-semibold">Image</th>
                <th className="px-4 py-2 font-semibold">SKU</th>
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Price</th>
                <th className="px-4 py-2 font-semibold">Availability</th>
                <th className="px-4 py-2 font-semibold">Meta review</th>
                <th className="px-4 py-2 font-semibold">AtlasNow</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.metaProductId || product.retailerId} className="border-b border-slate-50 align-top">
                  <td className="px-4 py-3">
                    {product.importable && canWrite && importEnabled ? (
                      <input
                        type="checkbox"
                        checked={selected.includes(product.retailerId)}
                        onChange={() => toggle(product.retailerId)}
                        aria-label={`Import ${product.retailerId}`}
                      />
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200" />
                    ) : (
                      <span className="text-[12px] text-slate-400">No image</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{product.retailerId || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <p>{product.name || "—"}</p>
                    {product.note ? <p className="text-[12px] text-slate-500">{product.note}</p> : null}
                    {product.missing.length ? (
                      <p className="text-[12px] text-slate-500">Missing: {product.missing.join(", ")}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {product.unitPriceIdr == null ? product.priceLabel || "—" : formatIdr(product.unitPriceIdr)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{availabilityLabel(product.availability)}</td>
                  <td className="px-4 py-3 text-slate-700">{reviewLabel(product.reviewStatus)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <p>{mappingLabel(product.mapping)}</p>
                    <p className="text-[12px] text-slate-500">Last imported: {product.lastImportedAt ? "Yes" : "Not imported"}</p>
                    <p className="text-[12px] text-slate-500">Last synced: {product.lastSyncedAt ? "Yes" : "Not synced"}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
