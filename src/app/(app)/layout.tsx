import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { getLocalizedBranding } from "@/lib/branding";
import { getLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { navCtxForSession } from "@/lib/role-menu";
import { homePathForNav, pathAllowedForNav } from "@/lib/nav-access";
import { tenantOwnsYola, yolaRoleAllowed } from "@/lib/yola/access";

export const metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) {
    redirect("/login");
  }

  const locale = await getLocale();
  const t = getMessages(locale);
  const roleLabel = ROLE_LABELS[session.role as Role] || session.role;
  const branding = await getLocalizedBranding(locale);
  const navCtx = await navCtxForSession(session);
  const showYola = yolaRoleAllowed(session.role) && (await tenantOwnsYola(session.tenantId));
  const pathname = (await headers()).get("x-atlas-pathname") || "";
  if (pathname && !session.isAgencyStaff && session.tenantType === "CLIENT") {
    const yolaPath = pathname === "/yola" || pathname.startsWith("/yola/");
    if (yolaPath) {
      if (!showYola) redirect(homePathForNav(navCtx));
    } else if (!pathAllowedForNav(navCtx, pathname)) {
      redirect(homePathForNav(navCtx));
    }
  }

  const agencies = session.isPlatformAdmin
    ? await prisma.tenant.findMany({
        where: { type: "AGENCY", status: { not: "ARCHIVED" } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      })
    : [];

  return (
    <AppShell
      locale={locale}
      shell={t.shell}
      nav={t.nav}
      userName={session.name}
      userEmail={session.email}
      tenantName={session.tenantName}
      tenantSlug={session.tenantSlug}
      role={roleLabel}
      roleId={session.role}
      isAgencyStaff={session.isAgencyStaff}
      isPlatformAdmin={session.isPlatformAdmin}
      mode={session.mode}
      tenantId={session.tenantId}
      agencies={agencies}
      appName={branding.appName}
      logoUrl={branding.logoUrl}
      logoLetter={branding.logoLetter}
      tagline={branding.tagline}
      allowedHrefs={navCtx.hrefs ? [...navCtx.hrefs] : null}
      showYola={showYola}
    >
      {children}
    </AppShell>
  );
}
