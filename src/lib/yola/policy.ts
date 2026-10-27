import { PRODUCT, TIME_SLOTS, presaleOpen, visitDateOk } from "@/lib/yola/catalog";

const YOLA_PHRASES = [
  "beli tiket yola",
  "kartu presale",
  "promo yola",
  "booking yola",
  "yola fun",
] as const;

const AMBIGUOUS = ["tiket", "promo", "booking", "presale"] as const;
const OPT_OUT = ["berhenti", "stop", "unsubscribe"] as const;

export type Intent = "yola" | "opt_out" | "ambiguous" | "unrelated";

export function classifyIntent(body: string): Intent {
  const text = body.toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return "unrelated";
  if (OPT_OUT.some((word) => text === word || text.includes(word))) return "opt_out";
  if (YOLA_PHRASES.some((phrase) => text.includes(phrase)) || /\byola\b/.test(text)) return "yola";
  if (AMBIGUOUS.some((word) => text.includes(word))) return "ambiguous";
  return "unrelated";
}

export type Referral = {
  sourceType: string;
  sourceId: string;
  sourceUrl: string;
  headline: string;
  ctwaClid: string;
};

export function sourceFromReferral(referral: Referral | null, intent: Intent): string {
  if (!referral) return intent === "yola" ? "direct" : "none";
  const url = referral.sourceUrl.toLowerCase();
  if (referral.sourceType === "ad") return "ctwa";
  if (url.includes("instagram")) return "instagram";
  if (url.includes("facebook") || url.includes("fb.com")) return "facebook";
  if (url.includes("wa.me") || url.includes("api.whatsapp.com")) return "website";
  return "direct";
}

/** Campaign ids are stored only when the operator listed them. Never invent one. */
export function referralMatchesCampaign(referral: Referral | null): boolean {
  if (!referral?.sourceId) return false;
  const allowed = (process.env.YOLA_CTWA_SOURCE_IDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(referral.sourceId);
}

export function toE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 13) return `+62${digits.slice(1)}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function phonesDiffer(waId: string, e164: string) {
  return waId.replace(/\D/g, "") !== e164.replace(/\D/g, "");
}

/** Published Flow dropdown ids. The stored visit time is always HH:MM. */
const FLOW_SLOT_TIMES = {
  SLOT_1000: "10:00",
  SLOT_1200: "12:00",
  SLOT_1400: "14:00",
  SLOT_1600: "16:00",
} as const;

/**
 * Accept the published Flow slot id or the legacy HH:MM value.
 * Any other identifier is rejected. The Flow JSON is not changed.
 */
export function normalizeVisitTime(value: string): (typeof TIME_SLOTS)[number] | null {
  const raw = value.trim();
  if ((TIME_SLOTS as readonly string[]).includes(raw)) return raw as (typeof TIME_SLOTS)[number];
  if (Object.prototype.hasOwnProperty.call(FLOW_SLOT_TIMES, raw)) {
    return FLOW_SLOT_TIMES[raw as keyof typeof FLOW_SLOT_TIMES];
  }
  return null;
}

export function visitChoiceOk(date: string, time: string) {
  return visitDateOk(date) && (TIME_SLOTS as readonly string[]).includes(time);
}

export function presaleStillOpen(now: Date) {
  return presaleOpen(now);
}

export function jakartaDay(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function insideServiceWindow(sentAt: string, now: Date) {
  const sec = Number(sentAt);
  if (!Number.isFinite(sec) || sec <= 0) return false;
  const age = now.getTime() - sec * 1000;
  return age <= 24 * 60 * 60 * 1000;
}

export const OFFER = {
  amountIdr: PRODUCT.priceIdr,
  currency: PRODUCT.currency,
  name: PRODUCT.name,
  venue: PRODUCT.venue,
  preferenceNote: "Preferred visit time. This is not a reserved slot.",
} as const;

export type FlowFieldError = "buyer_name" | "buyer_phone" | "visit_date" | "visit_time" | "flow_token" | "response_json";

export type ParsedFlowForm = {
  buyerName: string;
  buyerPhone: string;
  visitDate: string;
  visitTime: string;
  flowToken: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function parseFlowForm(responseJson: string): { form: ParsedFlowForm | null; errors: FlowFieldError[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseJson) as unknown;
  } catch {
    return { form: null, errors: ["response_json"] };
  }
  const row = asRecord(parsed);
  if (!row) return { form: null, errors: ["response_json"] };
  const errors: FlowFieldError[] = [];
  const buyerName = text(row.buyer_name).replace(/\s+/g, " ").trim();
  const buyerPhone = text(row.buyer_phone).replace(/[^\d+]/g, "");
  const visitDate = text(row.visit_date).trim();
  const visitTime = normalizeVisitTime(text(row.visit_time));
  const flowToken = text(row.flow_token).trim();
  const phoneDigits = buyerPhone.replace(/\D/g, "");
  if (buyerName.length < 2 || buyerName.length > 80) errors.push("buyer_name");
  if (phoneDigits.length < 8 || phoneDigits.length > 15 || !/^\+?\d+$/.test(buyerPhone)) errors.push("buyer_phone");
  if (!visitDateOk(visitDate)) errors.push("visit_date");
  if (!visitTime) errors.push("visit_time");
  if (!/^[A-Za-z0-9._:-]{12,128}$/.test(flowToken)) errors.push("flow_token");
  if (errors.length || !visitTime) return { form: null, errors };
  return { form: { buyerName, buyerPhone, visitDate, visitTime, flowToken }, errors: [] };
}
