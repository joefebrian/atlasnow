import Link from "next/link";
import { PageHeader } from "@/components/ui";
import {
  GBP_PERFORMANCE_METRICS,
  sourceBadge,
} from "@/lib/metrics/gbp-dictionary";

export default function MetricDictionaryPage() {
  const groups = {
    impressions: GBP_PERFORMANCE_METRICS.filter((m) => m.group === "impressions"),
    actions: GBP_PERFORMANCE_METRICS.filter((m) => m.group === "actions"),
    commerce: GBP_PERFORMANCE_METRICS.filter((m) => m.group === "commerce"),
  };

  return (
    <>
      <PageHeader
        eyebrow="S4 · Metrics"
        badge="PRD §8.2"
        title="GBP metric dictionary"
        description="Strict labels and forbidden claims for Google Business Profile Performance metrics. Live API pull is S5; Location 360 → Visibility already uses this contract."
      />

      <div className="an-card mb-4 p-4 text-xs leading-relaxed text-slate-500">
        Direction requests = <strong>visit intent</strong>, never store visits. Call-button
        clicks ≠ answered calls. Missing days render <strong>No data</strong>, never fake
        zeros.{" "}
        <Link href="/locations" className="font-semibold text-indigo-600 hover:underline">
          Open locations
        </Link>{" "}
        → Visibility tab.
      </div>

      {(
        [
          ["impressions", "Impressions"],
          ["actions", "Customer actions"],
          ["commerce", "Commerce actions"],
        ] as const
      ).map(([key, title]) => (
        <section key={key} className="mb-6">
          <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {title}
          </h2>
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th>UI label</th>
                  <th>API enum</th>
                  <th>Means</th>
                  <th>Do not claim</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {groups[key].map((m) => (
                  <tr key={m.metricKey}>
                    <td className="text-sm font-medium text-slate-800">{m.uiLabel}</td>
                    <td className="font-mono text-[10px] text-slate-600">{m.metricKey}</td>
                    <td className="text-xs text-slate-600">{m.interpretation}</td>
                    <td className="text-xs text-rose-700/90">{m.forbidden}</td>
                    <td>
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        {sourceBadge(m.sourceSystem)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
