"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  /** Short accessible name for the trigger. */
  label: string;
  children: React.ReactNode;
  /** Dark = mark on the ink login panel. Light = mark on white cards. */
  tone?: "light" | "dark";
};

const PANEL_W = 276;

export function InfoTip({ label, children, tone = "light" }: Props) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const margin = 10;
    let left = r.left;
    if (left + PANEL_W > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - PANEL_W - margin);
    }
    const below = r.bottom + 8;
    const panelH = panelRef.current?.offsetHeight ?? 120;
    const top =
      below + panelH > window.innerHeight - margin
        ? Math.max(margin, r.top - panelH - 8)
        : below;
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const raf = requestAnimationFrame(place);
    const onScroll = () => place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
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

  const trigger =
    tone === "dark"
      ? "border-white/20 bg-white/10 text-[#7ee5d6] hover:bg-white/20 hover:text-white"
      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800";

  const panel = open && mounted
    ? createPortal(
        <div
          ref={panelRef}
          id={id}
          role="tooltip"
          style={{ top: pos.top, left: pos.left, width: PANEL_W }}
          className="fixed z-[80] rounded-xl border border-white/10 bg-[#1f1b1d] px-3.5 py-3 text-[12px] font-medium leading-relaxed text-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.35)]"
        >
          {children}
        </div>,
        document.body
      )
    : null;

  return (
    <span className="inline-flex align-middle">
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border text-[11px] font-bold leading-none transition ${trigger}`}
      >
        i
      </button>
      {panel}
    </span>
  );
}
