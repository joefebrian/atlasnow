import { canonPhone } from "@/lib/conversations/identity";

export type StampExpiry = "lifetime" | "years_1" | "years_2";

export function monthPeriodKey(now: Date, timeZone = "Asia/Jakarta"): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parseMonthKey(raw: string | null | undefined, fallback: string): string {
  const v = (raw || "").trim();
  return MONTH_KEY.test(v) ? v : fallback;
}

export function shiftMonthKey(periodKey: string, delta: number): string {
  const m = periodKey.match(MONTH_KEY);
  if (!m) return periodKey;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Local midnight of `year-month-day` in `timeZone`, as a UTC Date. */
export function zonedLocalMidnight(year: number, month: number, day: number, timeZone = "Asia/Jakarta"): Date {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(new Date(guess));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(guess - (asIfUtc - guess));
}

export function monthBounds(periodKey: string, timeZone = "Asia/Jakarta"): { start: Date; endExclusive: Date } {
  const m = periodKey.match(MONTH_KEY);
  const y = m ? Number(m[1]) : 1970;
  const month = m ? Number(m[2]) : 1;
  const start = zonedLocalMidnight(y, month, 1, timeZone);
  const nextY = month === 12 ? y + 1 : y;
  const nextM = month === 12 ? 1 : month + 1;
  return { start, endExclusive: zonedLocalMidnight(nextY, nextM, 1, timeZone) };
}

export function formatMonthLabel(periodKey: string, locale: "en" | "id" = "en"): string {
  const m = periodKey.match(MONTH_KEY);
  if (!m) return periodKey;
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
}

/** Live card: Status Stamp / Cek Stamp. Bare "Stamp" is the program menu, not the card. */
const STAMP_STATUS_QUERY = /^(status\s*stamp|cek\s*stamp|kartu\s*stamp|cek\s*kartu\s*stamp)$/i;
const STAMP_MENU_QUERY = /^(stamp|menu\s*stamp|info\s*stamp|bantuan\s*stamp|poin\s*stamp)$/i;

export function isStampStatusQuery(body: string): boolean {
  return STAMP_STATUS_QUERY.test((body || "").trim());
}

export function isStampMenuQuery(body: string): boolean {
  return STAMP_MENU_QUERY.test((body || "").trim());
}

export function addYears(from: Date, years: number): Date {
  const d = new Date(from.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

export function stampMeetsMin(amount: number | null | undefined, minAmount: number): boolean {
  if (!minAmount || minAmount <= 0) return true;
  return (amount ?? 0) >= minAmount;
}

export function currentCardStamps<T extends { stampedAt: Date }>(opts: {
  stamps: T[];
  lastStampRedeemAt: Date | null;
  expiry: StampExpiry;
  now?: Date;
}): { stamps: T[]; startedAt: Date | null; expired: boolean } {
  const now = opts.now ?? new Date();
  const afterRedeem = opts.lastStampRedeemAt
    ? opts.stamps.filter((s) => s.stampedAt > opts.lastStampRedeemAt!)
    : opts.stamps.slice();
  afterRedeem.sort((a, b) => a.stampedAt.getTime() - b.stampedAt.getTime());
  const startedAt = afterRedeem[0]?.stampedAt ?? null;
  if (!startedAt) return { stamps: [], startedAt: null, expired: false };
  let expiresAt: Date | null = null;
  if (opts.expiry === "years_1") expiresAt = addYears(startedAt, 1);
  if (opts.expiry === "years_2") expiresAt = addYears(startedAt, 2);
  if (expiresAt && now > expiresAt) {
    return { stamps: [], startedAt, expired: true };
  }
  return { stamps: afterRedeem, startedAt, expired: false };
}

export function staffPhoneBlocked(memberPhone: string, staffPhones: string[]): boolean {
  const m = canonPhone(memberPhone);
  return staffPhones.some((s) => canonPhone(s) === m && m.length >= 8);
}

export function isConfirmedOutletSender(opts: {
  senderPhone: string;
  waOutletPhone: string | null | undefined;
  waOutletConfirmed: boolean;
}): boolean {
  if (!opts.waOutletConfirmed || !opts.waOutletPhone) return false;
  return canonPhone(opts.senderPhone) === canonPhone(opts.waOutletPhone);
}

export type StampTier = { stamps: number; reward: string };
export type SpenderTier = { rank: number; reward: string };
export type StampTierState = StampTier & {
  reached: boolean;
  claimed: boolean;
  canRedeem: boolean;
  isHighest: boolean;
};

function asInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

function parseUnknownArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeStampTiers(
  json: unknown,
  fallback?: { goal?: number; reward?: string }
): StampTier[] {
  const map = new Map<number, string>();
  for (const row of parseUnknownArray(json)) {
    if (!row || typeof row !== "object") continue;
    const r = row as { stamps?: unknown; reward?: unknown };
    const stamps = asInt(r.stamps);
    if (stamps == null || stamps < 1 || stamps > 100) continue;
    map.set(stamps, typeof r.reward === "string" ? r.reward.trim() : "");
  }
  if (map.size === 0 && fallback?.goal && fallback.goal >= 1) {
    map.set(Math.min(100, Math.floor(fallback.goal)), (fallback.reward || "").trim());
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, 8)
    .map(([stamps, reward]) => ({ stamps, reward }));
}

export function stampCardGoal(tiers: StampTier[]): number {
  return tiers.length ? tiers[tiers.length - 1].stamps : 0;
}

export function stampTierStates(opts: {
  count: number;
  tiers: StampTier[];
  claimedKeys: Iterable<string>;
}): StampTierState[] {
  const claimed = new Set([...opts.claimedKeys].map(String));
  const max = stampCardGoal(opts.tiers);
  return opts.tiers.map((t) => {
    const reached = opts.count >= t.stamps;
    const isClaimed = claimed.has(String(t.stamps));
    return {
      ...t,
      reached,
      claimed: isClaimed,
      canRedeem: reached && !isClaimed,
      isHighest: t.stamps === max && max > 0,
    };
  });
}

export function lastCardResetAt(
  redemptions: { redeemedAt: Date; resetsCard: boolean }[]
): Date | null {
  let latest: Date | null = null;
  for (const r of redemptions) {
    if (!r.resetsCard) continue;
    if (!latest || r.redeemedAt > latest) latest = r.redeemedAt;
  }
  return latest;
}

export function normalizeSpenderTiers(
  json: unknown,
  fallback?: { topN?: number; reward?: string }
): SpenderTier[] {
  const map = new Map<number, string>();
  for (const row of parseUnknownArray(json)) {
    if (!row || typeof row !== "object") continue;
    const r = row as { rank?: unknown; reward?: unknown };
    const rank = asInt(r.rank);
    if (rank == null || rank < 1 || rank > 20) continue;
    map.set(rank, typeof r.reward === "string" ? r.reward.trim() : "");
  }
  if (map.size === 0) {
    const n = Math.max(0, Math.min(20, Math.floor(fallback?.topN || 0)));
    const reward = (fallback?.reward || "").trim();
    for (let i = 1; i <= n; i++) map.set(i, reward);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, 8)
    .map(([rank, reward]) => ({ rank, reward }));
}

export function spenderTopN(tiers: SpenderTier[]): number {
  return tiers.length ? Math.max(...tiers.map((t) => t.rank)) : 0;
}

export function spenderRewardForRank(rank: number | null, tiers: SpenderTier[]): string | null {
  if (rank == null) return null;
  const row = tiers.find((t) => t.rank === rank);
  return row ? row.reward : null;
}

export type MemberLifecycle = "none" | "calon" | "aktif";

export function memberLifecycle(opts: { registered: boolean; qualifyingApprovedCount: number }): MemberLifecycle {
  if (!opts.registered) return "none";
  if (opts.qualifyingApprovedCount >= 1) return "aktif";
  return "calon";
}

export function receiptAllowed(life: MemberLifecycle): boolean {
  return life === "calon" || life === "aktif";
}

export function redeemAllowed(life: MemberLifecycle): boolean {
  return life === "aktif";
}

export function birthdayWaAllowed(life: MemberLifecycle, optIn: boolean): boolean {
  return life === "aktif" && optIn;
}

function calendarYmd(now: Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(
    now
  );
  const num = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: num("year"), m: num("month"), d: num("day") };
}

export function inBirthdayWindow(opts: {
  month: number;
  day: number;
  now?: Date;
  timeZone?: string;
  daysBefore?: number;
  daysAfter?: number;
}): boolean {
  const timeZone = opts.timeZone || "Asia/Jakarta";
  const daysBefore = opts.daysBefore ?? 2;
  const daysAfter = opts.daysAfter ?? 7;
  const t = calendarYmd(opts.now ?? new Date(), timeZone);
  const today = Date.UTC(t.y, t.m - 1, t.d) / 86400000;
  for (const y of [t.y - 1, t.y, t.y + 1]) {
    const b = Date.UTC(y, opts.month - 1, opts.day) / 86400000;
    const delta = today - b;
    if (delta >= -daysBefore && delta <= daysAfter) return true;
  }
  return false;
}

export function birthdayPeriodKey(now = new Date(), timeZone = "Asia/Jakarta"): string {
  return String(calendarYmd(now, timeZone).y);
}

export function parseBirthDate(raw: string): { month: number; day: number; iso: string } | null {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1920 || year > 2018 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day, iso: `${m[1]}-${m[2]}-${m[3]}` };
}

/** HQ Cloud API auto-replies. Brand edits these in Settings → Loyalty. Empty = default. */
export const DEFAULT_WA_REPLIES = {
  stampMenu:
    "Ketik:\n• Stamp — poin program (pesan ini)\n• Status Stamp — cek kartu & hadiah kamu\n\nPoin:\n1. Belum member / program: {stamp_off}\n2. Kartu kedaluwarsa: {stamp_expired}\n3. Sedang mengumpulkan: ketik Status Stamp\n4. Hadiah siap: ketik Status Stamp, tunjuk kasir\n5. Kartu penuh: ketik Status Stamp\n\nKasir yang Redeem di toko.",
  stampOff:
    "Kartu stamp belum diaktifkan untuk merek ini. Tim kami baca chat Anda di inbox.",
  stampExpired: "Kartu stamp kedaluwarsa. Transaksi berikutnya memulai kartu baru.",
  stampProgress:
    "Stamp Anda {count}/{goal}{min}. Berikutnya {next_stamps} stamp: {next_reward}. Tunjukkan chat ini ke kasir.{kasir}",
  stampClaim:
    "Kartu {count}/{goal}. Bisa ditukar: {gifts}. Tunjukkan chat ini ke kasir.{hint}{kasir}",
  stampDone: "Stamp Anda {count}/{goal}{min}. Tunjukkan chat ini ke kasir.{kasir}",
} as const;

export type WaReplyKey = keyof typeof DEFAULT_WA_REPLIES;
export type WaReplyCopy = Record<WaReplyKey, string>;

const WA_REPLY_MAX = 600;

export function parseWaReplies(raw: unknown): WaReplyCopy {
  let o: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      o = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      o = {};
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    o = raw as Record<string, unknown>;
  }
  const out: WaReplyCopy = { ...DEFAULT_WA_REPLIES };
  for (const key of Object.keys(DEFAULT_WA_REPLIES) as WaReplyKey[]) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, WA_REPLY_MAX);
  }
  return out;
}

