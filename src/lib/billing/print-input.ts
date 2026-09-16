import { isInvoicePlan, type InvoicePlanId } from "@/lib/billing/quote";
import { DEFAULT_BILLING_BANK, type BillingBank } from "@/lib/billing/seller";

export type BillingDoc = "bundle";

export type BillingPrintInput = {
  doc: BillingDoc;
  plan: InvoicePlanId;
  extraCount: number;
  diamondAmountIdr: number;
  billTo: string;
  billAddress: string;
  billEmail: string;
  brand: string;
  invoiceNo: string;
  period: string;
  issued: string;
  due: string;
  startDate: string;
  notes: string;
  bank: BillingBank;
  vatActive: boolean;
};

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] || "").trim();
  return (v || "").trim();
}

function intOr(v: string, fallback: number): number {
  const n = Number.parseInt(v.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function parseBillingPrintInput(
  raw: Record<string, string | string[] | undefined>,
  bankDefault: BillingBank = DEFAULT_BILLING_BANK
): BillingPrintInput {
  const planRaw = first(raw.plan).toLowerCase();
  const plan: InvoicePlanId = isInvoicePlan(planRaw) ? planRaw : "gold";
  const doc: BillingDoc = "bundle";

  return {
    doc,
    plan,
    extraCount: Math.max(0, intOr(first(raw.extra), 0)),
    diamondAmountIdr: Math.max(0, intOr(first(raw.diamondAmount), 0)),
    billTo: first(raw.billTo),
    billAddress: first(raw.billAddress),
    billEmail: first(raw.billEmail),
    brand: first(raw.brand),
    invoiceNo: first(raw.invoiceNo),
    period: first(raw.period),
    issued: first(raw.issued),
    due: first(raw.due),
    startDate: first(raw.startDate),
    notes: first(raw.notes),
    bank: {
      bankName: first(raw.bankName) || bankDefault.bankName,
      accountName: first(raw.bankHolder) || bankDefault.accountName,
      accountNumber: first(raw.bankAccount) || bankDefault.accountNumber,
    },
    vatActive: first(raw.vat) === "1" || first(raw.vat) === "true",
  };
}

export function defaultInvoiceNo(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `AN-${y}${m}-001`;
}

export function defaultPeriod(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isoDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function plusDays(d: Date, days: number): string {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return isoDate(x);
}
