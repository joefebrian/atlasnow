import { zonedLocalMidnight } from "@/lib/loyalty/rules";

export const DESK_TZ = "Asia/Jakarta";
const DAY = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MAX_DAYS = 366;

export type DeskRangeQuery = {
  from?: string;
  to?: string;
  compare?: string;
};

export type DeskRange = {
  from: string;
  to: string;
  compare: boolean;
  start: Date;
  endExclusive: Date;
  priorFrom: string;
  priorTo: string;
  priorStart: Date;
  priorEndExclusive: Date;
};

export function todayKey(now = new Date(), timeZone = DESK_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isDayKey(raw: string | null | undefined): raw is string {
  if (!raw || !DAY.test(raw)) return false;
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function utcDay(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function diffDaysInclusive(from: string, to: string): number {
  return Math.round((utcDay(to) - utcDay(from)) / 86_400_000) + 1;
}

export function previousEqualRange(from: string, to: string): { from: string; to: string } {
  const len = diffDaysInclusive(from, to);
  const priorTo = addDays(from, -1);
  return { from: addDays(priorTo, -(len - 1)), to: priorTo };
}

export function monthToDate(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

export function lastNDays(today: string, n: number): { from: string; to: string } {
  return { from: addDays(today, -(n - 1)), to: today };
}

function bounds(from: string, to: string, timeZone = DESK_TZ) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const start = zonedLocalMidnight(fy, fm, fd, timeZone);
  const next = addDays(to, 1);
  const [ey, em, ed] = next.split("-").map(Number);
  return { start, endExclusive: zonedLocalMidnight(ey, em, ed, timeZone) };
}

export function resolveDeskRange(query: DeskRangeQuery, now = new Date()): DeskRange {
  const today = todayKey(now);
  let from = isDayKey(query.from) ? query.from : monthToDate(today).from;
  let to = isDayKey(query.to) ? query.to : today;
  if (utcDay(from) > utcDay(to)) {
    const swap = from;
    from = to;
    to = swap;
  }
  if (utcDay(to) > utcDay(today)) to = today;
  if (utcDay(from) > utcDay(to)) from = to;
  if (diffDaysInclusive(from, to) > MAX_DAYS) {
    from = addDays(to, -(MAX_DAYS - 1));
  }
  const prior = previousEqualRange(from, to);
  const cur = bounds(from, to);
  const prev = bounds(prior.from, prior.to);
  return {
    from,
    to,
    compare: query.compare !== "0",
    start: cur.start,
    endExclusive: cur.endExclusive,
    priorFrom: prior.from,
    priorTo: prior.to,
    priorStart: prev.start,
    priorEndExclusive: prev.endExclusive,
  };
}

export function formatDayLabel(key: string, locale: "en" | "id"): string {
  if (!isDayKey(key)) return key;
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(y, m - 1, d));
}

export function formatRangeLabel(from: string, to: string, locale: "en" | "id"): string {
  if (from === to) return formatDayLabel(from, locale);
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const loc = locale === "id" ? "id-ID" : "en-GB";
  const start = Date.UTC(fy, fm - 1, Number(from.slice(8)));
  const end = Date.UTC(ty, tm - 1, Number(to.slice(8)));
  if (fy === ty && fm === tm) {
    const d1 = new Intl.DateTimeFormat(loc, { day: "numeric", timeZone: "UTC" }).format(start);
    const rest = new Intl.DateTimeFormat(loc, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(end);
    return `${d1}–${rest}`;
  }
  return `${formatDayLabel(from, locale)} – ${formatDayLabel(to, locale)}`;
}

export function formatDelta(current: number, prior: number): { delta: string; deltaUp: boolean } {
  const diff = current - prior;
  if (diff === 0) return { delta: "0", deltaUp: true };
  if (prior === 0) return { delta: `${diff > 0 ? "+" : ""}${diff}`, deltaUp: diff > 0 };
  const pct = Math.round((diff / prior) * 100);
  return { delta: `${pct > 0 ? "+" : ""}${pct}%`, deltaUp: diff > 0 };
}
