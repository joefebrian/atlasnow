"use client";

import { DEFAULT_FAQ, MAX_FAQS, type FaqItem } from "@/lib/faq";
import type { Locale } from "@/lib/i18n/locale";

export function FaqEditor({
  items,
  onChange,
  locale,
}: {
  items: FaqItem[];
  onChange: (next: FaqItem[]) => void;
  locale: Locale;
}) {
  const id = locale === "id";

  function patch(i: number, part: Partial<FaqItem>) {
    onChange(items.map((item, idx) => (idx === i ? { ...item, ...part } : item)));
  }

  function add() {
    if (items.length >= MAX_FAQS) return;
    onChange([
      ...items,
      {
        id: `faq-${Date.now()}`,
        qEn: "",
        aEn: "",
        qId: "",
        aId: "",
      },
    ]);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
    onChange(next);
  }

  return (
    <section className="an-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">FAQ</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {id
              ? "Tampil di atlasnow.co/faq. Bisa tambah, geser, hapus. English wajib; Indonesia opsional."
              : "Shown at atlasnow.co/faq. Add, reorder, or delete. English required; Indonesian optional."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="an-btn-ghost text-xs"
            onClick={() => onChange(DEFAULT_FAQ.map((f) => ({ ...f })))}
          >
            {id ? "Isi default" : "Reset defaults"}
          </button>
          <button
            type="button"
            className="an-btn-soft text-xs"
            disabled={items.length >= MAX_FAQS}
            onClick={add}
          >
            {id ? "Tambah pertanyaan" : "Add question"}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">
            {id ? "Belum ada FAQ. Tambah atau isi default." : "No FAQs yet. Add one or load defaults."}
          </p>
        ) : (
          items.map((item, i) => (
            <div key={item.id} className="rounded-xl ring-1 ring-slate-200/80">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {i + 1} / {items.length}
                </span>
                <div className="flex gap-1">
                  <button type="button" className="an-btn-ghost px-2 py-1 text-xs" onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button type="button" className="an-btn-ghost px-2 py-1 text-xs" onClick={() => move(i, 1)}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-xs font-semibold text-rose-600"
                    onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                  >
                    {id ? "Hapus" : "Delete"}
                  </button>
                </div>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Q · EN
                  </span>
                  <input
                    className="an-input"
                    value={item.qEn}
                    onChange={(e) => patch(i, { qEn: e.target.value })}
                    required
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    A · EN
                  </span>
                  <textarea
                    className="an-input min-h-[88px]"
                    value={item.aEn}
                    onChange={(e) => patch(i, { aEn: e.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Q · ID
                  </span>
                  <input
                    className="an-input"
                    value={item.qId}
                    onChange={(e) => patch(i, { qId: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    A · ID
                  </span>
                  <textarea
                    className="an-input min-h-[88px]"
                    value={item.aId}
                    onChange={(e) => patch(i, { aId: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
