"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ConnectionPanel } from "@/components/commerce/ConnectionPanel";
import type { CommerceConnectionView } from "@/lib/commerce/connection";

type Variant = {
  sku: string;
  name: string;
  unitPriceIdr: number | null;
  status: string;
};

type Outlet = {
  locationId: string;
  availability: "AVAILABLE" | "UNAVAILABLE";
};

export type CommerceProductView = {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  hasImage: boolean;
  unitPriceIdr: number;
  status: string;
  availability: string;
  catalogEligibility: string;
  catalogEligibilityNote: string;
  updatedAt: string;
  variants: Variant[];
  outlets: { locationId: string; name: string; availability: string }[];
  catalog: {
    syncStatus: string;
    externalProductId: string;
    retailerId: string;
    lastError: string;
    reviewStatus: string;
    lastSyncedAt: string | null;
  };
};

type Draft = {
  sku: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  unitPriceIdr: string;
  availability: "AVAILABLE" | "UNAVAILABLE";
  catalogEligibility: "UNKNOWN" | "INELIGIBLE";
  catalogEligibilityNote: string;
  variants: Variant[];
  outlets: Outlet[];
};

type Location = { id: string; name: string };

const emptyDraft = (): Draft => ({
  sku: "",
  name: "",
  description: "",
  category: "",
  imageUrl: "",
  unitPriceIdr: "",
  availability: "AVAILABLE",
  catalogEligibility: "UNKNOWN",
  catalogEligibilityNote: "",
  variants: [],
  outlets: [],
});

function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function draftFrom(product: CommerceProductView): Draft {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    imageUrl: product.imageUrl || "",
    unitPriceIdr: String(product.unitPriceIdr),
    availability: product.availability === "UNAVAILABLE" ? "UNAVAILABLE" : "AVAILABLE",
    catalogEligibility: product.catalogEligibility === "INELIGIBLE" ? "INELIGIBLE" : "UNKNOWN",
    catalogEligibilityNote: product.catalogEligibilityNote,
    variants: product.variants.map((variant) => ({
      sku: variant.sku,
      name: variant.name,
      unitPriceIdr: variant.unitPriceIdr,
      status: variant.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
    })),
    outlets: product.outlets.map((outlet) => ({
      locationId: outlet.locationId,
      availability: outlet.availability === "UNAVAILABLE" ? "UNAVAILABLE" : "AVAILABLE",
    })),
  };
}

function productImageSrc(tenantId: string, product: CommerceProductView) {
  if (product.hasImage) return `/api/commerce/products/${product.id}/image?tenantId=${encodeURIComponent(tenantId)}`;
  return product.imageUrl || "";
}

type Props = {
  tenantId: string | null;
  canWrite: boolean;
  isAgency: boolean;
  brands: { id: string; name: string }[];
  products: CommerceProductView[];
  locations: Location[];
  connection: CommerceConnectionView;
  commerceError: string;
};

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

function syncLabel(status: string) {
  switch (status) {
    case "BLOCKED":
      return "Blocked";
    case "PREVIEWED":
      return "Preview only";
    case "PENDING":
      return "Pending";
    case "SUBMITTED":
      return "Submitted";
    case "PROCESSING":
      return "Processing";
    case "SYNCED":
      return "Synced";
    case "FAILED":
      return "Failed";
    case "OUTDATED":
      return "Needs another sync";
    default:
      return "Not connected";
  }
}

function reviewLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "Waiting on Meta";
    case "APPROVED":
      return "Meta approved";
    case "REJECTED":
      return "Meta rejected";
    default:
      return "Not reviewed by Meta";
  }
}

