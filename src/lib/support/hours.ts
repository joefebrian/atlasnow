export const SUPPORT_TZ = "Asia/Jakarta";
export const DEFAULT_OPEN_HM = "09:00";
export const DEFAULT_CLOSE_HM = "17:00";
export const DEFAULT_DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 7];

export type SupportHours = {
  enabled: boolean;
  openHm: string;
  closeHm: string;
  daysOfWeek: number[];
};

export const DEFAULT_SUPPORT_HOURS: SupportHours = {
  enabled: true,
  openHm: DEFAULT_OPEN_HM,
  closeHm: DEFAULT_CLOSE_HM,
  daysOfWeek: [...DEFAULT_DAYS_OF_WEEK],
};

const WEEKDAY_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function parseHm(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec((hm || "").trim());
  if (!m) return 0;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return h * 60 + min;
}

export function formatHm(minuteOfDay: number): string {
  const m = Math.min(24 * 60, Math.max(0, Math.floor(minuteOfDay)));
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function parseDaysOfWeek(raw: string | null | undefined): number[] {
  const nums = String(raw || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => n >= 1 && n <= 7);
  return nums.length ? [...new Set(nums)].sort((a, b) => a - b) : [];
}

export function serializeDaysOfWeek(days: number[]): string {
  return [...new Set(days.filter((n) => n >= 1 && n <= 7))].sort((a, b) => a - b).join(",");
}

export function jakartaClock(now: Date): { minuteOfDay: number; isoWeekday: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SUPPORT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  const wd = parts.find((p) => p.type === "weekday")?.value || "Mon";
  return {
    minuteOfDay: hour * 60 + minute,
    isoWeekday: WEEKDAY_ISO[wd] || 1,
  };
}

export function isSupportDeskOpen(hours: SupportHours, now: Date = new Date()): boolean {
  if (!hours.enabled) return false;
  if (!hours.daysOfWeek.length) return false;
  const { minuteOfDay, isoWeekday } = jakartaClock(now);
  if (!hours.daysOfWeek.includes(isoWeekday)) return false;
  const open = parseHm(hours.openHm);
  const close = parseHm(hours.closeHm);
  if (close <= open) return minuteOfDay >= open || minuteOfDay < close;
  return minuteOfDay >= open && minuteOfDay < close;
}

export function hoursFromRow(row: {
  enabled: boolean;
  openHm: string;
  closeHm: string;
  daysOfWeek: string;
}): SupportHours {
  return {
    enabled: row.enabled,
    openHm: row.openHm || DEFAULT_OPEN_HM,
    closeHm: row.closeHm || DEFAULT_CLOSE_HM,
    daysOfWeek: parseDaysOfWeek(row.daysOfWeek),
  };
}
