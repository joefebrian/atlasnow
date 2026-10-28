/**
 * Meta WhatsApp Business Platform per-message rates in IDR.
 * Source: official to-be rate cards (effective 1 October 2026) uploaded by P2P Labs
 *   docs/meta/whatsapp-list-rates-2026-10-01.csv
 *   docs/meta/whatsapp-volume-tiers-2026-10-01.csv
 * The 1 October 2026 card is the current estimate source.
 * Recipient country sets the rate. Do not present one IDR figure as a Meta invoice.
 *
 * Service = utility/auth by market. First 1_000 service msgs / business phone /
 * month are Meta-free (no rollover). Click-to-WhatsApp free entry-point stays free.
 * VAT/PPN is not in the CSV — Indonesia invoices often add 11%. Shown as an estimate, not a Meta line.
 *
 * vs July 2026 card: Indonesia unchanged. Marketing up: Mexico, Saudi Arabia, UAE.
 * Utility/auth up: Pakistan, Peru, South Africa. Nine markets left Rest-Of
 * (Bangladesh, Iraq, Kazakhstan, Kuwait, Morocco, Nepal, Oman, Sri Lanka, Ukraine)
 * and gained authentication-international. Rest-of regions now listed explicitly.
 */

export type BroadcastKind = "session" | "marketing" | "utility" | "authentication";

export type MarketRates = {
  market: string;
  marketing: number;
  utility: number;
  authentication: number;
  authInternational: number | null;
  /** Same as utility on the Oct 1 card. Human / 3rd-party AI replies. */
  service: number;
};

export type AtlasFeeConfig = {
  session: number;
  marketing: number;
  utility: number;
  authentication: number;
  /** Percent of Meta’s per-message rate, added on top of the flat IDR. */
  marginPct: number;
};

/** Defaults until Settings → Broadcast pricing is saved. */
export const DEFAULT_ATLAS_FEES: AtlasFeeConfig = {
  session: 0,
  marketing: 150,
  utility: 90,
  authentication: 90,
  marginPct: 0,
};

export const PPN_RATE = 0.11;
export const RATE_CARD_EFFECTIVE = "1 October 2026";
export const RATE_CARD_CURRENCY = "IDR";
/** Meta’s gift — per Cloud phone number, refresh monthly, no rollover. */
export const SERVICE_FREE_PER_PHONE_PER_MONTH = 1_000;

