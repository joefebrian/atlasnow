import {
  ATLAS_PRICE_IDR,
  extraIncrementIdr,
  formatIdr,
  planBaseIdr,
  type PricingPlanId,
} from "@/lib/marketing/pricing";
import { vatLine, type VatLine } from "@/lib/billing/vat";

export type InvoicePlanId = Exclude<PricingPlanId, "free">;

export type InvoiceQuote = {
  plan: InvoicePlanId;
  extraCount: number;
  includedOutlets: number | null;
  baseIdr: number;
  extraIdr: number;
  subtotalIdr: number;
  vat: VatLine;
  totalIdr: number;
};

const INCLUDED: Record<InvoicePlanId, number | null> = {
  silver: ATLAS_PRICE_IDR.silverIncluded,
  gold: ATLAS_PRICE_IDR.goldIncluded,
  platinum: ATLAS_PRICE_IDR.platinumIncluded,
  diamond: null,
};

export function isInvoicePlan(value: string): value is InvoicePlanId {
  return value === "silver" || value === "gold" || value === "platinum" || value === "diamond";
}

export function invoiceQuote(
  plan: InvoicePlanId,
  extraCount: number,
  diamondAmountIdr = 0,
  vat: { active?: boolean } = {}
): InvoiceQuote {
  const extra = Math.max(0, Math.floor(extraCount));
  const includedOutlets = INCLUDED[plan];

  let baseIdr = 0;
  let extraIdr = 0;
  if (plan === "diamond") {
    baseIdr = Math.max(0, Math.floor(diamondAmountIdr));
    extraIdr = 0;
  } else {
    baseIdr = planBaseIdr(plan) ?? 0;
    extraIdr = extraIncrementIdr(extra);
  }

  const subtotalIdr = baseIdr + extraIdr;
  const vatRow = vatLine(Boolean(vat.active), subtotalIdr);

  return {
    plan,
    extraCount: plan === "diamond" ? 0 : extra,
    includedOutlets,
    baseIdr,
    extraIdr,
    subtotalIdr,
    vat: vatRow,
    totalIdr: subtotalIdr + vatRow.amountIdr,
  };
}

export function planLabel(plan: InvoicePlanId, locale: "en" | "id"): string {
  if (plan === "silver") return "Silver";
  if (plan === "gold") return "Gold";
  if (plan === "platinum") return "Platinum";
  return locale === "id" ? "Diamond (quote)" : "Diamond (quoted)";
}

export { formatIdr };
