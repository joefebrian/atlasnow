import { prisma } from "@/lib/db";
import {
  getGbpMetricDef,
  LOCATION_VISIBILITY_PRIMARY_KEYS,
  sourceBadge,
  type GbpMetricDef,
} from "@/lib/metrics/gbp-dictionary";

export type MetricValueState =
  | { kind: "value"; value: number }
  | { kind: "NO_DATA" }
  | { kind: "THRESHOLD"; threshold?: number; message?: string }
  | { kind: "ERROR"; message?: string };

export type MetricCardView = {
  metricKey: string;
  uiLabel: string;
  interpretation: string;
  forbidden: string;
  caveat: string;
  sourceSystem: string;
  sourceBadge: string;
  grain: string;
  timezone: string;
  periodStart: string;
  periodEnd: string;
  comparison: string;
  scope: string;
  coverageLabel: string;
  freshness: "FRESH" | "STALE" | "UNKNOWN" | "MISSING";
  lastSyncAt: string | null;
  display: string;
  state: MetricValueState;
  why: {
    sourceMetric: string;
    formula: string;
    caveat: string;
    forbidden: string;
  };
};

function parseValueJson(raw: string): MetricValueState {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o.status === "NO_DATA") return { kind: "NO_DATA" };
    if (o.status === "THRESHOLD") {
      return {
        kind: "THRESHOLD",
        threshold: typeof o.threshold === "number" ? o.threshold : undefined,
        message: typeof o.message === "string" ? o.message : undefined,
      };
    }
    if (o.status === "ERROR") {
      return {
        kind: "ERROR",
        message: typeof o.message === "string" ? o.message : undefined,
      };
    }
    if (typeof o.value === "number" && Number.isFinite(o.value)) {
      return { kind: "value", value: o.value };
    }
  } catch {
    /* fallthrough */
  }
  return { kind: "NO_DATA" };
}

function formatDisplay(state: MetricValueState): string {
  switch (state.kind) {
    case "value":
      return state.value.toLocaleString("en-US");
    case "NO_DATA":
      return "No data";
    case "THRESHOLD":
      return state.threshold != null ? `< ${state.threshold}` : "< threshold";
    case "ERROR":
      return "Error";
    default:
      return "No data";
  }
}

function dayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return dayUtc(x);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function sumMetricForLocation(
  locationId: string,
  metricKey: string,
  periodStart: Date,
  periodEnd: Date,
  sourceSystem = "GBP_PERFORMANCE"
): Promise<{
  state: MetricValueState;
  daysWithData: number;
  lastObservedOn: Date | null;
  lastSyncAt: Date | null;
}> {
  const rows = await prisma.metricObservation.findMany({
    where: {
      locationId,
      metricKey,
      sourceSystem,
      observedOn: { gte: periodStart, lte: periodEnd },
    },
    orderBy: { observedOn: "desc" },
  });

  if (rows.length === 0) {
    return {
      state: { kind: "NO_DATA" },
      daysWithData: 0,
      lastObservedOn: null,
      lastSyncAt: null,
    };
  }

  let sum = 0;
  let hasNumeric = false;
  let thresholdOnly = true;
  let errorMsg: string | undefined;

  for (const row of rows) {
    const st = parseValueJson(row.valueJson);
    if (st.kind === "value") {
      sum += st.value;
      hasNumeric = true;
      thresholdOnly = false;
    } else if (st.kind === "THRESHOLD") {
      /* keep threshold if no numeric */
    } else if (st.kind === "ERROR") {
      errorMsg = st.message;
    } else if (st.kind === "NO_DATA") {
      /* skip */
    }
  }

  let state: MetricValueState;
  if (hasNumeric) state = { kind: "value", value: sum };
  else if (thresholdOnly && rows.some((r) => parseValueJson(r.valueJson).kind === "THRESHOLD")) {
    state = { kind: "THRESHOLD", message: "Privacy threshold for some days" };
  } else if (errorMsg) state = { kind: "ERROR", message: errorMsg };
  else state = { kind: "NO_DATA" };

  return {
    state,
    daysWithData: rows.filter((r) => parseValueJson(r.valueJson).kind === "value").length,
    lastObservedOn: rows[0]?.observedOn ?? null,
    lastSyncAt: rows[0]?.updatedAt ?? null,
  };
}

