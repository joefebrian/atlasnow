import { getBranding } from "@/lib/branding";
import { PageHeader } from "@/components/ui";
import { SettingsBrandingForm } from "@/components/SettingsBrandingForm";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getLocale } from "@/lib/i18n/get-locale";
import { LOCALE_LABELS } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";

export default async function SettingsBrandingPage() {
  const locale = await getLocale();
  const t = getMessages(locale).settings;
  const branding = await getBranding();

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        badge={t.badge}
        title={t.branding}
        description={t.description}
      />

      <div className="an-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{t.language}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{t.languageHint}</p>
          <p className="mt-2 text-[11px] font-medium text-slate-400">
            {LOCALE_LABELS[locale]}
          </p>
        </div>
        <LanguageSwitcher locale={locale} size="md" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: t.panel, value: t.branding },
          { label: t.scope, value: "App-wide" },
          { label: t.storage, value: "SQLite" },
        ].map((x) => (
          <div key={x.label} className="an-card px-4 py-3">
            <div className="an-label">{x.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">{x.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <SettingsBrandingForm initial={branding} t={t} />
      </div>
    </>
  );
}
