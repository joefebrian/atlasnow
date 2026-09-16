"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { LOCALE_SHORT } from "@/lib/i18n/locale";

type Props = {
  locale: Locale;
  size?: "sm" | "md";
  tone?: "light" | "dark";
  className?: string;
  onLocaleChange?: (locale: Locale) => void;
};

export function LanguageSwitcher({
  locale,
  size = "sm",
  tone = "light",
  className = "",
  onLocaleChange,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(locale);

  useEffect(() => {
    setCurrent(locale);
  }, [locale]);

  async function setLocale(next: Locale) {
    if (next === current || pending) return;
    const prev = current;
    setCurrent(next);
    try {
      await fetch("/api/settings/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      onLocaleChange?.(next);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setCurrent(prev);
    }
  }

  const pad = size === "md" ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]";

  const shell =
    tone === "dark"
      ? "bg-white/5 ring-1 ring-white/10"
      : "bg-white shadow-sm ring-1 ring-slate-200/80";
  const on =
    tone === "dark"
      ? "bg-white text-slate-900 shadow-sm"
      : "bg-slate-900 text-white shadow-sm";
  const off =
    tone === "dark"
      ? "text-slate-400 hover:text-white"
      : "text-slate-500 hover:text-slate-800";

  return (
    <div
      className={`inline-flex rounded-xl p-0.5 ${shell} ${className}`}
      role="group"
      aria-label="Workspace language. Choose EN for Meta App Review recordings."
      title="Workspace language. Choose EN for Meta App Review recordings."
    >
      {(["en", "id"] as Locale[]).map((code) => (
        <button
          key={code}
          type="button"
          disabled={pending}
          onClick={() => setLocale(code)}
          title={code === "en" ? "English" : "Bahasa Indonesia"}
          className={`rounded-lg font-bold tracking-wide transition ${pad} ${
            current === code ? on : off
          } disabled:opacity-60`}
        >
          {LOCALE_SHORT[code]}
        </button>
      ))}
    </div>
  );
}