function freshnessFromLastSync(last: Date | null): MetricCardView["freshness"] {
  if (!last) return "MISSING";
  const ageH = (Date.now() - last.getTime()) / 3_600_000;
  if (ageH <= 48) return "FRESH";
  if (ageH <= 24 * 14) return "STALE";
  return "STALE";
}

export async function buildLocationMetricCards(
  location: {
    id: string;
    name: string;
    timezone: string;
    atlasLocationId: string;
  },
  opts?: { days?: number }
): Promise<{
  periodStart: string;
  periodEnd: string;
  timezone: string;
  cards: MetricCardView[];
  hasAnyData: boolean;
}> {
  const days = opts?.days ?? 28;
  const end = dayUtc(new Date());
  const start = addDays(end, -(days - 1));
  const periodStart = isoDay(start);
  const periodEnd = isoDay(end);
  const scope = `${location.name} · ${location.atlasLocationId}`;

  const cards: MetricCardView[] = [];
  let hasAnyData = false;

  for (const key of LOCATION_VISIBILITY_PRIMARY_KEYS) {
    const def = getGbpMetricDef(key) as GbpMetricDef;
    const agg = await sumMetricForLocation(location.id, key, start, end);
    if (agg.state.kind === "value") hasAnyData = true;

    const freshness =
      agg.state.kind === "NO_DATA" ? "MISSING" : freshnessFromLastSync(agg.lastSyncAt);

    cards.push({
      metricKey: def.metricKey,
      uiLabel: def.uiLabel,
      interpretation: def.interpretation,
      forbidden: def.forbidden,
      caveat: def.caveat,
      sourceSystem: def.sourceSystem,
      sourceBadge: sourceBadge(def.sourceSystem),
      grain: def.grain,
      timezone: location.timezone || "Asia/Jakarta",
      periodStart,
      periodEnd,
      comparison: `Sum of daily values · last ${days} days`,
      scope,
      coverageLabel:
        agg.daysWithData > 0
          ? `${agg.daysWithData}/${days} days with data`
          : `0/${days} days with data`,
      freshness,
      lastSyncAt: agg.lastSyncAt?.toISOString() ?? null,
      display: formatDisplay(agg.state),
      state: agg.state,
      why: {
        sourceMetric: def.metricKey,
        formula: "sum(daily_value)",
        caveat: def.caveat,
        forbidden: def.forbidden,
      },
    });
  }

  return {
    periodStart,
    periodEnd,
    timezone: location.timezone || "Asia/Jakarta",
    cards,
    hasAnyData,
  };
}

export async function portfolioLocationStats(
  tenantId: string | null,
  isAgency: boolean,
  agencyId?: string | null
) {
  const where = isAgency
    ? {
        status: { not: "ARCHIVED" as const },
        tenant: { type: "CLIENT" as const, agencyId: agencyId || tenantId },
      }
    : { status: { not: "ARCHIVED" as const }, tenantId: tenantId! };

  const [total, ready, partial, blocked, mappedGbp] = await Promise.all([
    prisma.location.count({ where }),
    prisma.location.count({ where: { ...where, readiness: "READY" } }),
    prisma.location.count({
      where: { ...where, readiness: { in: ["PARTIAL", "DRAFT"] } },
    }),
    prisma.location.count({ where: { ...where, readiness: "BLOCKED" } }),
    prisma.sourceMapping.count({
      where: {
        sourceType: "GOOGLE_BUSINESS_PROFILE",
        status: "ACTIVE",
        location: where,
      },
    }),
  ]);

  const needingAction = await prisma.location.count({
    where: {
      ...where,
      OR: [{ readiness: "BLOCKED" }, { readiness: "PARTIAL" }, { readiness: "DRAFT" }],
    },
  });

  return {
    total,
    ready,
    partial,
    blocked,
    mappedGbp,
    needingAction,
  };
}
