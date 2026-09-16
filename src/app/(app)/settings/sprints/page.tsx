import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { SPRINTS_S1_S4, sprintSummary, type CheckState } from "@/lib/sprints/s1-s4-status";

const STATE_STYLE: Record<CheckState, string> = {
  done: "bg-emerald-50 text-emerald-800 ring-emerald-600/15",
  partial: "bg-amber-50 text-amber-900 ring-amber-600/15",
  planned: "bg-slate-100 text-slate-600 ring-slate-400/20",
};

const STATE_LABEL: Record<CheckState, string> = {
  done: "Done",
  partial: "Partial",
  planned: "Planned",
};

export default function SprintReadinessPage() {
  const summary = sprintSummary();

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        badge="S1–S4 · GO"
        title="Sprint readiness"
        description="Honest checklist: S1–S4 plus Wave A TikTok GO till + HQ WhatsApp templates. S5 Google Performance and TikTok DM inbox stay separate (DM is business-api, not Local Service)."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="an-card px-4 py-3">
          <div className="an-label">Checks done</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">
            {summary.done}
          </div>
        </div>
        <div className="an-card px-4 py-3">
          <div className="an-label">Partial</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-amber-700">
            {summary.partial}
          </div>
        </div>
        <div className="an-card px-4 py-3">
          <div className="an-label">Planned (S4 tail / S5+)</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-600">
            {summary.planned}
          </div>
        </div>
        <div className="an-card px-4 py-3">
          <div className="an-label">Total tracked</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {summary.total}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {SPRINTS_S1_S4.map((sprint) => (
          <section key={sprint.id} className="an-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{sprint.title}</h2>
                <p className="mt-1 text-xs text-slate-500">{sprint.summary}</p>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-slate-100">
              {sprint.checks.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-800">{c.label}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {c.id}
                      {c.note ? ` · ${c.note}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.href && (
                      <Link
                        href={c.href}
                        className="text-[11px] font-semibold text-indigo-600 hover:underline"
                      >
                        Open
                      </Link>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                        STATE_STYLE[c.state]
                      }`}
                    >
                      {STATE_LABEL[c.state]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