/** Full card from the official Oct 1 2026 CSV (IDR, list rate). */
export const MARKET_RATES: MarketRates[] = [
  { market: "Argentina", marketing: 881.95, utility: 371.19, authentication: 371.19, authInternational: null, service: 371.19 },
  { market: "Bangladesh", marketing: 1044.97, utility: 52.81, authentication: 52.81, authInternational: 1370.08, service: 52.81 },
  { market: "Brazil", marketing: 891.98, utility: 97.05, authentication: 97.05, authInternational: null, service: 97.05 },
  { market: "Chile", marketing: 1268.36, utility: 285.34, authentication: 285.34, authInternational: null, service: 285.34 },
  { market: "Colombia", marketing: 178.4, utility: 11.4, authentication: 11.4, authInternational: null, service: 11.4 },
  { market: "Egypt", marketing: 918.92, utility: 51.38, authentication: 51.38, authInternational: 928.22, service: 51.38 },
  { market: "France", marketing: 1226.58, utility: 428.27, authentication: 428.27, authInternational: null, service: 428.27 },
  { market: "Germany", marketing: 1948.66, utility: 785.17, authentication: 785.17, authInternational: null, service: 785.17 },
  { market: "Hong Kong", marketing: 1044.97, utility: 371.06, authentication: 371.06, authInternational: null, service: 371.06 },
  { market: "Hungary", marketing: 1226.72, utility: 498.17, authentication: 498.17, authInternational: null, service: 498.17 },
  { market: "India", marketing: 168.05, utility: 19.97, authentication: 19.97, authInternational: 433.68, service: 19.97 },
  { market: "Indonesia", marketing: 586.33, utility: 356.65, authentication: 356.65, authInternational: 1940.13, service: 356.65 },
  { market: "Iraq", marketing: 486.68, utility: 112.67, authentication: 112.67, authInternational: 1825.48, service: 112.67 },
  { market: "Israel", marketing: 503.79, utility: 75.64, authentication: 75.64, authInternational: null, service: 75.64 },
  { market: "Italy", marketing: 1133.39, utility: 427.89, authentication: 427.89, authInternational: null, service: 427.89 },
  { market: "Kazakhstan", marketing: 861.62, utility: 256.77, authentication: 256.77, authInternational: 2282.39, service: 256.77 },
  { market: "Kuwait", marketing: 1130.56, utility: 627.51, authentication: 627.51, authInternational: 1711.38, service: 627.51 },
  { market: "Malaysia", marketing: 1227.49, utility: 199.82, authentication: 199.82, authInternational: 596.63, service: 199.82 },
  { market: "Mexico", marketing: 565.94, utility: 121.24, authentication: 121.24, authInternational: null, service: 121.24 },
  { market: "Morocco", marketing: 591.08, utility: 328.1, authentication: 328.1, authInternational: 1156.89, service: 328.1 },
  { market: "Netherlands", marketing: 2279.8, utility: 713.78, authentication: 713.78, authInternational: null, service: 713.78 },
  { market: "Nepal", marketing: 1044.97, utility: 48.52, authentication: 48.52, authInternational: 1598.43, service: 48.52 },
  { market: "Nigeria", marketing: 737.05, utility: 95.7, authentication: 95.7, authInternational: 1071.67, service: 95.7 },
  { market: "Oman", marketing: 486.68, utility: 352.26, authentication: 352.26, authInternational: 855.69, service: 352.26 },
  { market: "Pakistan", marketing: 675.37, utility: 214.17, authentication: 214.17, authInternational: 1071.67, service: 214.17 },
  { market: "Peru", marketing: 1003.55, utility: 428.25, authentication: 428.25, authInternational: null, service: 428.25 },
  { market: "Poland", marketing: 520.95, utility: 173.65, authentication: 173.65, authInternational: null, service: 173.65 },
  { market: "Qatar", marketing: 486.68, utility: 171.14, authentication: 171.14, authInternational: null, service: 171.14 },
  { market: "Romania", marketing: 1226.72, utility: 412.77, authentication: 412.77, authInternational: null, service: 412.77 },
  { market: "Russia", marketing: 1144.36, utility: 570.75, authentication: 570.75, authInternational: null, service: 570.75 },
  { market: "Saudi Arabia", marketing: 820.08, utility: 152.54, authentication: 152.54, authInternational: 854.24, service: 152.54 },
  { market: "Singapore", marketing: 1044.97, utility: 228.35, authentication: 228.35, authInternational: null, service: 228.35 },
  { market: "South Africa", marketing: 541.75, utility: 135.8, authentication: 135.8, authInternational: 285.89, service: 135.8 },
  { market: "Spain", marketing: 1008.68, utility: 285.24, authentication: 285.24, authInternational: null, service: 285.24 },
  { market: "Sri Lanka", marketing: 1044.97, utility: 28.54, authentication: 28.54, authInternational: 2055.12, service: 28.54 },
  { market: "Turkey", marketing: 155.56, utility: 12.84, authentication: 12.84, authInternational: null, service: 12.84 },
  { market: "Ukraine", marketing: 1226.72, utility: 424.16, authentication: 424.16, authInternational: 1061.82, service: 424.16 },
  { market: "United Arab Emirates", marketing: 820.08, utility: 224.11, authentication: 224.11, authInternational: 727.12, service: 224.11 },
  { market: "United Kingdom", marketing: 905.41, utility: 313.93, authentication: 313.93, authInternational: null, service: 313.93 },
  { market: "North America", marketing: 356.6, utility: 48.5, authentication: 48.5, authInternational: null, service: 48.5 },
  { market: "Rest of Africa", marketing: 321.24, utility: 57.06, authentication: 57.06, authInternational: null, service: 57.06 },
  { market: "Rest of Asia Pacific", marketing: 1201.72, utility: 161.27, authentication: 161.27, authInternational: null, service: 161.27 },
  { market: "Rest of Central & Eastern Europe", marketing: 1226.72, utility: 301.75, authentication: 301.75, authInternational: null, service: 301.75 },
  { market: "Rest of Latin America", marketing: 1055.54, utility: 161.18, authentication: 161.18, authInternational: null, service: 161.18 },
  { market: "Rest of Middle East", marketing: 559.68, utility: 129.78, authentication: 129.78, authInternational: null, service: 129.78 },
  { market: "Rest of Western Europe", marketing: 844.68, utility: 243.72, authentication: 243.72, authInternational: null, service: 243.72 },
  { market: "Other", marketing: 861.62, utility: 109.84, authentication: 109.84, authInternational: null, service: 109.84 },
];

