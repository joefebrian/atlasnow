import Link from "next/link";
import type { Locale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";

export function ReportsTabs({
  locale,
  clientId,
  view,
}: {
  locale: Locale;
  clientId: string | null;
  view: "loyalty" | "outlets";
}) {
  const t = getMessages(locale).reports;
  const loyalty = clientId ? `/reports?client=${encodeURIComponent(clientId)}` : "/reports";
  const outlets = clientId
    ? `/reports?client=${encodeURIComponent(clientId)}&view=outlets`
    : "/reports?view=outlets";
  const tab = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
      active ? "bg-[var(--ink)] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200/90 hover:bg-[#eef8ff]"
    }`;

  return (
    <nav className="mb-5 flex flex-wrap gap-2">
      <Link href={loyalty} className={tab(view === "loyalty")}>
        {t.tabLoyalty}
      </Link>
      <Link href={outlets} className={tab(view === "outlets")}>
        {t.tabOutlets}
      </Link>
    </nav>
  );
}
