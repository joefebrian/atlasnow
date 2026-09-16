"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { APP_NAV } from "@/lib/nav";
import { canSeeNavHref } from "@/lib/nav-access";
import type { Messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/locale";
import { NavIcon, NAV_ICON_KEY } from "@/components/NavIcons";
import { BrandMark } from "@/components/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { WorkspaceSwitcher } from "@/components/auth/WorkspaceSwitcher";

type Props = {
  userName: string | null;
  userEmail: string;
  appName?: string;
  logoUrl?: string | null;
  logoLetter?: string;
  tagline?: string;
  tenantName?: string;
  roleLabel?: string;
  roleId?: string;
  locale?: Locale;
  isAgencyStaff?: boolean;
  isPlatformAdmin?: boolean;
  mode?: "platform" | "agency" | "brand";
  tenantId?: string;
  agencies?: { id: string; name: string; slug: string }[];
  allowedHrefs?: string[] | null;
  t: Messages["nav"];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
};

function navItemActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/clients" && pathname.startsWith("/clients/follow-up")) return false;
  if (href === "/agencies" && pathname.startsWith("/agencies/follow-up")) return false;
  return pathname.startsWith(`${href}/`);
}

const NAV_GROUPS: { key: keyof Messages["nav"]["groups"]; hrefs: string[] }[] = [
  { key: "platform", hrefs: ["/agencies", "/agencies/follow-up", "/support", "/billing", "/activity"] },
  { key: "admin", hrefs: ["/clients", "/clients/follow-up"] },
  { key: "work", hrefs: ["/control-tower", "/conversations", "/broadcast", "/leakage-queue"] },
  { key: "people", hrefs: ["/customers", "/loyalty"] },
  { key: "reputation", hrefs: ["/reputation"] },
  { key: "places", hrefs: ["/locations"] },
  { key: "insight", hrefs: ["/reports"] },
  { key: "learn", hrefs: ["/deck_train", "/deck_pitch"] },
  { key: "later", hrefs: ["/action-center", "/posts", "/ads"] },
  { key: "workspace", hrefs: ["/settings", "/activity"] },
];

