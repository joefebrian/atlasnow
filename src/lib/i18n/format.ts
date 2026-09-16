/** Deterministic datetime display — never use host `toLocaleString()`. */

import { DEFAULT_LOCALE, type Locale } from "./locale";

export const DISPLAY_TIME_ZONE = "Asia/Jakarta";

const MONTH_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

function jakartaParts(date: Date): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
} {
  const bag = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: DISPLAY_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return {
    year: bag.year,
    month: bag.month,
    day: bag.day,
    hour: bag.hour,
    minute: bag.minute,
  };
}

export function formatDateTime(
  value: string | Date | null | undefined,
  locale: Locale = DEFAULT_LOCALE
): string {
  if (value == null || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "—";
  }

  const parts = jakartaParts(date);
  const months = locale === "id" ? MONTH_ID : MONTH_EN;
  const month = months[Number(parts.month) - 1];
  const timeSep = locale === "id" ? "." : ":";
  return `${Number(parts.day)} ${month} ${parts.year}, ${parts.hour}${timeSep}${parts.minute}`;
}
