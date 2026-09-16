import { Suspense } from "react";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { DataHealthPanel } from "@/components/google/DataHealthPanel";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { getLocale } from "@/lib/i18n/get-locale";
import { getMessages } from "@/lib/i18n/messages";

export default async function SettingsGooglePage() {
  const session = await readSession();
  if (!session) redirect("/login");
  const locale = await getLocale();
  const t = getMessages(locale).settings;

  if (!session.isAgencyStaff) {
    return (
      <ModulePlaceholder
        title={t.navGoogle}
        description={
          locale === "id"
            ? "Google disambungkan oleh tim agency. Staff cabang tetap bisa lihat outlet di Cabang."
            : "Google is connected by the agency team. Outlet staff can still see their branches on Outlets."
        }
        fase="E0 · S3"
        bullets={
          locale === "id"
            ? [
                "Minta agency sambungkan Google Business Profile",
                "Outlet yang sudah dipasangkan tampil MAPPED di Location 360",
              ]
            : [
                "Ask agency to connect Google Business Profile",
                "Mapped locations show readiness MAPPED on Location 360",
              ]
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Google"
        badge="Live"
        title={t.navGoogle}
        description={t.hubGoogleBody}
      />
      <Suspense fallback={<div className="an-card p-8 text-sm text-slate-400">Loading…</div>}>
        <DataHealthPanel locale={locale} />
      </Suspense>
    </div>
  );
}
