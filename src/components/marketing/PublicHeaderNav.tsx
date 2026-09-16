"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { productHeaderNav } from "@/lib/marketing/nav";

function linkClass(active: boolean) {
  return `whitespace-nowrap transition-colors ${
    active ? "font-semibold text-[var(--ink)]" : "text-[var(--ink)]/50 hover:text-[var(--ink)]"
  }`;
}

function isActive(pathname: string, href: string) {
  if (href.startsWith("/#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicHeaderNav({ locale }: { locale: Locale }) {
  const pathname = usePathname() || "/";
  const product = productHeaderNav(locale);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        className="hidden min-w-0 flex-1 items-center justify-center gap-4 overflow-x-auto text-[13px] font-medium [scrollbar-width:none] lg:flex xl:gap-5 [&::-webkit-scrollbar]:hidden"
        aria-label={locale === "id" ? "Navigasi situs" : "Site"}
      >
        {product.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(isActive(pathname, item.href))}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="lg:hidden">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-[var(--ink)]"
          aria-expanded={open}
          aria-label={locale === "id" ? "Buka menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          )}
        </button>
        {open ? (
          <div className="absolute inset-x-0 top-full border-b border-black/[0.06] bg-[var(--warm)]/95 px-4 py-4 shadow-lg backdrop-blur-xl sm:px-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink)]/40">
              {locale === "id" ? "Produk" : "Product"}
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {product.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-[14px] ${linkClass(isActive(pathname, item.href))}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
