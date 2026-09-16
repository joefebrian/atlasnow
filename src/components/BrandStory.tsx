import type { LocalizedBranding } from "@/lib/branding-defaults";

export function BrandStory({
  branding,
  labels,
}: {
  branding: LocalizedBranding;
  labels: { brandPromise: string; growthFlow: string };
}) {
  return (
    <div className="an-card relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute -bottom-12 left-1/4 h-36 w-36 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute inset-0 an-mesh-dot opacity-40" />
      </div>

      <div className="relative grid gap-8 p-5 sm:p-6 lg:grid-cols-[1.2fr_1fr] lg:gap-10 lg:p-7">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
            {labels.brandPromise}
          </p>
          <p className="mt-2 text-sm font-semibold text-indigo-700/90">{branding.tagline}</p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl sm:leading-snug">
            {branding.heroHeadline}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {branding.supportingNarrative}
          </p>
          <p className="mt-4 inline-flex rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold leading-snug text-white shadow-md shadow-slate-900/15">
            {branding.productPromise}
          </p>
        </div>

        <div>
          <p className="an-label mb-3">{labels.growthFlow}</p>
          <ol className="space-y-2">
            {branding.flowSteps.map((step, i) => (
              <li
                key={`${i}-${step}`}
                className="flex items-start gap-3 rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-slate-100"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[11px] font-bold tabular-nums text-indigo-700 ring-1 ring-indigo-100">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-sm font-medium leading-snug text-slate-700">
                  {step}
                </span>
                {i < branding.flowSteps.length - 1 && (
                  <span className="ml-auto hidden text-slate-300 sm:inline">→</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
