"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogoField } from "@/components/brand/BrandLogoField";
import { ClientUsersPanel } from "@/components/clients/ClientUsersPanel";
import { IndustrySuggestInput } from "@/components/clients/IndustrySuggestInput";
import { TENANT_PLANS } from "@/lib/locations/plan";

type Membership = {
  id: string;
  role: string;
  status: string;
  locationId?: string | null;
  location?: { id: string; name: string } | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    isActive: boolean;
  };
};

type Client = {
  id: string;
  name: string;
  slug: string;
  status: string;
  loginEnabled: boolean;
  industry: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  timezone: string;
  plan?: string;
  activatedAt: string | null;
  memberships: Membership[];
  hasLogo?: boolean;
  locations?: { id: string; name: string }[];
};

export function ClientDetailPanel({ client: initial }: { client: Client }) {
  const router = useRouter();
  const [client, setClient] = useState(initial);
  const [knownIndustries, setKnownIndustries] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: initial.name,
    industry: initial.industry || "",
    contactName: initial.contactName || "",
    contactEmail: initial.contactEmail || "",
    contactPhone: initial.contactPhone || "",
    website: initial.website || "",
    address: initial.address || "",
    notes: initial.notes || "",
    status: initial.status,
    plan: initial.plan || "free",
  });

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
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [issuedLogin, setIssuedLogin] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);

  function setField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: form.name,
          industry: form.industry || null,
          contactName: form.contactName || null,
          contactEmail: form.contactEmail || null,
          contactPhone: form.contactPhone || null,
          website: form.website || null,
          address: form.address || null,
          notes: form.notes || null,
          status: form.status,
          plan: form.plan,
        }),
      });
      const text = await res.text();
      let data: { error?: string; client?: Client } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setMessage({ type: "err", text: `Save failed (${res.status})` });
        setSaving(false);
        return;
      }
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Save failed" });
        setSaving(false);
        return;
      }
      setClient((c) => ({ ...c, ...data.client }));
      setMessage({ type: "ok", text: "Client profile saved." });
      setSaving(false);
      router.refresh();
    } catch {
      setMessage({
        type: "err",
        text: "Could not reach server — re-login if needed.",
      });
      setSaving(false);
    }
  }

  async function activateLogin() {
    setActivating(true);
    setMessage(null);
    setIssuedLogin(null);
    try {
      const res = await fetch(`/api/clients/${client.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.contactEmail || undefined,
          name: form.contactName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Activation failed" });
        setActivating(false);
        return;
      }
      setClient((c) => ({ ...c, ...data.client, loginEnabled: true }));
      if (data.login?.temporaryPassword) {
        setIssuedLogin({
          email: data.login.email,
          temporaryPassword: data.login.temporaryPassword,
        });
      }
      setMessage({
        type: "ok",
        text:
          data.login?.note ||
          "Login is on. They can sign in with the password they already set, or Google / Facebook.",
      });
      setActivating(false);
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Network error" });
      setActivating(false);
    }
  }

  async function deactivateLogin() {
    setActivating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clients/${client.id}/deactivate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Deactivate failed" });
        setActivating(false);
        return;
      }
      setClient((c) => ({ ...c, ...data.client, loginEnabled: false }));
      setIssuedLogin(null);
      setMessage({ type: "ok", text: "Client login disabled." });
      setActivating(false);
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Network error" });
      setActivating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="an-card px-4 py-3">
          <div className="an-label">Login</div>
          <div className="mt-1">
            {client.loginEnabled ? (
              <span className="an-badge-yes">Active</span>
            ) : (
              <span className="an-badge-warn">Inactive</span>
            )}
          </div>
        </div>
        <div className="an-card px-4 py-3">
          <div className="an-label">Status</div>
          <div className="mt-1 text-sm font-semibold text-slate-800">{client.status}</div>
        </div>
        <div className="an-card px-4 py-3">
          <div className="an-label">Slug</div>
          <div className="mt-1 font-mono text-xs font-semibold text-slate-700">
            {client.slug}
          </div>
        </div>
      </div>

      <div className="an-card p-5 sm:p-6">
        <BrandLogoField tenantId={client.id} hasLogo={Boolean(client.hasLogo)} />
      </div>

      <div className="an-card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Workspace login gate</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Master switch for this client. Users are managed below (multiple logins +
              roles). Quick activate still creates one Client Admin from contact email.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {client.loginEnabled ? (
              <button
                type="button"
                className="an-btn-ghost text-xs"
                disabled={activating}
                onClick={deactivateLogin}
              >
                {activating ? "…" : "Disable login"}
              </button>
            ) : null}
            <button
              type="button"
              className="an-btn-primary text-xs"
              disabled={activating || !form.contactEmail}
              onClick={activateLogin}
              title={!form.contactEmail ? "Contact email required" : undefined}
            >
              {activating
                ? "Working…"
                : client.loginEnabled
                  ? "Re-issue contact admin"
                  : client.memberships.length > 0
                    ? "Turn on login"
                    : "Activate + create admin"}
            </button>
          </div>
        </div>

        {issuedLogin && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3.5 text-sm text-emerald-900">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              One-time credentials — copy now
            </p>
            <p className="mt-2">
              Email:{" "}
              <code className="font-semibold">{issuedLogin.email}</code>
            </p>
            <p>
              Password:{" "}
              <code className="font-semibold">{issuedLogin.temporaryPassword}</code>
            </p>
          </div>
        )}
      </div>

      <form onSubmit={saveProfile} className="an-card space-y-4 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-900">Client information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Name
            </label>
            <input
              className="an-input"
              required
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
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
              Plan
            </label>
            <select
              className="an-input"
              value={form.plan}
              onChange={(e) => setField("plan", e.target.value)}
            >
              {TENANT_PLANS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Free hard-stops at 2 store outlets. Paid plans do not.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Status
            </label>
            <select
              className="an-input"
              value={form.status}
              onChange={(e) => setField("status", e.target.value)}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
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
              Notes
            </label>
            <textarea
              className="an-input min-h-[100px] resize-y"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
            />
          </div>
        </div>

        {message && (
          <p
            className={`rounded-xl px-3.5 py-2.5 text-xs font-medium ${
              message.type === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {message.text}
          </p>
        )}

        <button type="submit" className="an-btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save client"}
        </button>
      </form>

      <ClientUsersPanel
        clientId={client.id}
        memberships={client.memberships}
        locations={client.locations || []}
        onLoginEnabled={(enabled) =>
          setClient((c) => ({ ...c, loginEnabled: enabled }))
        }
      />
    </div>
  );
}
