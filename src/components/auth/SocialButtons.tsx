"use client";

import { rememberSignupMethod } from "@/lib/analytics/ga";

type Props = {
  acceptTerms: boolean;
  onNeedTerms: () => void;
  onWhatsApp?: () => void;
  showWhatsApp?: boolean;
  googleLabel: string;
  facebookLabel: string;
  whatsappLabel?: string;
  tone?: "dark" | "light";
  phone?: string;
  requirePhone?: boolean;
  onNeedPhone?: () => void;
  wantsGroup?: boolean;
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.4c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.4 7.4 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.5l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.6 1.4 6.5l4 3.1C6.3 6.8 8.9 4.8 12 4.8z"
      />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.1C24 5.4 18.6 0 12 0S0 5.4 0 12.1C0 18.1 4.4 23.1 10.1 24v-8.4H7.1v-3.5h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9v2.3h3.4l-.5 3.5h-2.9V24C19.6 23.1 24 18.1 24 12.1z"
      />
    </svg>
  );
}

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#25D366"
        d="M12 0C5.4 0 0 5.4 0 12c0 2.1.6 4.1 1.6 5.9L0 24l6.3-1.6C8 23.4 10 24 12 24c6.6 0 12-5.4 12-12S18.6 0 12 0z"
      />
      <path
        fill="#fff"
        d="M17.5 14.4c-.3-.1-1.6-.8-1.9-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1c-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.6-1.5-1.9-.1-.3 0-.4.1-.6l.5-.6c.1-.1.2-.3.2-.5s0-.3-.1-.5l-.8-2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3s-.9.9-.9 2.2.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.1.7 2.8.6.4-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.2-1.3 0-.1-.2-.2-.5-.3z"
      />
    </svg>
  );
}

const darkBtn =
  "flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]";
const lightBtn =
  "flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

export function SocialButtons({
  acceptTerms,
  onNeedTerms,
  onWhatsApp,
  showWhatsApp = false,
  googleLabel,
  facebookLabel,
  whatsappLabel,
  tone = "dark",
  phone,
  requirePhone = false,
  onNeedPhone,
  wantsGroup = false,
}: Props) {
  const btn = tone === "light" ? lightBtn : darkBtn;
  function go(provider: "google" | "facebook") {
    if (!acceptTerms) {
      onNeedTerms();
      return;
    }
    const hp = (phone || "").trim();
    if (requirePhone && !hp) {
      onNeedPhone?.();
      return;
    }
    const q = new URLSearchParams({ terms: "1" });
    if (hp) q.set("phone", hp);
    if (wantsGroup) q.set("group", "1");
    rememberSignupMethod(provider);
    window.location.href = `/api/auth/${provider}/start?${q.toString()}`;
  }

  return (
    <div className="space-y-2.5">
      <button type="button" className={btn} onClick={() => go("google")}>
        <GoogleMark />
        {googleLabel}
      </button>
      <button type="button" className={btn} onClick={() => go("facebook")}>
        <FacebookMark />
        {facebookLabel}
      </button>
      {showWhatsApp ? (
        <button type="button" className={btn} onClick={onWhatsApp}>
          <WhatsAppMark />
          {whatsappLabel}
        </button>
      ) : null}
    </div>
  );
}
