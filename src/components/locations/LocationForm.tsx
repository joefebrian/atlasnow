"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  mapsUrlWithPlaceId,
  shouldReplaceLocationName,
} from "@/lib/locations/maps-url";
import { freeOutletCapMessage, freeOutletCapReached } from "@/lib/locations/plan";

type ClientOpt = { id: string; name: string; slug: string; plan?: string; storeCount?: number };

export function LocationForm({
  clients,
  defaultTenantId,
  isAgency,
}: {
  clients: ClientOpt[];
  defaultTenantId?: string;
  isAgency: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [form, setForm] = useState({
    tenantId: defaultTenantId || clients[0]?.id || "",
    name: "",
    code: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "ID",
    phone: "",
    website: "",
    timezone: "Asia/Jakarta",
    notes: "",
    latitude: "" as string,
    longitude: "" as string,
  });

  function setField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function fetchFromMaps() {
    setFetching(true);
    setError("");
    setHint("");
    try {
      const res = await fetch("/api/locations/from-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ url: mapsUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not fetch from Maps URL");
        setFetching(false);
        return;
      }
      const d = data.draft as {
        name?: string | null;
        addressLine1?: string | null;
        city?: string | null;
        region?: string | null;
        postalCode?: string | null;
        country?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        phone?: string | null;
        website?: string | null;
        mapsUrl?: string | null;
        placeId?: string | null;
        source?: string;
        warnings?: string[];
      };

      // Prefer place_id URL so Review Capture can 302 to Google write-review
      const mapsLink = mapsUrlWithPlaceId(d.placeId, d.mapsUrl || mapsUrl.trim());
      const site = d.website?.trim() || mapsLink || "";

      setForm((f) => ({
        ...f,
        name: shouldReplaceLocationName(f.name, d.name) ? d.name || f.name : f.name,
        addressLine1: d.addressLine1 || f.addressLine1,
        city: d.city || f.city,
        region: d.region || f.region,
        postalCode: d.postalCode || f.postalCode,
        country: d.country || f.country || "ID",
        phone: d.phone || f.phone,
        latitude: d.latitude != null ? String(d.latitude) : f.latitude,
        longitude: d.longitude != null ? String(d.longitude) : f.longitude,
        website:
          !f.website.trim() || /maps\.app\.goo\.gl|goo\.gl\/maps|google\.[^/]+\/maps/i.test(f.website)
            ? d.website?.trim() || site || f.website
            : f.website,
        notes: upsertMapsNote(f.notes, mapsLink),
      }));

      const parts = [
        `Filled from Maps (${d.source || "parse"})`,
        d.phone ? "phone included" : null,
        d.warnings?.length ? d.warnings.join(" · ") : null,
      ].filter(Boolean);
      setHint(parts.join(" — "));
      setFetching(false);
    } catch {
      setError("Network error while fetching Maps URL");
      setFetching(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const lat = form.latitude.trim() ? Number(form.latitude) : null;
      const lng = form.longitude.trim() ? Number(form.longitude) : null;

      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          tenantId: form.tenantId,
          name: form.name.trim(),
          code: form.code.trim() || null,
          addressLine1: form.addressLine1.trim() || null,
          addressLine2: form.addressLine2.trim() || null,
          city: form.city.trim() || null,
          region: form.region.trim() || null,
          postalCode: form.postalCode.trim() || null,
          country: form.country.trim() || "ID",
          phone: form.phone.trim() || null,
          website: form.website.trim() || null,
          timezone: form.timezone.trim() || "Asia/Jakarta",
          notes: form.notes.trim() || null,
          latitude: lat != null && !Number.isNaN(lat) ? lat : null,
          longitude: lng != null && !Number.isNaN(lng) ? lng : null,
        }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        const detail =
          data.details?.fieldErrors &&
          Object.entries(data.details.fieldErrors as Record<string, string[]>)
            .map(([k, v]) => `${k}: ${(v || []).join(", ")}`)
            .join("; ");
        setError(data.error || detail || "Create failed");
        setSaving(false);
        return;
      }
      router.push(`/locations/${data.location.id}`);
      router.refresh();
    } catch {
      setError("Could not reach server");
      setSaving(false);
    }
  }

  const selected = clients.find((c) => c.id === form.tenantId);
  const capped = Boolean(
    selected && freeOutletCapReached(selected.plan, selected.storeCount ?? 0)
  );

  if (clients.length === 0) {
    return (
      <div className="an-card p-6 text-sm text-slate-600">
        No client workspace available. Agency: create a client first under{" "}
        <a href="/clients" className="font-semibold text-indigo-600">
          Clients
        </a>
        .
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="an-card space-y-4 p-5 sm:p-6">
      {isAgency && (
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Client *
          </label>
          <select
            className="an-input"
            required
            value={form.tenantId}
            onChange={(e) => setField("tenantId", e.target.value)}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.slug})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Maps URL fetch */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-indigo-700">
          Google Maps URL
        </label>
        <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
          Paste share link from Google Maps (full URL or maps.app.goo.gl). We fill name,
          address, city, region, postal, coordinates, and phone when available (needs Maps
          + Places API key in Settings → API). Edit before save.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="an-input flex-1 text-sm"
            type="url"
            value={mapsUrl}
            onChange={(e) => setMapsUrl(e.target.value)}
            placeholder="https://maps.app.goo.gl/… or https://www.google.com/maps/place/…"
          />
          <button
            type="button"
            className="an-btn-primary shrink-0 text-sm"
            disabled={fetching || !mapsUrl.trim()}
            onClick={fetchFromMaps}
          >
            {fetching ? "Fetching…" : "Fetch from Maps"}
          </button>
        </div>
        {hint && (
          <p className="mt-2 text-[11px] font-medium text-emerald-700">{hint}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Location name *
          </label>
          <input
            className="an-input"
            required
            minLength={2}
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="Menteng Flagship"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Store code
          </label>
          <input
            className="an-input font-mono text-xs"
            value={form.code}
            onChange={(e) => setField("code", e.target.value)}
            placeholder="SMG-01"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Phone
          </label>
          <input
            className="an-input"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Address
          </label>
          <input
            className="an-input"
            value={form.addressLine1}
            onChange={(e) => setField("addressLine1", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            City
          </label>
          <input
            className="an-input"
            value={form.city}
            onChange={(e) => setField("city", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Region / province
          </label>
          <input
            className="an-input"
            value={form.region}
            onChange={(e) => setField("region", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Postal code
          </label>
          <input
            className="an-input"
            value={form.postalCode}
            onChange={(e) => setField("postalCode", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Country
          </label>
          <input
            className="an-input"
            value={form.country}
            onChange={(e) => setField("country", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Latitude
          </label>
          <input
            className="an-input font-mono text-xs"
            value={form.latitude}
            onChange={(e) => setField("latitude", e.target.value)}
            placeholder="-6.9666"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Longitude
          </label>
          <input
            className="an-input font-mono text-xs"
            value={form.longitude}
            onChange={(e) => setField("longitude", e.target.value)}
            placeholder="110.4167"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Website / Maps link
          </label>
          <input
            className="an-input"
            value={form.website}
            onChange={(e) => setField("website", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Notes
          </label>
          <textarea
            className="an-input min-h-[80px] resize-y"
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </div>
      </div>

      {capped && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-900">
          {freeOutletCapMessage()}
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" className="an-btn-primary" disabled={saving || capped}>
          {saving ? "Creating…" : "Create location"}
        </button>
        <button
          type="button"
          className="an-btn-ghost"
          onClick={() => router.push("/locations")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function upsertMapsNote(notes: string, mapsLink: string): string {
  if (!mapsLink) return notes;
  const line = `Maps: ${mapsLink}`;
  if (/Maps:\s*\S+/i.test(notes)) return notes.replace(/Maps:\s*\S+/i, line);
  return [notes, line].filter(Boolean).join("\n").trim();
}

