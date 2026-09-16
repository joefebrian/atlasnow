"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type Agency = { id: string; name: string; slug: string };

export function WorkspaceSwitcher({
  mode,
  tenantId,
  tenantName,
  agencies,
  layout = "header",
}: {
  mode: "platform" | "agency" | "brand";
  tenantId: string;
  tenantName: string;
  agencies: Agency[];
  layout?: "header" | "sidebar";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function go(body: { mode: "platform" } | { mode: "agency"; agencyId: string }) {
    if (body.mode === "platform" && mode === "platform") {
      setOpen(false);
      return;
    }
    if (body.mode === "agency" && mode === "agency" && body.agencyId === tenantId) {
      setOpen(false);
      return;
    }
    setOpen(false);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { home?: string };
      if (!res.ok) return;
      const home = data.home || (body.mode === "platform" ? "/agencies" : "/clients");
      router.push(home);
      router.refresh();
    } catch {
      /* cookie / network — leave the control usable */
    } finally {
      setBusy(false);
    }
  }

  const currentLabel = mode === "platform" ? "Platform" : tenantName || "Group";

  return (
    <div
      ref={box}
      className={`relative z-40 shrink-0 ${layout === "header" ? "flex items-center gap-2" : ""}`}
    >
      <p
        id={labelId}
        className={
          layout === "header"
            ? "hidden text-[10px] font-bold uppercase tracking-wide text-slate-400 lg:inline"
            : "text-[10px] font-bold uppercase tracking-wide text-slate-400"
        }
      >
        Workspace
      </p>
      <button
        type="button"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-[9.5rem] max-w-[220px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-slate-800 shadow-sm hover:border-[#6fd6f6]"
      >
        <span className="min-w-0 flex-1 truncate">{currentLabel}</span>
        <span aria-hidden className="shrink-0 text-[10px] text-slate-400">
          {busy ? "…" : "▾"}
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={mode === "platform"}
              disabled={busy}
              className={`flex w-full px-3 py-2 text-left text-xs font-medium hover:bg-[#eef8ff] disabled:opacity-50 ${
                mode === "platform" ? "bg-slate-50 text-slate-900" : "text-slate-700"
              }`}
              onClick={() => go({ mode: "platform" })}
            >
              Platform
            </button>
          </li>
          {agencies.length === 0 ? (
            <li className="px-3 py-2 text-[11px] text-slate-400">No groups yet</li>
          ) : (
            agencies.map((a) => {
              const active = mode === "agency" && a.id === tenantId;
              const label = a.slug === "p2p-labs" ? `P2P · ${a.name}` : a.name;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={busy}
                    className={`flex w-full px-3 py-2 text-left text-xs font-medium hover:bg-[#eef8ff] disabled:opacity-50 ${
                      active ? "bg-slate-50 text-slate-900" : "text-slate-700"
                    }`}
                    onClick={() => go({ mode: "agency", agencyId: a.id })}
                  >
                    {label}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
