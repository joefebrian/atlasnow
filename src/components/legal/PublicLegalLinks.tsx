"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { companyNav, legalNav } from "@/lib/legal/copy";
import type { Locale } from "@/lib/i18n/locale";

export function PublicLegalLinks({
  className = "",
  locale = "en",
  tone = "light",
  variant = "footer",
}: {
  className?: string;
  locale?: Locale;
  tone?: "dark" | "light";
  variant?: "footer" | "inline";
}) {
  const pathname = usePathname() || "";
  const company = companyNav(locale);
  const legal = legalNav(locale);
  const muted = tone === "light" ? "text-[var(--ink)]/45" : "text-slate-400";
  const hover =
    tone === "light" ? "hover:text-[var(--ink)]" : "hover:text-white";
  const active =
    tone === "light" ? "text-[var(--ink)] font-semibold" : "text-white font-semibold";

  function itemClass(href: string) {
    const isActive = pathname === href || pathname.startsWith(`${href}/`);
    return `text-[12px] transition-colors ${isActive ? active : `${muted} ${hover}`}`;
  }

  if (variant === "inline") {
    const nav = [...company, ...legal];
    return (
      <nav className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 ${className}`}>
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className={itemClass(item.href)}>
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }

  const nav = [...company, ...legal];

  return (
    <nav
      className={`flex flex-wrap items-center justify-end gap-x-5 gap-y-1.5 lg:pr-24 ${className}`}
      aria-label={locale === "id" ? "Tautan situs" : "Site links"}
    >
      {nav.map((item) => (
        <Link key={item.href} href={item.href} className={itemClass(item.href)}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