export function fillWaReply(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z_]+)\}/gi, (_, name: string) => vars[name] ?? "");
}

export function formatStampStatusReply(
  st: {
    enabled: boolean;
    expired: boolean;
    count: number;
    goal: number;
    minAmount: number;
    tiers: StampTierState[];
  },
  copy?: Partial<WaReplyCopy>
): string {
  const t = parseWaReplies(copy || {});
  if (!st.enabled) return t.stampOff;
  if (st.expired) return t.stampExpired;
  const claimable = st.tiers.filter((tier) => tier.canRedeem);
  const next = st.tiers.find((tier) => !tier.reached);
  const min = st.minAmount ? ` (min belanja Rp ${st.minAmount.toLocaleString("id-ID")})` : "";
  const kasir = " Kasir juga bisa ketik nomor HP di menu Loyalty.";
  const vars = {
    count: String(st.count),
    goal: String(st.goal),
    min,
    kasir,
    next_stamps: next ? String(next.stamps) : "",
    next_reward: next?.reward || "lihat kasir",
    gifts: claimable.map((tier) => `${tier.stamps} stamp (${tier.reward || "lihat kasir"})`).join(", "),
    hint: claimable.length > 1 ? " Tukar dari yang kecil dulu." : "",
  };
  if (claimable.length) return fillWaReply(t.stampClaim, vars);
  if (next) return fillWaReply(t.stampProgress, vars);
  return fillWaReply(t.stampDone, vars);
}

/** Bare "Stamp" — program points / menu, not the live card. */
export function formatStampMenuReply(copy?: Partial<WaReplyCopy>): string {
  const t = parseWaReplies(copy || {});
  return fillWaReply(t.stampMenu, {
    stamp_off: t.stampOff,
    stamp_expired: t.stampExpired,
  });
}