export function CommerceDesk({ tenantId, canWrite, isAgency, brands, products, locations, connection, commerceError }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "edit" | "detail">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revision, setRevision] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "ARCHIVED" | "ALL">("ACTIVE");
  const [outletQuery, setOutletQuery] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [clearImage, setClearImage] = useState(false);
  const [error, setError] = useState(commerceError);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewText, setPreviewText] = useState("");

  useEffect(() => {
    setMode("list");
    setEditingId(null);
    setRevision(null);
    setDraft(emptyDraft());
    setQuery("");
    setError("");
    setNotice("");
    setFile(null);
    setPreview(null);
  }, [tenantId]);

  const editing = products.find((product) => product.id === editingId) ?? null;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      if (statusFilter !== "ALL" && product.status !== statusFilter) return false;
      if (!q) return true;
      return product.name.toLowerCase().includes(q) || product.sku.toLowerCase().includes(q);
    });
  }, [products, query, statusFilter]);

  const outletShown = useMemo(() => {
    const q = outletQuery.trim().toLowerCase();
    return locations.filter((location) => !q || location.name.toLowerCase().includes(q));
  }, [locations, outletQuery]);

  function resetMedia() {
    setFile(null);
    setPreview(null);
    setClearImage(false);
  }

  function startNew() {
    setMode("edit");
    setEditingId(null);
    setRevision(null);
    setDraft(emptyDraft());
    resetMedia();
    setError("");
    setNotice("");
  }

  function startEdit(product: CommerceProductView) {
    setMode("edit");
    setEditingId(product.id);
    setRevision(product.updatedAt);
    setDraft(draftFrom(product));
    resetMedia();
    setError("");
    setNotice("");
  }

  function startDetail(product: CommerceProductView) {
    setMode("detail");
    setEditingId(product.id);
    setError("");
    setNotice("");
  }

  async function readJson(response: Response) {
    return (await response.json()) as { error?: string; product?: CommerceProductView };
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !canWrite) return;
    const price = Number(draft.unitPriceIdr);
    if (!Number.isInteger(price)) {
      setError("Price must be a whole rupiah amount.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(editingId ? `/api/commerce/products/${editingId}` : "/api/commerce/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId,
          expectedUpdatedAt: revision,
          sku: draft.sku,
          name: draft.name,
          description: draft.description,
          category: draft.category,
          imageUrl: draft.imageUrl,
          unitPriceIdr: price,
          status: "ACTIVE",
          availability: draft.availability,
          catalogEligibility: draft.catalogEligibility,
          catalogEligibilityNote: draft.catalogEligibilityNote,
          variants: draft.variants,
          outlets: draft.outlets,
        }),
      });
      const body = await readJson(response);
      if (!response.ok || !body.product) {
        setError(body.error || "Could not save the product");
        return;
      }
      let imageError = "";
      if (file) {
        const form = new FormData();
        form.set("tenantId", tenantId);
        form.set("file", file);
        const uploaded = await fetch(`/api/commerce/products/${body.product.id}/image`, { method: "POST", body: form });
        if (!uploaded.ok) {
          const uploadBody = await readJson(uploaded);
          imageError = uploadBody.error || "Product saved, but the photo did not upload.";
        }
      } else if (clearImage && editingId) {
        const removed = await fetch(
          `/api/commerce/products/${editingId}/image?tenantId=${encodeURIComponent(tenantId)}`,
          { method: "DELETE" }
        );
        if (!removed.ok) imageError = "Product saved, but the photo was not removed.";
      }
      setNotice(imageError || "Product saved.");
      setError(imageError);
      setEditingId(body.product.id);
      setRevision(body.product.updatedAt);
      setDraft(draftFrom(body.product));
      resetMedia();
      router.refresh();
    } catch {
      setError("Could not save the product");
    } finally {
      setBusy(false);
    }
  }

  async function archive(product: CommerceProductView) {
    if (!tenantId || !canWrite) return;
    if (!window.confirm(`Archive ${product.name}? It stays archived.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/commerce/products/${product.id}/archive`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, expectedUpdatedAt: product.updatedAt }),
      });
      const body = await readJson(response);
      if (!response.ok) {
        setError(body.error || "Could not archive the product");
        return;
      }
      setNotice("Product archived.");
      setMode("list");
      setEditingId(null);
      router.refresh();
    } catch {
      setError("Could not archive the product");
    } finally {
      setBusy(false);
    }
  }

  async function previewSync(product: CommerceProductView) {
    if (!tenantId) return;
    setBusy(true);
    setError("");
    setPreviewText("");
    try {
      const response = await fetch("/api/commerce/catalog/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, productId: product.id }),
      });
      const body = (await response.json()) as { error?: string; message?: string; blockers?: string[]; networkCalled?: boolean };
      if (!response.ok) {
        setError(body.error || "Could not preview the catalog item");
        return;
      }
      const lines = body.blockers?.length ? body.blockers : [body.message || "Nothing to send"];
      setPreviewText(`${product.sku}: ${lines.join(" ")} No request was sent.`);
    } catch {
      setError("Could not preview the catalog item");
    } finally {
      setBusy(false);
    }
  }

  const cards = [
    ["WhatsApp Business", connection.whatsapp],
    ["Meta Catalog", connection.catalog],
    ["Payment gateway", connection.payment],
  ] as const;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Commerce"
        title="Products"
        description="Product master for this brand. WhatsApp checkout, payment, and Meta catalog sync are off."
      />

      {isAgency ? (
        <label className="mb-4 block text-sm text-slate-600">
          Brand
          <select
            className="an-input mt-1 max-w-sm"
            value={tenantId ?? ""}
            onChange={(event) => {
              const id = event.target.value;
              router.push(id ? `/commerce?client=${id}` : "/commerce");
            }}
          >
            <option value="">Choose a brand</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {!tenantId ? (
        <p className="an-card px-5 py-4 text-sm text-slate-600">Choose a brand to see its products.</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {cards.map(([label, item]) => (
              <section key={label} className="an-card px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{stateLabel(item.status)}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{item.detail}</p>
              </section>
            ))}
          </div>
          <p className="mb-4 text-[13px] text-slate-500">This page does not show revenue. A saved product is not a sale.</p>
          <ConnectionPanel tenantId={tenantId} canWrite={canWrite} initial={connection} />
          {previewText ? (
            <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">
              {previewText}
            </p>
          ) : null}

          {error ? (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          {notice && !error ? (
            <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">
              {notice}
            </p>
          ) : null}

          {mode === "list" ? (
            <section className="an-card overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Product master</h2>
                {canWrite ? (
                  <button type="button" className="an-btn-primary text-sm" onClick={startNew}>
                    New product
                  </button>
                ) : null}
              </div>
              <div className="grid gap-2 border-b border-slate-100 px-4 py-3 sm:grid-cols-[1fr_180px]">
                <input
                  className="an-input"
                  value={query}
                  placeholder="Search SKU or name"
                  onChange={(event) => setQuery(event.target.value)}
                />
                <select
                  className="an-input"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "ACTIVE" | "ARCHIVED" | "ALL")}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                  <option value="ALL">All statuses</option>
                </select>
              </div>
              {shown.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">No products match.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {shown.map((product) => {
                    const src = productImageSrc(tenantId, product);
                    const offer = product.availability === "UNAVAILABLE" ? "Unavailable" : "Available";
                    return (
                      <li key={product.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200" />
                        ) : (
                          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400">
                            No photo
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
                          <p className="mt-0.5 text-[12px] text-slate-500">
                            {product.sku} · {formatIdr(product.unitPriceIdr)}
                          </p>
                          <p className="mt-0.5 text-[12px] text-slate-500">
                            {product.status === "ARCHIVED" ? "Archived" : offer}
                            {" · "}
                            {product.outlets.length === 0
                              ? "No outlets"
                              : `${product.outlets.length} of ${locations.length} outlets`}
                            {" · Catalog "}
                            {syncLabel(product.catalog.syncStatus)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="an-btn-ghost text-sm" onClick={() => startDetail(product)}>
                            View
                          </button>
                          <button type="button" className="an-btn-ghost text-sm" disabled={busy} onClick={() => previewSync(product)}>
                            Sync preview
                          </button>
                          {canWrite && product.status !== "ARCHIVED" ? (
                            <>
                              <button type="button" className="an-btn-ghost text-sm" onClick={() => startEdit(product)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className="an-btn-ghost text-sm"
                                disabled={busy}
                                onClick={() => void archive(product)}
                              >
                                Archive
                              </button>
                            </>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}

          {mode === "detail" && editing ? (
            <Detail
              tenantId={tenantId}
              product={editing}
              locationCount={locations.length}
              onBack={() => setMode("list")}
              onEdit={canWrite && editing.status !== "ARCHIVED" ? () => startEdit(editing) : null}
            />
          ) : null}

          {mode === "edit" ? (
            <form className="an-card space-y-6 px-4 py-4" onSubmit={(event) => void save(event)}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{editing ? "Edit product" : "New product"}</h2>
                <button type="button" className="an-btn-ghost text-sm" onClick={() => setMode("list")}>
                  Back to list
                </button>
              </div>

              <section className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Product</h3>
                <Field label="Name">
                  <input className="an-input" value={draft.name} required disabled={!canWrite} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="SKU">
                    <input className="an-input" value={draft.sku} required disabled={!canWrite} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} />
                  </Field>
                  <Field label="Category">
                    <input className="an-input" value={draft.category} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
                  </Field>
                </div>
                <Field label="Price (whole IDR)">
                  <input
                    className="an-input"
                    inputMode="numeric"
                    required
                    disabled={!canWrite}
                    value={draft.unitPriceIdr}
                    onChange={(event) => setDraft({ ...draft, unitPriceIdr: event.target.value.replace(/[^\d]/g, "") })}
                  />
                </Field>
                <Field label="Description">
                  <textarea className="an-input min-h-20" value={draft.description} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
                </Field>
                <Field label="Offer status">
                  <select
                    className="an-input"
                    value={draft.availability}
                    disabled={!canWrite}
                    onChange={(event) => setDraft({ ...draft, availability: event.target.value as Draft["availability"] })}
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="UNAVAILABLE">Unavailable</option>
                  </select>
                </Field>
                <p className="text-[12px] text-slate-500">Offer status is internal. It is not a Meta catalog decision.</p>
              </section>

              <section className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Photo</h3>
                <PhotoPreview
                  src={preview || (!clearImage && editing ? productImageSrc(tenantId, editing) : "")}
                />
                <label className="block text-sm text-slate-600">
                  Upload
                  <input
                    className="mt-1 block w-full text-sm"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={!canWrite}
                    onChange={(event) => {
                      const next = event.target.files?.[0] ?? null;
                      setFile(next);
                      setClearImage(false);
                      setPreview(next ? URL.createObjectURL(next) : null);
                    }}
                  />
                </label>
                {canWrite && (editing?.hasImage || preview) ? (
                  <button
                    type="button"
                    className="an-btn-ghost text-sm"
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                      setClearImage(true);
                    }}
                  >
                    Remove photo
                  </button>
                ) : null}
                <details className="text-sm text-slate-600">
                  <summary className="cursor-pointer">Image URL, optional</summary>
                  <input
                    className="an-input mt-2"
                    placeholder="https://"
                    value={draft.imageUrl}
                    disabled={!canWrite}
                    onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })}
                  />
                </details>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Variants</h3>
                  {canWrite ? (
                    <button
                      type="button"
                      className="an-btn-ghost text-sm"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          variants: [...draft.variants, { sku: "", name: "", unitPriceIdr: null, status: "ACTIVE" }],
                        })
                      }
                    >
                      Add variant
                    </button>
                  ) : null}
                </div>
                {draft.variants.length === 0 ? <p className="text-[12px] text-slate-500">No variants. The product price is used.</p> : null}
                {draft.variants.map((variant, index) => (
                  <div key={index} className="mb-2 grid gap-2 sm:grid-cols-4">
                    <input className="an-input" placeholder="SKU" value={variant.sku} disabled={!canWrite} onChange={(event) => updateVariant(draft, setDraft, index, { sku: event.target.value })} />
                    <input className="an-input" placeholder="Name" value={variant.name} disabled={!canWrite} onChange={(event) => updateVariant(draft, setDraft, index, { name: event.target.value })} />
                    <input
                      className="an-input"
                      placeholder="Price IDR"
                      inputMode="numeric"
                      value={variant.unitPriceIdr ?? ""}
                      disabled={!canWrite}
                      onChange={(event) =>
                        updateVariant(draft, setDraft, index, {
                          unitPriceIdr: event.target.value ? Number(event.target.value.replace(/[^\d]/g, "")) : null,
                        })
                      }
                    />
                    <button type="button" className="an-btn-ghost text-sm" disabled={!canWrite} onClick={() => setDraft({ ...draft, variants: draft.variants.filter((_, i) => i !== index) })}>
                      Remove
                    </button>
                  </div>
                ))}
              </section>

              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Outlets</h3>
                <p className="text-[12px] text-slate-500">
                  {draft.outlets.length} of {locations.length} selected
                </p>
                <input className="an-input" placeholder="Search outlets" value={outletQuery} onChange={(event) => setOutletQuery(event.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="an-btn-ghost text-sm"
                    disabled={!canWrite}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        outlets: locations.map((location) => {
                          const current = draft.outlets.find((outlet) => outlet.locationId === location.id);
                          return current || { locationId: location.id, availability: "AVAILABLE" as const };
                        }),
                      })
                    }
                  >
                    Select all
                  </button>
                  <button type="button" className="an-btn-ghost text-sm" disabled={!canWrite} onClick={() => setDraft({ ...draft, outlets: [] })}>
                    Clear
                  </button>
                </div>
                <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-100 p-3">
                  {outletShown.map((location) => {
                    const assigned = draft.outlets.find((outlet) => outlet.locationId === location.id);
                    return (
                      <li key={location.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(assigned)}
                            disabled={!canWrite}
                            onChange={(event) => {
                              const outlets = event.target.checked
                                ? [...draft.outlets, { locationId: location.id, availability: "AVAILABLE" as const }]
                                : draft.outlets.filter((outlet) => outlet.locationId !== location.id);
                              setDraft({ ...draft, outlets });
                            }}
                          />
                          {location.name}
                        </label>
                        {assigned ? (
                          <select
                            className="an-input w-auto"
                            value={assigned.availability}
                            disabled={!canWrite}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                outlets: draft.outlets.map((outlet) =>
                                  outlet.locationId === location.id
                                    ? { ...outlet, availability: event.target.value as Outlet["availability"] }
                                    : outlet
                                ),
                              })
                            }
                          >
                            <option value="AVAILABLE">Available here</option>
                            <option value="UNAVAILABLE">Unavailable here</option>
                          </select>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Catalog note</h3>
                <select
                  className="an-input"
                  value={draft.catalogEligibility}
                  disabled={!canWrite}
                  onChange={(event) => setDraft({ ...draft, catalogEligibility: event.target.value as Draft["catalogEligibility"] })}
                >
                  <option value="UNKNOWN">Not reviewed</option>
                  <option value="INELIGIBLE">Not for catalog</option>
                </select>
                <p className="text-[12px] leading-relaxed text-slate-500">
                  This note is internal. It is not a Meta approval. Catalog sync status stays Not connected.
                </p>
              </section>

              {canWrite ? (
                <button type="submit" className="an-btn-primary text-sm" disabled={busy}>
                  {busy ? "Saving…" : "Save product"}
                </button>
              ) : (
                <p className="text-[12px] text-slate-500">You can view products. Brand admin saves changes.</p>
              )}
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}

function PhotoPreview({ src }: { src: string }) {
  if (!src) return <p className="text-[12px] text-slate-500">No photo yet.</p>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-28 w-28 rounded-xl object-cover ring-1 ring-slate-200" />
  );
}

function Detail({
  tenantId,
  product,
  locationCount,
  onBack,
  onEdit,
}: {
  tenantId: string;
  product: CommerceProductView;
  locationCount: number;
  onBack: () => void;
  onEdit: (() => void) | null;
}) {
  const src = productImageSrc(tenantId, product);
  return (
    <section className="an-card space-y-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{product.name}</h2>
        <button type="button" className="an-btn-ghost text-sm" onClick={onBack}>
          Back to list
        </button>
      </div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-28 w-28 rounded-xl object-cover ring-1 ring-slate-200" />
      ) : null}
      <dl className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        <div>SKU {product.sku}</div>
        <div>{formatIdr(product.unitPriceIdr)}</div>
        <div>{product.status === "ARCHIVED" ? "Archived" : product.availability === "UNAVAILABLE" ? "Unavailable" : "Available"}</div>
        <div>{product.outlets.length} of {locationCount} outlets</div>
        <div>Catalog note: {product.catalogEligibility === "INELIGIBLE" ? "Not for catalog" : "Not reviewed"}</div>
        <div>Catalog sync: {syncLabel(product.catalog.syncStatus)}</div>
        <div>Meta review: {reviewLabel(product.catalog.reviewStatus)}</div>
      </dl>
      {product.description ? <p className="text-sm text-slate-600">{product.description}</p> : null}
      {product.variants.length > 0 ? (
        <ul className="text-sm text-slate-600">
          {product.variants.map((variant) => (
            <li key={variant.sku}>
              {variant.name} · {variant.sku} · {variant.unitPriceIdr == null ? "Uses product price" : formatIdr(variant.unitPriceIdr)}
            </li>
          ))}
        </ul>
      ) : null}
      {product.outlets.length > 0 ? (
        <p className="text-sm text-slate-600">
          {product.outlets
            .map((outlet) => `${outlet.name} (${outlet.availability === "UNAVAILABLE" ? "Unavailable here" : "Available here"})`)
            .join(", ")}
        </p>
      ) : null}
      {onEdit ? (
        <button type="button" className="an-btn-primary text-sm" onClick={onEdit}>
          Edit
        </button>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm text-slate-600">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function updateVariant(draft: Draft, setDraft: (next: Draft) => void, index: number, patch: Partial<Variant>) {
  setDraft({
    ...draft,
    variants: draft.variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)),
  });
}
