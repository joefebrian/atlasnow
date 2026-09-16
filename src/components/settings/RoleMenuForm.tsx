"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CLIENT_ROLES, ROLE_LABELS, type Role } from "@/lib/roles";

type Choice = { href: string; label: string; group: "work" | "settings" };
type RoleRow = { role: string; hrefs: string[]; isDefault: boolean };

export function RoleMenuForm({
  clientId,
  isGroup,
  brands,
}: {
  clientId: string | null;
  isGroup: boolean;
  brands: { id: string; name: string }[];
}) {
  const router = useRouter();
  const qs = clientId ? `?client=${encodeURIComponent(clientId)}` : "";
  const [role, setRole] = useState<Role>("BRANCH");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const current = rows.find((r) => r.role === role);
  const selected = new Set(current?.hrefs || []);

  const load = useCallback(async () => {
    if (isGroup && !clientId) {
      setRows([]);
      return;
    }
    const res = await fetch(`/api/settings/role-menu${qs}`, { credentials: "same-origin" });
    const json = (await res.json()) as { choices?: Choice[]; roles?: RoleRow[]; error?: string };
    if (!res.ok) {
      setErr(json.error || "Could not load");
      return;
    }
    setErr(null);
    setChoices(json.choices || []);
    setRows(json.roles || []);
  }, [clientId, isGroup, qs]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(href: string) {
    setRows((list) =>
      list.map((row) => {
        if (row.role !== role) return row;
        const has = row.hrefs.includes(href);
        const hrefs = has ? row.hrefs.filter((h) => h !== href) : [...row.hrefs, href];
        return { ...row, hrefs, isDefault: false };
      })
    );
  }

  async function save() {
    if (!current) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/role-menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ client: clientId, role, hrefs: current.hrefs }),
      });
      const json = (await res.json()) as { error?: string; hrefs?: string[] };
      if (!res.ok) {
        setErr(json.error || "Could not save");
        return;
      }
      setRows((list) =>
        list.map((row) => (row.role === role ? { ...row, hrefs: json.hrefs || row.hrefs, isDefault: false } : row))
      );
      setMsg("Saved. Users with this role see the new menus after they refresh (or login again).");
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  const work = choices.filter((c) => c.group === "work");
  const settings = choices.filter((c) => c.group === "settings");

  return (
    <div className="space-y-4">
      {isGroup ? (
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Brand
          <select
            className="an-input mt-1 w-full max-w-sm py-2 font-normal normal-case"
            value={clientId || ""}
            onChange={(e) => {
              const next = e.target.value;
              router.replace(next ? `/settings/access?client=${encodeURIComponent(next)}` : "/settings/access");
            }}
          >
            <option value="">Pick a brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {isGroup && !clientId ? (
        <p className="text-sm text-slate-500">Pick a brand first. Each brand has its own ticks.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {CLIENT_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                  role === r ? "bg-[var(--ink)] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>

          {role === "BRANCH" ? (
            <p className="rounded-xl bg-[#fff6ee] px-3 py-2 text-[13px] text-slate-700">
              Branch PIC is one outlet. Pick the cabang when you add the user (Brands → that brand → users). Their
              Loyalty desk only shows that outlet.
            </p>
          ) : null}

          {current?.isDefault ? (
            <p className="text-[12px] text-slate-400">Using Atlas defaults until you save.</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="an-card space-y-2 p-4">
              <p className="text-[11px] font-bold uppercase text-slate-400">Work</p>
              {work.map((c) => (
                <label key={c.href} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={selected.has(c.href)} onChange={() => toggle(c.href)} />
                  {c.label}
                </label>
              ))}
            </fieldset>
            <fieldset className="an-card space-y-2 p-4">
              <p className="text-[11px] font-bold uppercase text-slate-400">Settings</p>
              {settings.map((c) => (
                <label key={c.href} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={selected.has(c.href)} onChange={() => toggle(c.href)} />
                  {c.label}
                </label>
              ))}
            </fieldset>
          </div>

          {err ? <p className="text-sm text-rose-700">{err}</p> : null}
          {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

          <button type="button" className="an-btn-primary disabled:opacity-40" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save this role"}
          </button>
        </>
      )}
    </div>
  );
}
