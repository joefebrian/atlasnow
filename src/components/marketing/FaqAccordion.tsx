"use client";

import { useState } from "react";
import type { LocalizedFaq } from "@/lib/faq";

export function FaqAccordion({ items }: { items: LocalizedFaq[] }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="mt-8 divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
      {items.map((item) => {
        const isOpen = open === item.id;
        return (
          <div key={item.id}>
            <button
              type="button"
              className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-[var(--warm)]/80"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : item.id)}
            >
              <span className="text-[15px] font-semibold text-[var(--ink)]">{item.q}</span>
              <span className="mt-0.5 shrink-0 text-[var(--ink)]/35">{isOpen ? "−" : "+"}</span>
            </button>
            <p
              className={`px-5 pb-5 text-[14px] leading-relaxed text-[var(--ink)]/55 whitespace-pre-wrap ${
                isOpen ? "" : "hidden"
              }`}
            >
              {item.a}
            </p>
          </div>
        );
      })}
    </div>
  );
}
