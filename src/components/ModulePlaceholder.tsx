import Link from "next/link";
import { PageHeader } from "@/components/ui";

type Props = {
  title: string;
  description: string;
  fase: string;
  bullets?: string[];
};

export function ModulePlaceholder({ title, description, fase, bullets = [] }: Props) {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader badge="Coming later" title={title} description={description} />

      <div className="an-card overflow-hidden">
        <div className="relative border-b border-slate-100 bg-gradient-to-r from-indigo-50/90 via-white to-sky-50/40 px-5 py-5">
          <div className="pointer-events-none absolute inset-0 an-mesh-dot opacity-40" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sm shadow-sm ring-1 ring-indigo-100">
              ◈
            </span>
            <div>
              <p className="text-sm font-semibold text-indigo-800">Coming later</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
                This page stays in the menu so the idea is visible. The real workflow
                lands here when it is ready — no extra product to learn now.
              </p>
            </div>
          </div>
        </div>
        {bullets.length > 0 ? (
          <ul className="divide-y divide-slate-50">
            {bullets.map((b, i) => (
              <li key={b} className="flex gap-3 px-5 py-3.5 text-sm text-slate-600">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold tabular-nums text-indigo-600 ring-1 ring-indigo-100">
                  {i + 1}
                </span>
                {b}
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-100">
              ···
            </div>
            <p className="text-sm text-slate-400">
              Spec locked in PRD · implement after Control loop is solid.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/control-tower" className="an-btn-primary">
          Performance
        </Link>
        <Link href="/reputation" className="an-btn-ghost">
          Reviews
        </Link>
        <Link href="/posts" className="an-btn-ghost">
          Posts
        </Link>
      </div>
    </div>
  );
}