export function AppSidebar({
  userName,
  userEmail,
  appName = "AtlasNow",
  logoUrl = null,
  logoLetter = "A",
  tagline = "One desk for every location.",
  tenantName = "",
  roleLabel = "",
  roleId = "",
  locale = "en",
  isAgencyStaff = false,
  isPlatformAdmin = false,
  mode = "brand",
  tenantId = "",
  agencies = [],
  allowedHrefs = null,
  t,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const byHref = Object.fromEntries(APP_NAV.map((n) => [n.href, n]));

  const navCtx = { role: roleId, mode, isAgencyStaff, isPlatformAdmin, hrefs: allowedHrefs };

  function hrefVisible(groupKey: keyof Messages["nav"]["groups"], href: string) {
    const item = byHref[href];
    if (!item) return false;
    if (item.platformOnly && !(isPlatformAdmin && mode === "platform")) return false;
    if (item.agencyOnly && !isAgencyStaff) return false;
    if (mode === "platform" && groupKey === "workspace" && href === "/activity") return false;
    if (mode !== "platform" && groupKey === "workspace" && href === "/activity") {
      return canSeeNavHref(navCtx, href);
    }
    return canSeeNavHref(navCtx, href);
  }

  const groups = NAV_GROUPS.filter((g) => {
    if (mode === "platform") return g.key === "platform" || g.key === "learn" || g.key === "workspace";
    if (g.key === "platform") return false;
    if (g.key === "admin") return isAgencyStaff;
    return true;
  }).map((g) => ({ ...g, hrefs: g.hrefs.filter((href) => hrefVisible(g.key, href)) }))
    .filter((g) => g.hrefs.length > 0);

  // Collapsed: icon rail only
  if (collapsed) {
    return (
      <aside className="sticky top-0 z-30 flex h-screen w-[72px] shrink-0 flex-col border-r border-slate-200/60 bg-white/95 shadow-[4px_0_32px_rgba(15,23,42,0.04)] backdrop-blur-xl">
        <div className="flex flex-col items-center gap-3 border-b border-slate-100 px-2 pb-3 pt-4">
          <BrandMark logoUrl={logoUrl} logoLetter={logoLetter} size="md" />
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-[#6fd6f6] hover:text-[#1f1b1d]"
            title="Show sidebar"
            aria-label="Show sidebar"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
          {groups.flatMap((g) => g.hrefs).map((href) => {
            const item = byHref[href];
            if (!item) return null;
            if (item.platformOnly && !(isPlatformAdmin && mode === "platform")) return null;
            if (item.agencyOnly && !isAgencyStaff) return null;
            if (!canSeeNavHref(navCtx, item.href)) return null;
            const labels = t.items[item.href] || { label: item.label, description: item.description };
            const active = navItemActive(pathname, item.href);
            const iconKey = NAV_ICON_KEY[item.href] || "settings";
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.comingLater ? `${labels.label} · coming later` : labels.label}
                onClick={onNavigate}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                  active
                    ? "bg-[var(--ink)] text-white shadow-md shadow-black/10"
                    : "text-slate-500 hover:bg-[#eef8ff] hover:text-[#1f1b1d]"
                }`}
              >
                <NavIcon name={iconKey} />
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 p-2">
          <button
            type="button"
            onClick={logout}
            title={t.logout}
            className="flex h-10 w-full items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-dvh w-[min(17.5rem,88vw)] shrink-0 flex-col border-r border-slate-200/60 bg-white/95 shadow-[4px_0_32px_rgba(15,23,42,0.035)] backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:w-60">
      <div className="border-b border-slate-100/90 px-4 pb-4 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark logoUrl={logoUrl} logoLetter={logoLetter} size="md" />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
                {appName}
              </div>
              <div className="truncate text-[11px] font-medium text-slate-400" title={tagline}>
                {tagline}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-400 shadow-sm transition hover:border-[#6fd6f6] hover:text-[#1f1b1d] lg:flex"
            title="Hide sidebar"
            aria-label="Hide sidebar"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {tenantName ? (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 lg:hidden">
            <p className="truncate text-[13px] font-semibold text-slate-900">{tenantName}</p>
            {roleLabel ? <p className="truncate text-[10px] text-slate-400">{roleLabel}</p> : null}
          </div>
        ) : null}
        {isPlatformAdmin ? (
          <div className="mt-3 lg:hidden">
            <WorkspaceSwitcher
              mode={mode}
              tenantId={tenantId}
              tenantName={tenantName}
              agencies={agencies}
              layout="sidebar"
            />
          </div>
        ) : null}
        <div className="mt-3 lg:hidden">
          <LanguageSwitcher locale={locale} size="md" />
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
        {groups.map((group) => (
          <div key={group.key}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
              {t.groups[group.key]}
            </p>
            <div className="space-y-0.5">
              {group.hrefs.map((href) => {
                const item = byHref[href];
                if (!item) return null;
                if (!hrefVisible(group.key, href)) return null;
                const labels = t.items[item.href] || {
                  label: item.label,
                  description: item.description,
                };
                const active = navItemActive(pathname, item.href);
                const iconKey = NAV_ICON_KEY[item.href] || "settings";
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={labels.description}
                    onClick={onNavigate}
                    className={`group relative flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-all duration-150 ${
                      active
                        ? "bg-[var(--ink)] text-white shadow-md shadow-black/10"
                        : "text-slate-600 hover:bg-[#eef8ff] hover:text-slate-900"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white/90" />
                    )}
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
                        active
                          ? "bg-white/15 text-white"
                          : "bg-slate-100/90 text-slate-500 group-hover:bg-white group-hover:text-[#1f1b1d] group-hover:shadow-sm"
                      }`}
                    >
                      <NavIcon name={iconKey} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight">
                      {labels.label}
                    </span>
                    {item.comingLater ? (
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
                          active
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        coming later
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100/90 p-3.5">
        <div className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-br from-slate-50 to-white px-2.5 py-2.5 ring-1 ring-slate-100">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef8ff] text-[11px] font-bold text-[#1f1b1d] ring-2 ring-white">
            {(userName || userEmail).slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-slate-800">
              {userName || userEmail}
            </div>
            <div className="truncate text-[10px] text-slate-400">{userEmail}</div>
          </div>
        </div>
        <button type="button" onClick={logout} className="an-btn-ghost mt-2.5 w-full text-xs">
          {t.logout}
        </button>
      </div>
    </aside>
  );
}
