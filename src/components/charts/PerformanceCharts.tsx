"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HOURLY, PERF_SUMMARY } from "@/lib/mock-gbp";

const COLORS = ["#6366f1", "#34d399", "#fbbf24", "#94a3b8"];

const tipStyle = {
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 16px 48px rgba(15,23,42,0.1)",
  padding: "10px 14px",
  background: "rgba(255,255,255,0.98)",
};

export function PerformanceDashboard() {
  const deviceData = [
    { name: "Desktop", value: PERF_SUMMARY.platformDevice.desktop },
    { name: "Mobile", value: PERF_SUMMARY.platformDevice.mobile },
    { name: "Tablet", value: PERF_SUMMARY.platformDevice.tablet },
    { name: "Voice", value: PERF_SUMMARY.platformDevice.voice },
  ];
  const searchMaps = [
    { name: "Maps", value: PERF_SUMMARY.searchVsMaps.maps },
    { name: "Search", value: PERF_SUMMARY.searchVsMaps.search },
  ];
  const totalDevice = deviceData.reduce((s, d) => s + d.value, 0);
  const totalSM = searchMaps.reduce((s, d) => s + d.value, 0);

  return (
    <div className="an-section">
      <div className="grid gap-4 lg:grid-cols-3">
        <DonutCard
          title="Platform & device"
          total={totalDevice}
          totalLabel="impressions"
          data={deviceData}
        />
        <DonutCard
          title="Search vs Maps"
          total={totalSM}
          totalLabel="impressions"
          data={searchMaps}
          colors={["#8b5cf6", "#38bdf8"]}
        />
        <div className="an-card relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-gradient-to-br from-indigo-200/50 to-violet-100/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-6 -left-4 h-24 w-24 rounded-full bg-amber-100/40 blur-2xl" />
          <p className="an-label">Portfolio snapshot</p>
          <div className="relative mt-5 grid grid-cols-2 gap-6">
            <div>
              <div className="text-4xl font-semibold tabular-nums tracking-tight text-slate-900">
                {PERF_SUMMARY.avgRating}
              </div>
              <div className="mt-1 text-xs font-medium text-slate-500">Average rating</div>
              <div className="mt-1.5 flex gap-0.5 text-sm text-amber-400">
                {"★★★★☆".split("").map((s, i) => (
                  <span key={i} className={i < 4 ? "" : "text-slate-200"}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-4xl font-semibold tabular-nums tracking-tight text-slate-900">
                {PERF_SUMMARY.reviews}
              </div>
              <div className="mt-1 text-xs font-medium text-slate-500">Reviews total</div>
              <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/10">
                Experience signal
              </div>
            </div>
          </div>
          <p className="relative mt-6 rounded-2xl bg-slate-50/90 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500 ring-1 ring-slate-100">
            Demo metrics for product UX. Live Google Business Profile enums + Metric Data Contract in S5.
            Directions ={" "}
            <strong className="font-semibold text-slate-700">visit intent</strong>, not store
            visits.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Business profile impressions" total={PERF_SUMMARY.impressions} delta="+12%">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={HOURLY} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="4 4" stroke="#eef2f7" vertical={false} />
              <XAxis
                dataKey="t"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip contentStyle={tipStyle} cursor={{ fill: "rgba(99,102,241,0.05)" }} />
              <Bar dataKey="impressions" fill="url(#barIndigo)" radius={[8, 8, 4, 4]} maxBarSize={36} />
              <defs>
                <linearGradient id="barIndigo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Business profile interactions" total={PERF_SUMMARY.interactions} delta="+8%">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={HOURLY} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="4 4" stroke="#eef2f7" vertical={false} />
              <XAxis
                dataKey="t"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip contentStyle={tipStyle} cursor={{ fill: "rgba(129,140,248,0.05)" }} />
              <Bar dataKey="interactions" fill="url(#barSoft)" radius={[8, 8, 4, 4]} maxBarSize={36} />
              <defs>
                <linearGradient id="barSoft" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c4b5fd" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SparkCard
          title="Call-button clicks"
          value={PERF_SUMMARY.calls}
          color="#10b981"
          fillId="sparkGreen"
          dataKey="calls"
          caveat="Not answered calls or leads"
        />
        <SparkCard
          title="Direction requests"
          value={PERF_SUMMARY.directions}
          color="#f59e0b"
          fillId="sparkAmber"
          dataKey="directions"
          caveat="Visit intent — not store visits"
        />
        <SparkCard
          title="Website clicks"
          value={PERF_SUMMARY.websiteClicks}
          color="#0ea5e9"
          fillId="sparkSky"
          dataKey="website"
          caveat="Not form leads or transactions"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat
          label="Google Business Profile conversations"
          value={PERF_SUMMARY.messages}
          icon="💬"
        />
        <MiniStat
          label="Google Business Profile bookings"
          value={PERF_SUMMARY.bookings}
          icon="📅"
        />
        <MiniStat
          label="Google Business Profile food orders"
          value={PERF_SUMMARY.foodOrders}
          icon="🍽"
        />
      </div>
    </div>
  );
}

function DonutCard({
  title,
  total,
  totalLabel,
  data,
  colors = COLORS,
}: {
  title: string;
  total: number;
  totalLabel: string;
  data: { name: string; value: number }[];
  colors?: string[];
}) {
  return (
    <div className="an-card p-5 sm:p-6">
      <div className="an-label">{title}</div>
      <div className="mt-1 flex items-end gap-2">
        <span className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
          {total.toLocaleString()}
        </span>
        <span className="mb-1 text-xs font-medium text-slate-400">{totalLabel}</span>
      </div>
      <div className="relative mt-1 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={76}
              paddingAngle={3}
              stroke="none"
              cornerRadius={4}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
          <span className="text-lg font-semibold tabular-nums text-slate-900">
            {total.toLocaleString()}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            total
          </span>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-2">
        {data.map((d, i) => (
          <div
            key={d.name}
            className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-100"
          >
            <span
              className="h-2 w-2 rounded-full shadow-sm"
              style={{ background: colors[i % colors.length] }}
            />
            {d.name}
            <span className="tabular-nums text-slate-400">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  total,
  delta,
  children,
}: {
  title: string;
  total: number;
  delta?: string;
  children: ReactNode;
}) {
  return (
    <div className="an-card p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="an-label">{title}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
              {total.toLocaleString()}
            </div>
            {delta && (
              <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                {delta}
              </span>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function SparkCard({
  title,
  value,
  color,
  fillId,
  dataKey,
  caveat,
}: {
  title: string;
  value: number;
  color: string;
  fillId: string;
  dataKey: "calls" | "directions" | "website";
  caveat: string;
}) {
  return (
    <div className="an-card group overflow-hidden p-5 transition hover:shadow-[var(--shadow-md)]">
      <div className="flex items-start justify-between gap-2">
        <div className="an-label">{title}</div>
        <span
          className="h-2 w-2 rounded-full shadow-sm"
          style={{ background: color, boxShadow: `0 0 0 3px ${color}22` }}
        />
      </div>
      <div className="mt-1 text-[1.7rem] font-semibold tabular-nums tracking-tight text-slate-900">
        {value.toLocaleString()}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-400">{caveat}</p>
      <div className="mt-3 -mx-1 h-[76px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={HOURLY}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.25}
              fill={`url(#${fillId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="an-card flex items-center gap-3.5 px-5 py-4 transition hover:shadow-[var(--shadow-md)]">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-base shadow-inner ring-1 ring-slate-100">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="text-lg font-semibold tabular-nums text-slate-900">{value}</div>
      </div>
    </div>
  );
}
