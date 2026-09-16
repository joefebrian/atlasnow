"use client";

import { useState } from "react";

export const BRAND_LOGO_HINT =
  "Square PNG 512 × 512 (min 256). Max 1.5 MB — Atlas compresses to WebP for the join page.";

export function BrandLogoField({
  tenantId,
  hasLogo,
  onChanged,
}: {
  tenantId: string;
  hasLogo: boolean;
  onChanged?: (has: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [present, setPresent] = useState(hasLogo);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    const data = new FormData();
    data.append("file", file);
    const res = await fetch(`/api/clients/${encodeURIComponent(tenantId)}/logo`, {
      method: "POST",
      credentials: "same-origin",
      body: data,
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(
        json.error === "image_too_large"
          ? "Image too large (max 1.5 MB)."
          : json.error === "image_type"
            ? "Use JPG, PNG, or WebP."
            : json.error || "Upload failed"
      );
      return;
    }
    setPresent(true);
    setTick((n) => n + 1);
    onChanged?.(true);
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Brand logo</p>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Shows on the public join page (<span className="font-medium">/join/…</span>). One square
        mark — Atlas compresses it. {BRAND_LOGO_HINT}
      </p>
      {present ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Brand logo"
          className="h-20 w-20 rounded-2xl border border-slate-200 bg-white object-contain p-1"
          src={`/api/clients/${encodeURIComponent(tenantId)}/logo?v=${tick}`}
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-[10px] text-slate-400">
          No logo
        </div>
      )}
      {err && <p className="text-xs text-rose-600">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <label className="an-btn-ghost cursor-pointer text-sm">
          {busy ? "…" : present ? "Replace logo" : "Upload logo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
        {present && (
          <button
            type="button"
            className="an-btn-ghost text-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await fetch(`/api/clients/${encodeURIComponent(tenantId)}/logo`, {
                method: "DELETE",
                credentials: "same-origin",
              });
              setBusy(false);
              setPresent(false);
              onChanged?.(false);
            }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
