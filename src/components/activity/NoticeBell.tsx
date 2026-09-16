"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  kind: string;
  tenantName: string;
  at: string;
};

export function NoticeBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);

  async function load() {
    const res = await fetch("/api/notices");
    if (!res.ok) return;
    const data = (await res.json()) as { unread: number; items: Item[] };
    setUnread(data.unread);
    setItems(data.items);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  async function markSeen() {
    setOpen((o) => !o);
    if (!open) {
      await fetch("/api/notices", { method: "POST" });
      setUnread(0);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={markSeen}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-slate-900"
        aria-label="Notifications"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" strokeLinecap="round" />
          <path d="M9 17a3 3 0 0 0 6 0" strokeLinecap="round" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Notices</span>
            <Link href="/activity" className="text-[11px] font-semibold text-indigo-600" onClick={() => setOpen(false)}>
              Change log
            </Link>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-slate-400">Nothing yet</li>
            ) : (
              items.map((n) => (
                <li key={n.id} className="border-b border-slate-50 px-3 py-2.5 last:border-0">
                  {n.href ? (
                    <Link href={n.href} className="block" onClick={() => setOpen(false)}>
                      <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                      {n.body ? <p className="mt-0.5 text-[11px] text-slate-500">{n.body}</p> : null}
                    </Link>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                      {n.body ? <p className="mt-0.5 text-[11px] text-slate-500">{n.body}</p> : null}
                    </>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
