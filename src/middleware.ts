import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { platformPathAllowed } from "@/lib/tenancy";
import { homePathForNav, pathAllowedForNav } from "@/lib/nav-access";
import { isClientRole } from "@/lib/roles";

const COOKIE = "atlasnow_session";

function secretKey() {
  const secret = process.env.AUTH_SECRET || "atlasnow-dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

function isHelpHost(host: string) {
  return host.split(":")[0].toLowerCase().startsWith("help.");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";
  if (isHelpHost(host)) {
    const url = request.nextUrl.clone();
    if (pathname === "/") {
      url.pathname = "/help";
      return NextResponse.rewrite(url);
    }
    if (
      !pathname.startsWith("/help") &&
      !pathname.startsWith("/_next") &&
      !pathname.startsWith("/api") &&
      !pathname.startsWith("/contact") &&
      !pathname.startsWith("/login") &&
      !pathname.startsWith("/privacy") &&
      !pathname.startsWith("/terms") &&
      !pathname.startsWith("/cookies") &&
      !pathname.startsWith("/brand")
    ) {
      url.pathname = `/help${pathname}`;
      return NextResponse.rewrite(url);
    }
  }
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isPublic =
    pathname === "/" ||
    isAuthPage ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/data-deletion") ||
    pathname.startsWith("/cookies") ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/faq") ||
    pathname.startsWith("/help") ||
    pathname.startsWith("/demo") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/join") ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/card") ||
    pathname.startsWith("/pay/yola") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/i/") ||
    pathname.startsWith("/api/join") ||
    pathname.startsWith("/api/card") ||
    pathname.startsWith("/api/c/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  const token = request.cookies.get(COOKIE)?.value;
  let valid = false;
  let mode: string | undefined;
  let role: string | undefined;
  let isAgencyStaff = false;
  let isPlatformAdmin = false;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey());
      valid = true;
      mode = typeof payload.mode === "string" ? payload.mode : undefined;
      role = typeof payload.role === "string" ? payload.role : undefined;
      isAgencyStaff = payload.isAgencyStaff === true;
      isPlatformAdmin = payload.isPlatformAdmin === true || role === "SUPER_ADMIN";
    } catch {
      valid = false;
    }
  }

  if (!valid && !isPublic && pathname.startsWith("/")) {
    // protect app routes
    if (
      pathname.startsWith("/control-tower") ||
      pathname.startsWith("/leakage-queue") ||
      pathname.startsWith("/locations") ||
      pathname.startsWith("/reputation") ||
      pathname.startsWith("/posts") ||
      pathname.startsWith("/ads") ||
      pathname.startsWith("/channels") ||
      pathname.startsWith("/conversations") ||
      pathname.startsWith("/broadcast") ||
      pathname.startsWith("/commerce") ||
      pathname.startsWith("/customers") ||
      pathname.startsWith("/loyalty") ||
      pathname.startsWith("/action-center") ||
      pathname.startsWith("/data-health") ||
      pathname.startsWith("/reports") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/activity") ||
      pathname.startsWith("/clients") ||
      pathname.startsWith("/agencies") ||
      pathname.startsWith("/support") ||
      pathname.startsWith("/deck_pitch") ||
      pathname.startsWith("/deck_train")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (valid && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = homePathForNav({ role: role || "", mode, isAgencyStaff, isPlatformAdmin });
    return NextResponse.redirect(url);
  }

  if (valid && role === "SUPER_ADMIN" && mode === "platform" && !isPublic) {
    if (!platformPathAllowed(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/agencies";
      return NextResponse.redirect(url);
    }
  }

  if (valid && role && isClientRole(role) && mode === "brand") {
    if (pathname.startsWith("/clients") || pathname.startsWith("/agencies")) {
      const url = request.nextUrl.clone();
      url.pathname = homePathForNav({ role, mode, isAgencyStaff, isPlatformAdmin });
      url.search = "";
      return NextResponse.redirect(url);
    }
  } else if (valid && !isPublic && role) {
    const ctx = { role, mode, isAgencyStaff, isPlatformAdmin };
    if (!pathAllowedForNav(ctx, pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = homePathForNav(ctx);
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  const res = NextResponse.next();
  res.headers.set("x-atlas-pathname", pathname);
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