export const INDONESIA = MARKET_RATES.find((m) => m.market === "Indonesia")!;

export function marketForPhone(phone: string): MarketRates {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("62") || d.startsWith("08")) return INDONESIA;
  return INDONESIA;
}

export function metaRateIdr(kind: BroadcastKind, market: MarketRates = INDONESIA): number {
  if (kind === "session") return market.service;
  if (kind === "marketing") return market.marketing;
  if (kind === "utility") return market.utility;
  return market.authentication;
}

export function roundIdr(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatIdr(n: number): string {
  return `Rp ${n.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export type CostEstimate = {
  kind: BroadcastKind;
  count: number;
  market: string;
  metaEach: number;
  atlasEach: number;
  metaSubtotal: number;
  ppnEstimate: number;
  atlasSubtotal: number;
  total: number;
  /** True only for Meta’s click-to-WhatsApp / Page-button free entry-point window. */
  windowFree: boolean;
};

export function atlasEachIdr(kind: BroadcastKind, metaEach: number, fees: AtlasFeeConfig): number {
  const flat = fees[kind] ?? 0;
  const pct = Number.isFinite(fees.marginPct) ? fees.marginPct : 0;
  return roundIdr(flat + (pct / 100) * metaEach);
}

export function estimateBroadcast(opts: {
  kind: BroadcastKind;
  count: number;
  /** @deprecated Oct 1 card bills utility/service inside the 24h window. Ignored. */
  insideWindow?: boolean;
  /** Click-to-WhatsApp ad / Facebook Page action button — Meta does not bill. */
  insideEntryPoint?: boolean;
  market?: MarketRates;
  fees?: AtlasFeeConfig;
}): CostEstimate {
  const market = opts.market || INDONESIA;
  const fees = opts.fees || DEFAULT_ATLAS_FEES;
  const count = Math.max(0, Math.floor(opts.count));
  const windowFree = opts.insideEntryPoint === true;
  const metaEach = windowFree ? 0 : metaRateIdr(opts.kind, market);
  const atlasEach = atlasEachIdr(opts.kind, metaEach, fees);
  const metaSubtotal = roundIdr(metaEach * count);
  const atlasSubtotal = roundIdr(atlasEach * count);
  const ppnEstimate = roundIdr(metaSubtotal * PPN_RATE);
  return {
    kind: opts.kind,
    count,
    market: market.market,
    metaEach,
    atlasEach,
    metaSubtotal,
    ppnEstimate,
    atlasSubtotal,
    total: roundIdr(metaSubtotal + ppnEstimate + atlasSubtotal),
    windowFree,
  };
}

export function publicRateSnapshot(fees: AtlasFeeConfig = DEFAULT_ATLAS_FEES) {
  return {
    effective: RATE_CARD_EFFECTIVE,
    currency: RATE_CARD_CURRENCY,
    indonesia: INDONESIA,
    atlasFee: fees,
    ppnRate: PPN_RATE,
    serviceFreePerPhonePerMonth: SERVICE_FREE_PER_PHONE_PER_MONTH,
  };
}
