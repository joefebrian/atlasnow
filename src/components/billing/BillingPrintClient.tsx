"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMemo } from "react";
import { InvoiceDocument } from "@/components/billing/InvoiceDocument";
import { SowDocument } from "@/components/billing/SowDocument";
import { parseBillingPrintInput } from "@/lib/billing/print-input";
import { DEFAULT_BILLING_BANK } from "@/lib/billing/seller";
import { planLabel } from "@/lib/billing/quote";

export function BillingPrintClient() {
  const params = useSearchParams();
  const input = useMemo(() => {
    const raw: Record<string, string> = {};
    params.forEach((v, k) => {
      raw[k] = v;
    });
    return parseBillingPrintInput(raw, DEFAULT_BILLING_BANK);
  }, [params]);

  const plan = planLabel(input.plan, "id");
  const printTitle = `Invoice + SOW AtlasNow ${plan}`;

  function onPrint() {
    const prev = document.title;
    document.title = printTitle;
    window.print();
    document.title = prev;
  }

  return (
    <div className="min-h-dvh bg-white text-[var(--ink)]">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-white/95 px-4 py-3 print:hidden">
        <Link href="/billing" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Form
        </Link>
        <p className="hidden text-[12px] text-slate-400 sm:block">
          Di dialog print: Destination = Save as PDF, matikan Headers and footers.
        </p>
        <button type="button" className="an-btn-primary px-4 py-2" onClick={onPrint}>
          Print / PDF
        </button>
      </div>
      <InvoiceDocument input={input} />
      <div className="an-print-break" />
      <SowDocument input={input} />
    </div>
  );
}
