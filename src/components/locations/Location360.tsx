"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { readinessBadgeClass } from "@/lib/locations/readiness";
import { LocationVisibilityMetrics } from "@/components/metrics/LocationVisibilityMetrics";
import {
  mapsUrlFromLocation,
  mapsUrlWithPlaceId,
  shouldReplaceLocationName,
} from "@/lib/locations/maps-url";
import { WhatsAppConnectPanel } from "@/components/locations/WhatsAppConnectPanel";
import { ReviewCapturePanel } from "@/components/reviews/ReviewCapturePanel";

type Mapping = {
  id: string;
  sourceType: string;
  externalId: string;
  externalLabel: string | null;
  confidence: string;
  status: string;
};

type Location = {
  id: string;
  atlasLocationId: string;
  name: string;
  code: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string;
  phone: string | null;
  waOutletPhone?: string | null;
  waOutletConfirmed?: boolean;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  kind?: string;
  status: string;
  readiness: string;
  readinessJson: string | null;
  notes: string | null;
  tenant: { id: string; name: string; slug: string };
  mappings: Mapping[];
};

const TABS = [
  "Overview",
  "Visibility",
  "Reputation",
  "Timeline",
  "Data contract",
] as const;

export function Location360({
  location: initial,
  initialTab,
}: {
  location: Location;
  initialTab?: (typeof TABS)[number];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>(
    initialTab && TABS.includes(initialTab) ? initialTab : "Overview",
  );
  const [loc, setLoc] = useState(initial);
  const [form, setForm] = useState({
    name: initial.name,
    code: initial.code || "",
    addressLine1: initial.addressLine1 || "",
    addressLine2: initial.addressLine2 || "",
    city: initial.city || "",
    region: initial.region || "",
    postalCode: initial.postalCode || "",
    country: initial.country || "ID",
    phone: initial.phone || "",
    waOutletPhone: initial.waOutletPhone || "",
    waOutletConfirmed: Boolean(initial.waOutletConfirmed),
    website: initial.website || "",
    notes: initial.notes || "",
    status: initial.status,
    latitude: initial.latitude != null ? String(initial.latitude) : "",
    longitude: initial.longitude != null ? String(initial.longitude) : "",
  });
  const [mapsUrl, setMapsUrl] = useState(
    mapsUrlFromLocation({ website: initial.website, notes: initial.notes })
  );
  const [fetchingMaps, setFetchingMaps] = useState(false);
  const [mapForm, setMapForm] = useState({
    sourceType: "GOOGLE_BUSINESS_PROFILE",
    externalId: "",
    externalLabel: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reasons: string[] = (() => {
    try {
      return loc.readinessJson ? JSON.parse(loc.readinessJson) : [];
    } catch {
      return [];
    }
  })();

  function profilePayload() {
    const lat = form.latitude.trim() ? Number(form.latitude) : null;
    const lng = form.longitude.trim() ? Number(form.longitude) : null;
    return {
      name: form.name,
      code: form.code || null,
      addressLine1: form.addressLine1 || null,
      addressLine2: form.addressLine2 || null,
      city: form.city || null,
      region: form.region || null,
      postalCode: form.postalCode || null,
      country: form.country || "ID",
      phone: form.phone || null,
      waOutletPhone: form.waOutletPhone || null,
      waOutletConfirmed: form.waOutletConfirmed,
      website: form.website || null,
      notes: form.notes || null,
      status: form.status,
      latitude: lat != null && !Number.isNaN(lat) ? lat : null,
      longitude: lng != null && !Number.isNaN(lng) ? lng : null,
    };
  }

  async function fetchFromMaps() {
    setFetchingMaps(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/locations/from-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ url: mapsUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Could not fetch from Maps URL");
        setFetchingMaps(false);
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
      const mapsLink = mapsUrlWithPlaceId(d.placeId, d.mapsUrl || mapsUrl.trim());
      setForm((f) => ({
        ...f,
        name: shouldReplaceLocationName(f.name, d.name) ? d.name || f.name : f.name,
        addressLine1: d.addressLine1 || f.addressLine1,
        city: d.city || f.city,
        region: d.region || f.region,
        postalCode: d.postalCode || f.postalCode,
        country: d.country || f.country || "ID",
        phone: d.phone || f.phone,
        website:
          !f.website.trim() ||
          /maps\.app\.goo\.gl|goo\.gl\/maps|google\.[^/]+\/maps/i.test(f.website)
            ? d.website?.trim() || mapsLink || f.website
            : f.website,
        latitude: d.latitude != null ? String(d.latitude) : f.latitude,
        longitude: d.longitude != null ? String(d.longitude) : f.longitude,
        notes: mapsLink
          ? /Maps:\s*\S+/i.test(f.notes)
            ? f.notes.replace(/Maps:\s*\S+/i, `Maps: ${mapsLink}`)
            : [f.notes, `Maps: ${mapsLink}`].filter(Boolean).join("\n").trim()
          : f.notes,
      }));
      if (mapsLink) setMapsUrl(mapsLink);
      const parts = [
        `Filled from Maps (${d.source || "parse"}) — click Save profile`,
        d.phone ? "phone included" : null,
        d.warnings?.length ? d.warnings.join(" · ") : null,
      ].filter(Boolean);
      setMsg(parts.join(" — "));
      setFetchingMaps(false);
    } catch {
      setErr("Network error while fetching Maps URL");
      setFetchingMaps(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/locations/${loc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(profilePayload()),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Save failed");
        setBusy(false);
        return;
      }
      setLoc((l) => ({ ...l, ...data.location }));
      setMsg("Location saved. Readiness recalculated.");
      setBusy(false);
      router.refresh();
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  async function addMapping(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/locations/${loc.id}/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          sourceType: mapForm.sourceType,
          externalId: mapForm.externalId,
          externalLabel: mapForm.externalLabel || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(
          data.error +
            (data.conflict
              ? ` → ${data.conflict.name} (${data.conflict.atlasLocationId})`
              : "")
        );
        setBusy(false);
        return;
      }
      if (data.location) setLoc(data.location);
      setMapForm((f) => ({ ...f, externalId: "", externalLabel: "" }));
      setMsg("Source mapping added.");
      setBusy(false);
      router.refresh();
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  async function removeMapping(mappingId: string) {
    if (!window.confirm("Remove this source mapping?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/locations/${loc.id}/mappings/${mappingId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json();
        setErr(data.error || "Remove failed");
        setBusy(false);
        return;
      }
      setLoc((l) => ({
        ...l,
        mappings: l.mappings.filter((m) => m.id !== mappingId),
      }));
      // refresh readiness via GET
      const g = await fetch(`/api/locations/${loc.id}`, { credentials: "same-origin" });
      const d = await g.json();
      if (d.location) setLoc(d.location);
      setBusy(false);
      router.refresh();
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  async function archive() {
    if (
      !window.confirm(
        "Delete this location from the portfolio? It is archived — atlas_location_id is kept and cannot be reused."
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/locations/${loc.id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.ok) {
      router.push(`/locations?client=${loc.tenant.id}`);
      router.refresh();
    } else {
      setErr("Archive failed");
      setBusy(false);
    }
  }

  const gbpMapping = loc.mappings.find(
    (m) => m.sourceType === "GOOGLE_BUSINESS_PROFILE" && m.status === "ACTIVE"
  );

  async function pushToGoogle() {
    if (!gbpMapping) {
      setErr("Map Google Business Profile first (Data Health → Map locations)");
      return;
    }
    if (
      !window.confirm(
        "Push name, phone, website, address, and store code from Atlas to Google Business Profile?"
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      // Save local first so push uses latest form values
      await fetch(`/api/locations/${loc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(profilePayload()),
      });

      const res = await fetch(`/api/locations/${loc.id}/google/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Push to Google failed");
        setBusy(false);
        return;
      }
      setMsg(
        `${data.note || "Pushed"} · fields: ${(data.updateMask || []).join(", ") || "—"}`
      );
      setBusy(false);
      router.refresh();
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  async function pullFromGoogle() {
    if (!gbpMapping) {
      setErr("Map Google Business Profile first");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/locations/${loc.id}/google/pull`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Pull failed");
        setBusy(false);
        return;
      }
      if (data.location) {
        setLoc(data.location);
        setForm({
          name: data.location.name,
          code: data.location.code || "",
          addressLine1: data.location.addressLine1 || "",
          addressLine2: data.location.addressLine2 || "",
          city: data.location.city || "",
          region: data.location.region || "",
          postalCode: data.location.postalCode || "",
          country: data.location.country || "ID",
          phone: data.location.phone || "",
          waOutletPhone: data.location.waOutletPhone || "",
          waOutletConfirmed: Boolean(data.location.waOutletConfirmed),
          website: data.location.website || "",
          notes: data.location.notes || "",
          status: data.location.status,
          latitude:
            data.location.latitude != null ? String(data.location.latitude) : "",
          longitude:
            data.location.longitude != null ? String(data.location.longitude) : "",
        });
      }
      setMsg(
        `${data.note || "Pulled"} · updated: ${(data.updated || []).join(", ") || "nothing"}`
      );
      setBusy(false);
      router.refresh();
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  }

  return (
    <div className="an-section">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600">
            Location 360 · {loc.tenant.name}
          </p>
          <h1 className="an-title mt-1">{loc.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={readinessBadgeClass(loc.readiness)}>{loc.readiness}</span>
            <span className="an-badge-muted">{loc.status}</span>
            <code className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
              {loc.atlasLocationId}
            </code>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/locations?client=${loc.tenant.id}`}
            className="an-btn-ghost text-sm"
          >
            Portfolio
          </Link>
          <button
            type="button"
            className="an-btn text-sm border border-rose-200 bg-rose-50 text-rose-700"
            disabled={busy || loc.status === "ARCHIVED"}
            onClick={archive}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200/80">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              tab === t
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={save} className="an-card space-y-3 p-5">
            <h2 className="text-sm font-semibold text-slate-900">Profile</h2>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                Fetch from Maps
              </label>
              <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
                Paste the Google Maps share link, then Save profile. Store name comes from
                the business pin (not the street).
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="an-input flex-1 py-2 text-sm"
                  type="url"
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  placeholder="https://maps.app.goo.gl/… or maps/place/…"
                />
                <button
                  type="button"
                  className="an-btn-primary shrink-0 text-xs"
                  disabled={fetchingMaps || busy || !mapsUrl.trim()}
                  onClick={fetchFromMaps}
                >
                  {fetchingMaps ? "Fetching…" : "Fetch from Maps"}
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <Field label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} mono />
              <div className="sm:col-span-2">
                <Field label="Address" value={form.addressLine1} onChange={(v) => setForm({ ...form, addressLine1: v })} />
              </div>
              <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              <Field label="Region" value={form.region} onChange={(v) => setForm({ ...form, region: v })} />
              <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field
                label="Outlet WhatsApp (loyalty intake)"
                value={form.waOutletPhone}
                onChange={(v) => setForm({ ...form, waOutletPhone: v })}
              />
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={form.waOutletConfirmed}
                  onChange={(e) => setForm({ ...form, waOutletConfirmed: e.target.checked })}
                />
                Confirmed — only this number may send stamp intake to HQ
              </label>
              <Field label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} />
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Status</label>
                <select
                  className="an-input py-2"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
            </div>
            {(msg || err) && (
              <p
                className={`rounded-xl px-3 py-2 text-xs font-medium ${
                  err
                    ? "border border-rose-200 bg-rose-50 text-rose-700"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                {err || msg}
              </p>
            )}
            <button type="submit" className="an-btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save profile"}
            </button>
          </form>

          <div className="space-y-4">
            <div className="an-card p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Google Business Profile
              </h2>
              {gbpMapping ? (
                <>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Mapped · edit profile left, then push updates to Google.
                  </p>
                  <code className="mt-2 block break-all rounded-lg bg-slate-50 px-2 py-1.5 font-mono text-[10px] text-slate-600">
                    {gbpMapping.externalId}
                  </code>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="an-btn-primary text-xs"
                      disabled={busy}
                      onClick={pushToGoogle}
                    >
                      {busy ? "…" : "Push to Google"}
                    </button>
                    <button
                      type="button"
                      className="an-btn-ghost text-xs"
                      disabled={busy}
                      onClick={pullFromGoogle}
                    >
                      Pull from Google
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                    Pushes title, store code, phone, website, address. Mock connector
                    updates local cache only — use LIVE OAuth for real Business Profile.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-xs text-slate-500">
                    Not mapped to Google Business Profile yet.
                  </p>
                  <Link
                    href="/data-health/map"
                    className="an-btn-soft mt-3 inline-flex text-xs"
                  >
                    Map on Data Health
                  </Link>
                </>
              )}
            </div>
            {loc.kind === "HQ" ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                This is the brand HQ inbox location. Connect the official Cloud API number in{" "}
                <Link href="/settings/chat-apps" className="font-semibold text-indigo-600 hover:underline">
                  Chat apps
                </Link>
                . Do not scan a WAHA QR here.
              </p>
            ) : (
              <WhatsAppConnectPanel locationId={loc.id} />
            )}
            <div className="an-card p-5">
              <h2 className="text-sm font-semibold text-slate-900">Readiness</h2>
              <p className="mt-2">
                <span className={readinessBadgeClass(loc.readiness)}>{loc.readiness}</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                {reasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="text-slate-300">·</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="an-card p-5">
              <h2 className="text-sm font-semibold text-slate-900">Identity</h2>
              <dl className="mt-3 space-y-2 text-xs">
                <div>
                  <dt className="text-slate-400">atlas_location_id</dt>
                  <dd className="font-mono font-semibold text-slate-800">{loc.atlasLocationId}</dd>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    WAHA session name = this id (1 cabang = 1 nomor). No extra mapping
                    needed.
                  </p>
                </div>
                <div>
                  <dt className="text-slate-400">Client</dt>
                  <dd className="font-semibold text-slate-800">{loc.tenant.name}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {tab === "Visibility" && <LocationVisibilityMetrics locationId={loc.id} />}
      {tab === "Reputation" && (
        <div className="space-y-3">
          <ReviewCapturePanel locale="en" clientId={loc.tenant.id} locationId={loc.id} />
          <p className="text-xs text-slate-500">
            Guests scan the QR and write the review on Google. Atlas only counts link opens.
            Pulling existing reviews still happens on{" "}
            <Link href="/reputation" className="font-semibold text-indigo-600 hover:underline">
              Reviews
            </Link>
            .
          </p>
        </div>
      )}
      {tab === "Timeline" && (
        <EmptyTab
          title="Timeline"
          body="Signal → action → proof audit trail per location (Action Center + S6)."
        />
      )}

      {tab === "Data contract" && (
        <div className="space-y-4">
          <div className="an-card p-5">
            <h2 className="text-sm font-semibold text-slate-900">Source mappings</h2>
            <p className="mt-1 text-xs text-slate-500">
              External IDs linked to this <code className="font-mono">atlas_location_id</code>.
              One active external ID per source type globally. Prefer{" "}
              <Link href="/data-health/map" className="font-semibold text-indigo-600 hover:underline">
                Data Health → Map locations
              </Link>{" "}
              so Google fills <code className="font-mono">accounts/…/locations/…</code>{" "}
              automatically (do not invent external IDs).
            </p>

            <form onSubmit={addMapping} className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                  Source
                </label>
                <select
                  className="an-input py-2"
                  value={mapForm.sourceType}
                  onChange={(e) =>
                    setMapForm({ ...mapForm, sourceType: e.target.value })
                  }
                >
                  <option value="GOOGLE_BUSINESS_PROFILE">Google Business Profile</option>
                  <option value="GSC">Google Search Console</option>
                  <option value="ADS">Ads</option>
                  <option value="WAHA">WhatsApp / WAHA</option>
                  <option value="FACEBOOK">Facebook Messenger</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="TIKTOK_GO_SHOP">TikTok GO shop</option>
                  <option value="SOCIAL">Social</option>
                  <option value="REDEMPTION">Redemption</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                  External ID *
                </label>
                <input
                  className="an-input py-2 font-mono text-xs"
                  required
                  value={mapForm.externalId}
                  onChange={(e) =>
                    setMapForm({ ...mapForm, externalId: e.target.value })
                  }
                  placeholder="accounts/…/locations/…"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                  Label
                </label>
                <input
                  className="an-input py-2"
                  value={mapForm.externalLabel}
                  onChange={(e) =>
                    setMapForm({ ...mapForm, externalLabel: e.target.value })
                  }
                  placeholder="Optional display name"
                />
              </div>
              <button type="submit" className="an-btn-primary text-sm" disabled={busy}>
                Add mapping
              </button>
            </form>
            {err && tab === "Data contract" && (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {err}
              </p>
            )}
          </div>

          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>External ID</th>
                  <th>Label</th>
                  <th>Confidence</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loc.mappings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                      No mappings yet — add Google Business Profile ID when known.
                    </td>
                  </tr>
                ) : (
                  loc.mappings.map((m) => (
                    <tr key={m.id}>
                      <td className="text-xs font-semibold text-slate-700">
                        {m.sourceType === "GOOGLE_BUSINESS_PROFILE"
                          ? "Google Business Profile"
                          : m.sourceType === "TIKTOK_GO_SHOP"
                            ? "TikTok GO shop"
                            : m.sourceType}
                      </td>
                      <td className="font-mono text-[11px] text-slate-600">
                        {m.externalId}
                      </td>
                      <td className="text-sm text-slate-600">{m.externalLabel || "—"}</td>
                      <td>
                        <span className="an-badge-muted">{m.confidence}</span>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="text-xs font-semibold text-rose-600 hover:underline"
                          disabled={busy}
                          onClick={() => removeMapping(m.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
        {label}
      </label>
      <input
        className={`an-input py-2 ${mono ? "font-mono text-xs" : ""}`}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function EmptyTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="an-card px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{body}</p>
    </div>
  );
}
