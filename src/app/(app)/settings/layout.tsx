import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { SettingsSubnav, type SettingsNavItem } from "@/components/settings/SettingsSubnav";
import { canSeeSettingsHref } from "@/lib/nav-access";
import { navCtxForSession } from "@/lib/role-menu";
import { getLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const t = getMessages(locale).settings;

  const navCtx = await navCtxForSession(session);

  const items: SettingsNavItem[] = [
    {
      href: "/settings",
      label: t.navOverview,
      description: t.navOverviewHint,
    },
    {
      href: "/settings/chat-apps",
      label: t.navChatApps,
      description: t.navChatAppsHint,
    },
    {
      href: "/settings/loyalty",
      label: "Loyalty",
      description: "Stamp card and top spender rules",
    },
    {
      href: "/settings/broadcast",
      label: locale === "id" ? "Harga broadcast" : "Broadcast pricing",
      description: locale === "id" ? "Fee Atlas + margin Meta · Super Admin" : "Atlas fee + Meta margin · Super Admin",
      platformOnly: true,
    },
    {
      href: "/settings/brand",
      label: locale === "id" ? "Logo merek" : "Brand mark",
      description: locale === "id" ? "Logo halaman daftar member" : "Logo on the join page",
    },
    {
      href: "/settings/google",
      label: t.navGoogle,
      description: t.navGoogleHint,
    },
    {
      href: "/settings/branding",
      label: t.navBranding,
      description: t.navBrandingHint,
    },
    {
      href: "/settings/pages",
      label: t.navPages,
      description: t.navPagesHint,
      agencyOnly: true,
    },
    {
      href: "/settings/password",
      label: t.navPassword,
      description: t.navPasswordHint,
    },
    {
      href: "/settings/access",
      label: locale === "id" ? "Akses menu" : "Menu access",
      description: locale === "id" ? "Centang menu per role" : "Tick menus per role",
    },
    {
      href: "/settings/api",
      label: t.navApi,
      description: t.navApiHint,
      agencyOnly: true,
    },
    {
      href: "/settings/metrics",
      label: locale === "id" ? "Kamus metrik" : "Metric dictionary",
      description: locale === "id" ? "GBP enum & label" : "GBP enums & labels",
      platformOnly: true,
    },
    {
      href: "/settings/sprints",
      label: locale === "id" ? "Kesiapan sprint" : "Sprint readiness",
      description: "S1–S4 checklist",
      platformOnly: true,
    },
    {
      href: "/settings/errors",
      label: "Error log",
      description: locale === "id" ? "Error saja, siap di-copy" : "Errors only, copy to Grok",
      platformOnly: true,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <SettingsSubnav
        items={items.filter((i) => canSeeSettingsHref(navCtx, i.href))}
        isAgencyStaff={session.isAgencyStaff || session.isPlatformAdmin}
        isPlatformAdmin={session.isPlatformAdmin}
      />
      <div className="space-y-6">{children}</div>
    </div>
  );
}
