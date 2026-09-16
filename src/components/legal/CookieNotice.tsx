"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rememberCookieConsent, hasCookieConsent } from "@/lib/analytics/ga";
import { LEGAL_PATHS } from "@/lib/legal/copy";

export function CookieNotice() {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(false);

  useEffect(() => {
    if (hasCookieConsent()) return;
    const path = window.location.pathname;
    if (path.startsWith("/card/") || path.startsWith("/join/") || path.startsWith("/c/")) return;
    setId(/(?:^|; )atlasnow_locale=id(?:;|$)/.test(document.cookie));
    setOpen(true);
  }, []);

  function accept() {
    rememberCookieConsent();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-[60] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] print:hidden sm:p-5">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/10 bg-[#0b1220]/95 px-4 py-3.5 text-[13px] leading-relaxed text-slate-300 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:px-5 sm:py-4">
        <p className="flex-1">
          {id
            ? "Kami memakai cookie sesi untuk login dan bahasa. Setelah OK, Google Analytics dan pengukuran Google Ads jalan di halaman publik — bukan inbox atau struk. Tidak ada Meta Pixel. "
            : "We use a session cookie to sign you in and a language cookie. After OK, Google Analytics and Google Ads measurement run on public pages — not the inbox or receipts. No Meta Pixel. "}
          <Link href={LEGAL_PATHS.cookies} className="font-semibold text-white underline decoration-white/30 underline-offset-2 hover:decoration-white">
            {id ? "Kebijakan cookie" : "Cookie policy"}
          </Link>
        </p>
        <button
          type="button"
          onClick={accept}
          className="an-btn-primary shrink-0 px-4 py-2 text-[13px]"
        >
          {id ? "OK" : "OK"}
        </button>
      </div>
    </div>
  );
}
