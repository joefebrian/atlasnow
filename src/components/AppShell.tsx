"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { WorkspaceSwitcher } from "@/components/auth/WorkspaceSwitcher";
import { NoticeBell } from "@/components/activity/NoticeBell";
import type { Messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/locale";
import { atlasProductCopyright } from "@/lib/legal/copy";
import { SupportWidget } from "@/components/support/SupportWidget";

const STORAGE_KEY = "atlasnow_sidebar_collapsed";

type Props = {
  children: ReactNode;
  locale: Locale;
  shell: Messages["shell"];
  nav: Messages["nav"];
  userName: string | null;
  userEmail: string;
  tenantName: string;
  tenantSlug: string;
  role: string;
  roleId?: string;
  isAgencyStaff: boolean;
  isPlatformAdmin?: boolean;
  mode?: "platform" | "agency" | "brand";
  tenantId?: string;
  agencies?: { id: string; name: string; slug: string }[];
  appName: string;
  logoUrl?: string | null;
  logoLetter: string;
  tagline: string;
  allowedHrefs?: string[] | null;
  showYola?: boolean;
};

export function AppShell({
  children,
  locale,
  shell,
  nav,
  userName,
  userEmail,
  tenantName,
  tenantSlug,
  role,
  roleId = "",
  isAgencyStaff,
  isPlatformAdmin = false,
  mode = "brand",
  tenantId = "",
  agencies = [],
  appName,
  logoUrl,
  logoLetter,
  tagline,
  allowedHrefs = null,
  showYola = false,
}: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);

  const presentation =
    pathname === "/deck_pitch" ||
    pathname.startsWith("/deck_pitch/") ||
    pathname === "/deck_train" ||
    pathname.startsWith("/deck_train/");
  const billingPrint = pathname.startsWith("/billing/print");

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
    const q = window.matchMedia("(max-width: 1023px)");
    const apply = () => {
      setIsMobile(q.matches);
      if (!q.matches) setMobileOpen(false);
    };
    apply();
    q.addEventListener("change", apply);
    setReady(true);
    return () => q.removeEventListener("change", apply);
  }, []);

  function toggleDesktop() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const sidebarCollapsed = ready && !isMobile ? collapsed : false;

  if (billingPrint) {
    return (
      <div className="min-h-dvh bg-white text-[var(--ink)]" lang={locale}>
        {children}
      </div>
    );
  }

  if (presentation) {
    return (
      <div className="min-h-dvh bg-slate-950 text-slate-50" lang={locale}>
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh text-slate-900" lang={locale}>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div
        className={`fixed inset-y-0 left-0 z-50 max-lg:shadow-2xl max-lg:transition-transform max-lg:duration-200 lg:static lg:z-30 ${
          mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
        }`}
      >
        <AppSidebar
          userName={userName}
          userEmail={userEmail}
          appName={appName}
          logoUrl={logoUrl}
          logoLetter={logoLetter}
          tagline={tagline}
          tenantName={tenantName}
          roleLabel={role}
          roleId={roleId}
          locale={locale}
          isAgencyStaff={isAgencyStaff}
          isPlatformAdmin={isPlatformAdmin}
          mode={mode}
          tenantId={tenantId}
          agencies={agencies}
          allowedHrefs={allowedHrefs}
          showYola={showYola}
          t={nav}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleDesktop}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-slate-200/70 bg-white/90 px-3 backdrop-blur-xl sm:h-14 sm:gap-3 sm:px-5 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm lg:hidden"
            aria-label="Open menu"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>

          <div className="min-w-0 flex-1 lg:hidden">
            <p className="truncate text-[13px] font-semibold leading-tight text-slate-900">{tenantName}</p>
          </div>

          {isPlatformAdmin ? (
            <div className="relative z-40 hidden shrink-0 lg:block">
              <WorkspaceSwitcher
                mode={mode}
                tenantId={tenantId}
                tenantName={tenantName}
                agencies={agencies}
              />
            </div>
          ) : null}

          <div className="pointer-events-none hidden min-w-0 flex-1 justify-center lg:flex">
            <div className="pointer-events-none flex w-full max-w-md items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-400">
              <span>⌕</span>
              <span className="flex-1 truncate">{shell.searchPlaceholder}</span>
              <kbd className="hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 xl:inline">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            {mode !== "platform" ? (
              <div
                className="hidden min-w-0 max-w-[13.5rem] items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1 lg:flex"
                title={`${tenantName} · ${role}`}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[12px] font-semibold leading-tight text-slate-900">
                      {tenantName}
                    </span>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-600/10">
                      {isAgencyStaff ? nav.groupBadge : nav.brandBadge}
                    </span>
                  </div>
                  <div className="truncate text-[10px] leading-tight text-slate-500">{role}</div>
                </div>
              </div>
            ) : null}
            <NoticeBell />
            <div className="hidden lg:block">
              <LanguageSwitcher locale={locale} />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-6 lg:px-8 lg:py-7">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
          <p className="mx-auto mt-10 max-w-6xl px-0 text-[11px] text-slate-400">
            {atlasProductCopyright()}
          </p>
        </main>
      </div>
      <SupportWidget locale={locale} />
    </div>
  );
}
