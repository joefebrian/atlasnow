"use client";

import type { Locale } from "@/lib/i18n/locale";
import { trainingCopy } from "@/lib/pitch/training-copy";

export function StampKnowledgeBody({ locale }: { locale: Locale }) {
  const t = trainingCopy(locale).knowledge;
  return (
    <div className="space-y-5 text-[13px] leading-relaxed text-slate-600">
      <section>
        <h3 className="text-sm font-semibold text-[var(--ink)]">{t.oneTitle}</h3>
        <p className="mt-1">{t.oneBody}</p>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-[var(--ink)]">{t.doorsTitle}</h3>
        <ul className="mt-2 space-y-1.5">
          <li>
            <strong className="text-[var(--ink)]">{t.doorNew}</strong> — {t.doorNewBody}
          </li>
          <li>
            <strong className="text-[var(--ink)]">{t.doorOld}</strong> — {t.doorOldBody}
          </li>
        </ul>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-[var(--ink)]">{t.qrTitle}</h3>
        <ul className="mt-2 space-y-1.5">
          <li>
            <strong className="text-[var(--ink)]">{t.qrJoin}</strong> — {t.qrJoinBody}
          </li>
          <li>
            <strong className="text-[var(--ink)]">{t.qrStamp}</strong> — {t.qrStampBody}
          </li>
        </ul>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-[var(--ink)]">{t.stampTitle}</h3>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {t.stampRules.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-[var(--ink)]">{t.giftTitle}</h3>
        <p className="mt-1">{t.giftBody}</p>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-[var(--ink)]">{t.menuTitle}</h3>
        <p className="mt-1">{t.menuBody}</p>
      </section>
    </div>
  );
}

export function StampKnowledgePanel({
  open,
  onClose,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
}) {
  const t = trainingCopy(locale).knowledge;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-demo>
      <button type="button" className="absolute inset-0 bg-[var(--ink)]/40" aria-label={t.close} onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-[var(--warm)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2a9bb8]">Knowledge</p>
            <p className="text-base font-semibold text-[var(--ink)]">{t.title}</p>
          </div>
          <button type="button" className="an-btn-ghost text-sm" onClick={onClose}>
            {t.close}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <StampKnowledgeBody locale={locale} />
        </div>
      </aside>
    </div>
  );
}
