"use client";

import { useEffect, useState } from "react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function standalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

function iosDevice() {
  const ua = window.navigator.userAgent;
  const iPadOs = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOs;
}

function inAppBrowser() {
  const ua = window.navigator.userAgent;
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|Twitter/i.test(ua) || /\bwv\b/.test(ua);
}

export function SaveCardApp({
  brandName,
  brandSlug,
  memberId,
}: {
  brandName: string;
  brandSlug: string;
  memberId: string;
}) {
  const [mode, setMode] = useState<"hidden" | "banner" | "ios" | "android" | "inapp" | "other">("hidden");
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const dismissKey = `atlasnow_save_card_${brandSlug}`;

  useEffect(() => {
    try {
      navigator.serviceWorker
        ?.register(`/c/${encodeURIComponent(brandSlug)}/sw.js`, {
          scope: `/c/${encodeURIComponent(brandSlug)}/`,
        })
        .catch(() => {});
    } catch {
      /* private mode */
    }
    if (standalone()) return;
    const dismissed = (() => {
      try {
        return window.localStorage.getItem(dismissKey) === "1";
      } catch {
        return false;
      }
    })();

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as PromptEvent);
      setMode("android");
      if (!dismissed) setOpen(true);
    };
    const onInstalled = () => dismiss();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (inAppBrowser()) setMode("inapp");
    else if (iosDevice()) setMode("ios");
    else setMode("other");
    if (!dismissed) setOpen(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [dismissKey, brandSlug, memberId]);

  function dismiss() {
    try {
      window.localStorage.setItem(dismissKey, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  async function saveAndroid() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    try {
      await promptEvent.userChoice;
    } catch {
      /* ignore */
    }
    setPromptEvent(null);
    dismiss();
  }

  if (mode === "hidden") return null;

  if (!open) {
    return (
      <button
        type="button"
        className="mt-4 text-[13px] font-semibold text-[#2a9bb8]"
        onClick={() => setOpen(true)}
      >
        Simpan {brandName} di HP
      </button>
    );
  }

  return (
    <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#b7e1ff]/80">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#2a9bb8]">Di HP kamu</p>
      <p className="mt-1 text-[15px] font-semibold text-[var(--ink)]">Simpan {brandName} di layar HP</p>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
        Nama dan ikonnya <strong>{brandName}</strong> — bukan AtlasNow. Merek lain (satu nomor, dua toko) simpan
        terpisah, ikonnya beda.
      </p>

      {mode === "inapp" ? (
        <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
          Sekarang kamu di dalam WhatsApp/Instagram. Tap <strong>⋯</strong> → Open in Safari atau Chrome, baru
          bisa simpan ke layar HP.
        </p>
      ) : null}

      {mode === "ios" ? (
        <ol className="mt-3 list-decimal space-y-1 pl-4 text-[13px] leading-relaxed text-slate-600">
          <li>
            Tap tombol <strong>Share</strong> (kotak dengan panah naik).
          </li>
          <li>
            Pilih <strong>Add to Home Screen</strong>.
          </li>
          <li>
            Nama harus <strong>{brandName}</strong> — lalu Add.
          </li>
        </ol>
      ) : null}

      {mode === "other" && !promptEvent ? (
        <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
          Di Chrome HP: tap menu <strong>⋮</strong> → <strong>Add to Home screen</strong>. Nama app:{" "}
          <strong>{brandName}</strong>.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {promptEvent ? (
          <button type="button" className="an-btn-primary px-4 py-2 text-sm" onClick={() => void saveAndroid()}>
            Simpan di HP
          </button>
        ) : null}
        <button type="button" className="an-btn-ghost px-4 py-2 text-sm" onClick={dismiss}>
          Nanti
        </button>
      </div>
    </div>
  );
}
