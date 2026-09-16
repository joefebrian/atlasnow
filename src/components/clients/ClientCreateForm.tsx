"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IndustrySuggestInput } from "@/components/clients/IndustrySuggestInput";
import { BRAND_LOGO_HINT } from "@/components/brand/BrandLogoField";

export function ClientCreateForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [knownIndustries, setKnownIndustries] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    industry: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    address: "",
    notes: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clients", { credentials: "same-origin" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          clients?: { industry?: string | null }[];
        };
        const set = new Set<string>();
        for (const c of data.clients || []) {
          if (c.industry?.trim()) set.add(c.industry.trim());
        }
        if (!cancelled) setKnownIndustries([...set]);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          industry: form.industry.trim() || null,
          contactName: form.contactName.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          website: form.website.trim() || null,
          address: form.address.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });

      let data: { error?: string; client?: { id: string } } = {};
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setError(
          res.status === 500
            ? "Server error — re-login then try again."
            : `Request failed (${res.status}).`
        );
        setSaving(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || `Failed to create client (${res.status})`);
        setSaving(false);
        return;
      }

      if (!data.client?.id) {
        setError("Client created but response was incomplete.");
        setSaving(false);
        return;
      }

      if (logoFile) {
        const fd = new FormData();
        fd.append("file", logoFile);
        const up = await fetch(`/api/clients/${data.client.id}/logo`, {
          method: "POST",
          credentials: "same-origin",
          body: fd,
        });
        if (!up.ok) {
          router.push(`/clients/${data.client.id}?logo=failed`);
          router.refresh();
          return;
        }
      }

      router.push(`/clients/${data.client.id}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(
        "Could not reach server. Check you are on http://localhost:3000 and still logged in."
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="an-card space-y-4 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Client / brand name *
          </label>
          <input
            className="an-input"
            required
            minLength={2}
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="e.g. Northside Bakery"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Slug (optional)
          </label>
          <input
            className="an-input font-mono text-xs"
            value={form.slug}
            onChange={(e) => setField("slug", e.target.value)}
            placeholder="auto from name"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Industry
          </label>
          <IndustrySuggestInput
            value={form.industry}
            onChange={(v) => setField("industry", v)}
            knownIndustries={knownIndustries}
            placeholder="Start typing — F&B, Retail, …"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Contact name
          </label>
          <input
            className="an-input"
            value={form.contactName}
            onChange={(e) => setField("contactName", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Contact email
          </label>
          <input
            type="email"
            className="an-input"
            value={form.contactEmail}
            onChange={(e) => setField("contactEmail", e.target.value)}
            placeholder="Used for login activation"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Contact phone
          </label>
          <input
            className="an-input"
            value={form.contactPhone}
            onChange={(e) => setField("contactPhone", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Website
          </label>
          <input
            className="an-input"
            value={form.website}
            onChange={(e) => setField("website", e.target.value)}
            placeholder="https://"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Address
          </label>
          <input
            className="an-input"
            value={form.address}
            onChange={(e) => setField("address", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Brand logo (join page)
          </label>
          <p className="mb-2 text-[11px] leading-relaxed text-slate-500">{BRAND_LOGO_HINT}</p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
          />
          {logoFile && <p className="mt-1 text-[11px] text-slate-400">{logoFile.name}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Notes
          </label>
          <textarea
            className="an-input min-h-[100px] resize-y"
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder="Onboarding notes, pilot scope, …"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="an-btn-primary" disabled={saving}>
          {saving ? "Creating…" : "Create client"}
        </button>
        <button
          type="button"
          className="an-btn-ghost"
          disabled={saving}
          onClick={() => router.push("/clients")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
