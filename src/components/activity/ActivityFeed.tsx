import type { Locale } from "@/lib/i18n/locale";
import type { ActivityView } from "@/lib/activity";

export function ActivityFeed({ items, locale }: { items: ActivityView[]; locale: Locale }) {
  if (items.length === 0) {
    return (
      <div className="an-card px-6 py-12 text-center text-sm text-slate-500">
        {locale === "id" ? "Belum ada jejak." : "No activity yet."}
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="an-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                item.kind === "system"
                  ? "bg-amber-100 text-amber-800"
                  : item.kind === "access"
                    ? "bg-slate-100 text-slate-600"
                    : "bg-indigo-50 text-indigo-700"
              }`}
            >
              {item.kind === "system" ? (locale === "id" ? "Sistem" : "System") : item.kind === "access" ? (locale === "id" ? "Akses" : "Access") : locale === "id" ? "Orang" : "Person"}
            </span>
            <span className="text-sm font-semibold text-slate-900">{item.title}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {item.actorLabel}
            {item.detail ? ` · ${item.detail}` : ""}
            {" · "}
            {new Date(item.at).toLocaleString(locale === "id" ? "id-ID" : "en-GB", {
              timeZone: "Asia/Jakarta",
            })}
          </p>
        </li>
      ))}
    </ol>
  );
}
