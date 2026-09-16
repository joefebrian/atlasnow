import type { ChangeEvent, ReactNode } from "react";
import Link from "next/link";

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500 transition hover:text-slate-900"
    >
      <span aria-hidden className="text-base leading-none">
        ←
      </span>
      {children}
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  badge,
  eyebrow,
  back,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: string;
  eyebrow?: string;
  back?: ReactNode;
}) {
  return (
    <div className="mb-5 sm:mb-6">
      {back ? <div className="mb-2.5">{back}</div> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          {(badge || eyebrow) && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {eyebrow && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2a9bb8] sm:text-[11px]">
                  <span className="h-1 w-1 rounded-full bg-[#6fd6f6] shadow-[0_0_0_3px_rgba(111,214,246,0.35)]" />
                  {eyebrow}
                </span>
              )}
              {badge && <span className="an-badge-demo">{badge}</span>}
            </div>
          )}
          <h1 className="an-title">{title}</h1>
          {description && (
            <p className="an-subtle mt-1.5 max-w-2xl text-[13px] leading-relaxed sm:mt-2 sm:text-sm">
              {description}
            </p>
          )}
        </div>
        {actions ? (
          <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 sm:w-auto">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  delta,
  deltaUp,
  icon,
  accent = "indigo",
  compact = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: string;
  deltaUp?: boolean;
  icon?: ReactNode;
  accent?: "indigo" | "emerald" | "amber" | "sky" | "slate";
  compact?: boolean;
}) {
  const accents = {
    indigo: "from-indigo-500/15 to-transparent text-indigo-600",
    emerald: "from-emerald-500/15 to-transparent text-emerald-600",
    amber: "from-amber-500/15 to-transparent text-amber-600",
    sky: "from-sky-500/15 to-transparent text-sky-600",
    slate: "from-slate-400/15 to-transparent text-slate-500",
  };

  return (
    <div className={`an-card-hover group relative overflow-hidden ${compact ? "p-3 sm:p-5" : "p-4 sm:p-5"}`}>
      <div
        className={`pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br opacity-80 blur-2xl transition group-hover:opacity-100 ${accents[accent]}`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="an-label">{label}</div>
          <div
            className={`mt-1 font-semibold tracking-tight tabular-nums text-slate-900 ${
              compact ? "text-xl sm:text-[1.65rem]" : "mt-1.5 text-2xl sm:text-[1.65rem]"
            }`}
          >
            {value}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {delta && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                deltaUp
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10"
                  : "bg-rose-50 text-rose-700 ring-1 ring-rose-600/10"
              }`}
            >
              {delta}
            </span>
          )}
          {icon && (
            <span className="hidden h-9 w-9 items-center justify-center rounded-xl bg-white text-sm shadow-sm ring-1 ring-slate-100 sm:flex">
              {icon}
            </span>
          )}
        </div>
      </div>
      {hint && (
        <p className="relative mt-2 text-xs leading-snug text-slate-400">{hint}</p>
      )}
    </div>
  );
}

export function MetricTile({
  icon,
  value,
  label,
  tone = "amber",
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
  tone?: "amber" | "indigo" | "rose" | "emerald" | "sky";
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-500 ring-amber-100",
    indigo: "bg-indigo-50 text-indigo-500 ring-indigo-100",
    rose: "bg-rose-50 text-rose-500 ring-rose-100",
    emerald: "bg-emerald-50 text-emerald-500 ring-emerald-100",
    sky: "bg-sky-50 text-sky-500 ring-sky-100",
  };
  return (
    <div className="an-card flex items-center gap-4 p-4 transition hover:shadow-[var(--shadow-md)]">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg ring-1 ${tones[tone]}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
          {value}
        </div>
        <div className="text-xs font-medium text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5 text-[13px] leading-none" aria-label={`${n} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={i < n ? "text-amber-400 drop-shadow-[0_1px_1px_rgba(251,191,36,0.35)]" : "text-slate-200"}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="an-card flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
      {children}
    </div>
  );
}

export function SearchField({
  placeholder = "Search…",
  className = "",
  value,
  onChange,
}: {
  placeholder?: string;
  className?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const controlled = value !== undefined;
  return (
    <div className={`relative min-w-[200px] max-w-sm flex-1 ${className}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">
        ⌕
      </span>
      <input
        type="search"
        placeholder={placeholder}
        className="an-input pl-9"
        value={controlled ? value : undefined}
        onChange={onChange}
        readOnly={!controlled && !onChange}
        title={controlled || onChange ? undefined : "Search"}
      />
    </div>
  );
}

export function PeriodPills() {
  return (
    <div className="inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200/80">
      {["7d", "28d", "90d"].map((p, i) => (
        <button
          key={p}
          type="button"
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            i === 1
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="an-card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl text-white shadow-lg shadow-indigo-500/30">
        ✦
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">{body}</p>
    </div>
  );
}

export function SectionLabel({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold tracking-tight text-slate-800">{children}</h2>
      {hint && (
        <span className="text-[11px] font-medium text-slate-400">{hint}</span>
      )}
    </div>
  );
}

export function DemoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-100/80 bg-gradient-to-r from-indigo-50/90 via-white to-sky-50/60 px-4 py-3.5 shadow-sm sm:px-5">
      <div className="pointer-events-none absolute inset-0 an-mesh-dot opacity-60" />
      <div className="relative flex flex-wrap items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sm shadow-sm ring-1 ring-indigo-100">
          ◎
        </span>
        <div className="min-w-0 flex-1 text-sm leading-relaxed text-slate-600">
          {children}
        </div>
      </div>
    </div>
  );
}

export function TableShell({
  children,
  metaLeft,
  metaRight,
}: {
  children: ReactNode;
  metaLeft?: ReactNode;
  metaRight?: ReactNode;
}) {
  return (
    <div className="an-table-wrap">
      {(metaLeft || metaRight) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-white px-5 py-3.5">
          <div className="text-sm text-slate-500">{metaLeft}</div>
          {metaRight && (
            <div className="text-[11px] font-medium text-slate-400">{metaRight}</div>
          )}
        </div>
      )}
      <div className="min-w-0 overflow-x-auto">{children}</div>
    </div>
  );
}

export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const sizes = {
    sm: "h-8 w-8 text-[10px]",
    md: "h-9 w-9 text-[11px]",
    lg: "h-11 w-11 text-xs",
  };
  const hues = [
    "from-indigo-100 to-indigo-200 text-indigo-700",
    "from-violet-100 to-violet-200 text-violet-700",
    "from-sky-100 to-sky-200 text-sky-700",
    "from-emerald-100 to-emerald-200 text-emerald-700",
    "from-amber-100 to-amber-200 text-amber-800",
  ];
  const hue = hues[name.length % hues.length];

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold shadow-inner ring-2 ring-white ${sizes[size]} ${hue}`}
    >
      {initials}
    </span>
  );
}
