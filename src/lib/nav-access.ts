import { isAgencyStaff } from "@/lib/roles";

/**
 * Menu access matrix.
 * Brand roles: customize the lists below (kasir = Loyalty only, etc.).
 * Group / Super Admin still use agency + platform flags.
 * A Settings UI can later write over these lists — keep hrefs stable.
 */
export const BRAND_NAV: Record<string, readonly string[]> = {
  CLIENT_ADMIN: [
    "/control-tower",
    "/conversations",
    "/broadcast",
    "/leakage-queue",
    "/customers",
    "/loyalty",
    "/locations",
    "/reputation",
    "/reports",
    "/settings",
    "/posts",
    "/ads",
    "/action-center",
  ],
  HQ_MARKETING: [
    "/control-tower",
    "/conversations",
    "/broadcast",
    "/customers",
    "/reputation",
    "/reports",
    "/settings",
  ],
  HQ_OPS: ["/control-tower", "/loyalty", "/customers", "/locations", "/reports", "/settings"],
  REGIONAL: ["/control-tower", "/loyalty", "/customers", "/locations", "/reports", "/settings"],
  BRANCH: ["/loyalty"],
  VIEWER: ["/control-tower", "/reports"],
};

export const MENU_CHOICES: { href: string; label: string; group: "work" | "settings" }[] = [
  { href: "/control-tower", label: "Home", group: "work" },
  { href: "/conversations", label: "Inbox", group: "work" },
  { href: "/broadcast", label: "WhatsApp broadcast", group: "work" },
  { href: "/loyalty", label: "Loyalty", group: "work" },
  { href: "/customers", label: "Customers", group: "work" },
  { href: "/locations", label: "Outlets", group: "work" },
  { href: "/reputation", label: "Reviews", group: "work" },
  { href: "/reports", label: "Reports", group: "work" },
  { href: "/leakage-queue", label: "Needs a look", group: "work" },
  { href: "/settings", label: "Settings hub", group: "settings" },
  { href: "/settings/chat-apps", label: "Chat apps", group: "settings" },
  { href: "/settings/loyalty", label: "Loyalty program", group: "settings" },
  { href: "/settings/brand", label: "Brand mark", group: "settings" },
  { href: "/settings/google", label: "Google", group: "settings" },
  { href: "/settings/branding", label: "Branding", group: "settings" },
  { href: "/settings/password", label: "Password", group: "settings" },
  { href: "/settings/access", label: "Menu access", group: "settings" },
];

const MENU_HREF_SET = new Set(MENU_CHOICES.map((c) => c.href));

export function sanitizeMenuHrefs(hrefs: string[]): string[] {
  return [...new Set(hrefs.filter((h) => MENU_HREF_SET.has(h)))];
}

export function defaultHrefsForRole(role: string): string[] {
  const nav = BRAND_NAV[role] || BRAND_NAV.VIEWER;
  const settings = BRAND_SETTINGS[role] || BRAND_SETTINGS.VIEWER;
  return sanitizeMenuHrefs([...nav, ...settings]);
}

export const BRAND_SETTINGS: Record<string, readonly string[]> = {
  CLIENT_ADMIN: [
    "/settings",
    "/settings/chat-apps",
    "/settings/loyalty",
    "/settings/brand",
    "/settings/google",
    "/settings/branding",
    "/settings/password",
    "/settings/access",
  ],
  HQ_MARKETING: ["/settings", "/settings/chat-apps", "/settings/password"],
  HQ_OPS: ["/settings", "/settings/password"],
  REGIONAL: ["/settings", "/settings/password"],
  BRANCH: [],
  VIEWER: ["/settings/password"],
};

export type NavCtx = {
  role: string;
  mode?: string;
  isAgencyStaff?: boolean;
  isPlatformAdmin?: boolean;
  /** Saved checkbox list for this brand + role. Null/undefined = code defaults. */
  hrefs?: readonly string[] | null;
};

function hrefMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function homePathForNav(ctx: NavCtx): string {
  if (ctx.isPlatformAdmin && ctx.mode === "platform") return "/agencies";
  if (ctx.isAgencyStaff || isAgencyStaff(ctx.role)) return "/clients";
  const list = [...(ctx.hrefs ?? brandNavHrefs(ctx.role))].filter(
    (h) => !h.startsWith("/settings") || h === "/settings"
  );
  if (list.includes("/control-tower")) return "/control-tower";
  if (list.includes("/loyalty")) return "/loyalty";
  if (list.includes("/reports")) return "/reports";
  if (list[0] && list[0] !== "/settings") return list[0];
  return ctx.role === "BRANCH" ? "/loyalty" : "/control-tower";
}

export function brandNavHrefs(role: string): readonly string[] {
  return BRAND_NAV[role] || BRAND_NAV.VIEWER;
}

function resolvedBrandHrefs(ctx: NavCtx): readonly string[] {
  if (ctx.hrefs && ctx.hrefs.length > 0) return ctx.hrefs;
  return defaultHrefsForRole(ctx.role);
}

export function canSeeNavHref(ctx: NavCtx, href: string): boolean {
  if (
    href.startsWith("/agencies") ||
    href.startsWith("/billing") ||
    href.startsWith("/deck_pitch") ||
    href.startsWith("/deck_train")
  ) {
    return Boolean(ctx.isPlatformAdmin && ctx.mode === "platform");
  }
  if (href === "/clients" || href.startsWith("/clients/")) {
    return Boolean(ctx.isAgencyStaff);
  }
  if (ctx.isAgencyStaff || ctx.isPlatformAdmin) {
    if (href === "/settings/broadcast") return Boolean(ctx.isPlatformAdmin);
    return true;
  }
  const list = resolvedBrandHrefs(ctx);
  if (href === "/settings") {
    return list.includes("/settings") || list.some((h) => h.startsWith("/settings/"));
  }
  return list.includes(href);
}

export function canSeeSettingsHref(ctx: NavCtx, href: string): boolean {
  if (href === "/settings/access") {
    return Boolean(ctx.isPlatformAdmin || ctx.isAgencyStaff || ctx.role === "CLIENT_ADMIN");
  }
  if (href === "/settings/broadcast") return Boolean(ctx.isPlatformAdmin);
  if (href === "/settings/sprints" || href === "/settings/errors" || href === "/settings/metrics") {
    return Boolean(ctx.isPlatformAdmin);
  }
  if (href === "/settings/pages" || href === "/settings/api") {
    return Boolean(ctx.isAgencyStaff || ctx.isPlatformAdmin);
  }
  if (ctx.isAgencyStaff || ctx.isPlatformAdmin) {
    if (ctx.role === "BRANCH") return false;
    return true;
  }
  const list = resolvedBrandHrefs(ctx);
  if (href === "/settings") return list.includes("/settings") || list.some((h) => h.startsWith("/settings/"));
  return list.includes(href);
}

export function pathAllowedForNav(ctx: NavCtx, pathname: string): boolean {
  if (pathname.startsWith("/settings")) {
    if (pathname === "/settings" || pathname === "/settings/") {
      return canSeeSettingsHref(ctx, "/settings");
    }
    const hit = [
      "/settings/chat-apps",
      "/settings/loyalty",
      "/settings/broadcast",
      "/settings/brand",
      "/settings/google",
      "/settings/branding",
      "/settings/pages",
      "/settings/password",
      "/settings/api",
      "/settings/metrics",
      "/settings/sprints",
      "/settings/errors",
      "/settings/access",
    ].find((h) => hrefMatches(pathname, h));
    return canSeeSettingsHref(ctx, hit || "/settings");
  }
  if (ctx.isPlatformAdmin && ctx.mode === "platform") {
    return true;
  }
  if (ctx.isAgencyStaff || isAgencyStaff(ctx.role)) {
    if (pathname.startsWith("/agencies") || pathname.startsWith("/billing")) {
      return Boolean(ctx.isPlatformAdmin);
    }
    if (pathname.startsWith("/deck_pitch") || pathname.startsWith("/deck_train")) {
      return Boolean(ctx.isPlatformAdmin && ctx.mode === "platform");
    }
    return true;
  }
  const allowed = resolvedBrandHrefs(ctx);
  return allowed.some((h) => hrefMatches(pathname, h));
}
