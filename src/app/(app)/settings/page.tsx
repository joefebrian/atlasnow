import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";
import { listIntegrationViews } from "@/lib/integrations/service";
import { isStandaloneBrandSession } from "@/lib/tenancy";
import { canSeeSettingsHref } from "@/lib/nav-access";
import { navCtxForSession } from "@/lib/role-menu";
import { ApplyAgencyCard } from "@/components/settings/ApplyAgencyCard";

export default async function SettingsHubPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const t = getMessages(locale).settings;
  const navCtx = await navCtxForSession(session);

  let apiReady = 0;
  let apiTotal = 0;
  if (session.isAgencyStaff) {
    const integrations = await listIntegrationViews();
    apiTotal = integrations.length;
    apiReady = integrations.filter((i) => i.status === "ready" || i.status === "mock")
      .length;
  }

  const cards: {
    href: string;
    title: string;
    body: string;
    meta: string;
    agencyOnly: boolean;
    platformOnly?: boolean;
  }[] = [
    {
      href: "/settings/chat-apps",
      title: t.navChatApps,
      body: t.hubChatAppsBody,
      meta: locale === "id" ? "WhatsApp & Facebook" : "WhatsApp & Facebook",
      agencyOnly: false,
    },
    {
      href: "/settings/broadcast",
      title: locale === "id" ? "Harga broadcast" : "Broadcast pricing",
      body:
        locale === "id"
          ? "Fee AtlasNow di atas tarif Meta. Rp per pesan plus persen margin. Super Admin saja."
          : "AtlasNow fee on top of Meta. Rp per message plus a percent margin. Super Admin only.",
      meta: "PAYG · Super Admin",
      agencyOnly: false,
      platformOnly: true,
    },
    {
      href: "/settings/google",
      title: t.navGoogle,
      body: t.hubGoogleBody,
      meta: "Business Profile",
      agencyOnly: false,
    },
    {
      href: "/settings/brand",
      title: locale === "id" ? "Logo merek" : "Brand mark",
      body:
        locale === "id"
          ? "Logo persegi di halaman daftar member. Atlas kompres otomatis."
          : "Square logo on the public join page. Atlas compresses it for the web.",
      meta: "/join",
      agencyOnly: false,
    },
    {
      href: "/settings/branding",
      title: t.navBranding,
      body: t.hubBrandingBody,
      meta: t.language,
      agencyOnly: false,
    },
    {
      href: "/settings/pages",
      title: t.navPages,
      body: t.hubPagesBody,
      meta: "atlasnow.co",
      agencyOnly: true,
    },
    {
      href: "/settings/access",
      title: locale === "id" ? "Akses menu" : "Menu access",
      body:
        locale === "id"
          ? "Centang menu yang boleh dibuka tiap role. Kasir (Branch PIC) satu cabang."
          : "Tick which menus each role may open. Branch PIC is one outlet.",
      meta: locale === "id" ? "Role" : "Roles",
      agencyOnly: false,
    },
    {
      href: "/settings/password",
      title: t.navPassword,
      body: t.hubPasswordBody,
      meta: locale === "id" ? "Semua user" : "All users",
      agencyOnly: false,
    },
    {
      href: "/settings/api",
      title: t.navApi,
      body: t.hubApiBody,
      meta: session.isAgencyStaff
        ? `${apiReady}/${apiTotal} ${t.hubApiMeta}`
        : t.agencyOnly,
      agencyOnly: true,
    },
    {
      href: "/settings/metrics",
      title: locale === "id" ? "Kamus metrik GBP" : "GBP metric dictionary",
      body:
        locale === "id"
          ? "Label ketat, larangan interpretasi, dan kontrak kartu Visibility (S4)."
          : "Strict labels, forbidden claims, and Visibility card contract (S4).",
      meta: "S4",
      agencyOnly: true,
    },
    {
      href: "/settings/sprints",
      title: locale === "id" ? "Kesiapan S1–S4" : "S1–S4 readiness",
      body:
        locale === "id"
          ? "Checklist jujur: apa yang sudah live vs planned (GSC, Performance sync)."
          : "Honest checklist: what is live vs planned (GSC, Performance sync).",
      meta: "QA",
      agencyOnly: true,
    },
  ].filter((c) => canSeeSettingsHref(navCtx, c.href));

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        badge={t.badge}
        title={t.title}
        description={t.hubDescription}
      />

      {isStandaloneBrandSession(session) ? <ApplyAgencyCard locale={locale} /> : null}

      <div className="an-card hidden flex-col gap-3 px-5 py-4 sm:flex sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{t.language}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{t.languageHint}</p>
        </div>
        <LanguageSwitcher locale={locale} size="md" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="an-card-hover block p-5 sm:p-6">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {card.meta}
            </div>
            <div className="mt-1 text-[15px] font-semibold text-slate-900">{card.title}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{card.body}</p>
            <div className="mt-4 text-xs font-semibold text-[#2a9bb8]">
              {t.openSection} →
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
