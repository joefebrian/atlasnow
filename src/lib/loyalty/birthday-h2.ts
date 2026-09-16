import { randomBytes } from "node:crypto";
import { BIRTHDAY_TEMPLATE_NAME, normalizeBirthdayVoucherStyle, type BirthdayVoucherStyle } from "./birthday-template";
export {
  BIRTHDAY_NAMED_EXAMPLES,
  BIRTHDAY_TEMPLATE_BODY_ID,
  BIRTHDAY_TEMPLATE_NAME,
  DEFAULT_BIRTHDAY_VOUCHER_STYLE,
  normalizeBirthdayVoucherStyle,
  previewBirthdayVoucherCode,
  type BirthdayVoucherStyle,
} from "./birthday-template";

/** Catch-up: H-2, H-1, and the birthday (once). Missed midnight still delivers once. */
export const BIRTHDAY_H2_MAX_DAYS_AHEAD = 2;

export function daysUntilNextBirthday(opts: {
  month: number;
  day: number;
  now?: Date;
  timeZone?: string;
}): number {
  const timeZone = opts.timeZone || "Asia/Jakarta";
  const t = calendarYmd(opts.now ?? new Date(), timeZone);
  const today = Date.UTC(t.y, t.m - 1, t.d) / 86400000;
  let b = Date.UTC(t.y, opts.month - 1, opts.day) / 86400000;
  if (b < today) b = Date.UTC(t.y + 1, opts.month - 1, opts.day) / 86400000;
  return b - today;
}

export function inBirthdayH2SendWindow(daysUntil: number): boolean {
  return daysUntil >= 0 && daysUntil <= BIRTHDAY_H2_MAX_DAYS_AHEAD;
}

function calendarYmd(now: Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const num = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: num("year"), m: num("month"), d: num("day") };
}

export function firstNameOf(name: string): string {
  const t = name.trim();
  return t.split(/\s+/)[0] || t || "Kak";
}

const NAMED_RE = /\{\{([a-z][a-z0-9_]*)\}\}/gi;
const POS_RE = /\{\{(\d+)\}\}/g;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function namedPlaceholders(bodyText: string): string[] {
  NAMED_RE.lastIndex = 0;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of bodyText.matchAll(NAMED_RE)) {
    const k = m[1].toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function makeBirthdayVoucherCode(
  periodKey: string,
  style?: Partial<BirthdayVoucherStyle> | null
): string {
  const s = normalizeBirthdayVoucherStyle(style);
  const yy = String(periodKey).slice(-2).padStart(2, "0");
  let tail = "";
  const bytes = randomBytes(s.suffixLen);
  for (let i = 0; i < s.suffixLen; i++) tail += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return s.includeYear ? `${s.prefix}${yy}-${tail}` : `${s.prefix}-${tail}`;
}

export function canonVoucherCode(raw: string): string {
  return (raw || "").trim().toUpperCase().replace(/[\s\-_.]/g, "");
}

export function voucherCodesMatch(issued: string, typed: string): boolean {
  const a = canonVoucherCode(issued);
  const b = canonVoucherCode(typed);
  return a.length >= 4 && a === b;
}

export type BirthdayFillBag = {
  customerName: string;
  voucherNumber: string;
  codeVoucher: string;
};

export type BirthdayFillOk = {
  ok: true;
  positional: string[];
  named: { name: string; text: string }[];
};

/** Named {{customer_name}} / {{voucher_number}} / {{code_voucher}}, or positional {{1}}{{2}}{{3}}. */
export function fillBirthdayTemplateBody(
  bodyText: string,
  bag: BirthdayFillBag
): BirthdayFillOk | { ok: false; reason: "template_vars" } {
  const named = namedPlaceholders(bodyText);
  const values: Record<string, string> = {
    customer_name: bag.customerName.trim(),
    first_name: firstNameOf(bag.customerName),
    voucher_number: bag.voucherNumber.trim(),
    voucher_value: bag.voucherNumber.trim(),
    code_voucher: bag.codeVoucher.trim(),
    voucher_code: bag.codeVoucher.trim(),
  };
  if (named.length) {
    const params: { name: string; text: string }[] = [];
    for (const name of named) {
      const text = values[name] || "";
      if (!text) return { ok: false, reason: "template_vars" };
      params.push({ name, text: text.slice(0, 1024) });
    }
    return { ok: true, positional: [], named: params };
  }
  POS_RE.lastIndex = 0;
  const idxs = [...bodyText.matchAll(POS_RE)].map((m) => Number(m[1]));
  if (!idxs.length) return { ok: true, positional: [], named: [] };
  const max = Math.max(...idxs);
  const pool = [bag.customerName.trim(), bag.voucherNumber.trim(), bag.codeVoucher.trim()];
  const positional: string[] = [];
  for (let i = 1; i <= max; i++) {
    const needed = bodyText.includes(`{{${i}}}`);
    const v = pool[i - 1] || "";
    if (needed && !v) return { ok: false, reason: "template_vars" };
    positional.push(v || " ");
  }
  return { ok: true, positional, named: [] };
}

/** @deprecated positional helper — use fillBirthdayTemplateBody */
export function fillBirthdayTemplateParams(opts: {
  bodyText: string;
  name: string;
  brand: string;
  reward: string;
}): { ok: true; params: string[] } | { ok: false; reason: "template_vars" } {
  const filled = fillBirthdayTemplateBody(opts.bodyText, {
    customerName: opts.name,
    voucherNumber: opts.reward,
    codeVoucher: opts.brand,
  });
  if (!filled.ok) return filled;
  return { ok: true, params: filled.positional };
}

export function isWaOptOutMessage(raw: string): boolean {
  const s = (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[.!,]+$/g, "")
    .trim();
  return s === "stop" || s === "berhenti" || s === "unsubscribe" || s === "stopall";
}

export function isWaOptInResumeMessage(raw: string): boolean {
  const s = (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[.!,]+$/g, "")
    .trim();
  return s === "mulai" || s === "start";
}

export const WA_OPT_OUT_REPLY =
  "Oke. Catatan ultah ke nomor ini kami hentikan. Balas MULAI kalau mau nyala lagi.";
export const WA_OPT_IN_RESUME_REPLY = "Oke. Catatan ultah bisa dikirim lagi ke nomor ini.";

export function pickBirthdayGreeting<T extends { name: string; status: string; language: string }>(
  templates: T[]
): T | null {
  const rows = templates.filter((t) => t.name === BIRTHDAY_TEMPLATE_NAME && t.status === "APPROVED");
  return rows.find((t) => t.language.toLowerCase().startsWith("id")) || rows[0] || null;
}
