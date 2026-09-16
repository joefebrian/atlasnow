"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ATLAS_PRICE_IDR } from "@/lib/marketing/pricing";
import { BILLING_SELLER } from "@/lib/billing/seller";
import { formatIdr, invoiceQuote, isInvoicePlan, type InvoicePlanId } from "@/lib/billing/quote";
import {
  defaultInvoiceNo,
  defaultPeriod,
  isoDate,
  plusDays,
} from "@/lib/billing/print-input";
import type { BillingBank } from "@/lib/billing/seller";

export function BillingForm({ bank }: { bank: BillingBank }) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [plan, setPlan] = useState<InvoicePlanId>("gold");
  const [extra, setExtra] = useState(0);
  const [diamondAmount, setDiamondAmount] = useState("");
  const [billTo, setBillTo] = useState("");
  const [brand, setBrand] = useState("");
  const [billAddress, setBillAddress] = useState("");
  const [billEmail, setBillEmail] = useState("");
  const [invoiceNo, setInvoiceNo] = useState(defaultInvoiceNo(today));
  const [period, setPeriod] = useState(defaultPeriod(today));
  const [issued, setIssued] = useState(isoDate(today));
  const [due, setDue] = useState(plusDays(today, 7));
  const [startDate, setStartDate] = useState(isoDate(today));
  const [notes, setNotes] = useState("");
  const [bankName, setBankName] = useState(bank.bankName);
  const [bankHolder, setBankHolder] = useState(bank.accountName || BILLING_SELLER.legalName);
  const [bankAccount, setBankAccount] = useState(bank.accountNumber);
  const [vatActive, setVatActive] = useState(false);

  const diamondIdr = Number.parseInt(diamondAmount.replace(/\D/g, ""), 10) || 0;
  const q = invoiceQuote(plan, extra, diamondIdr, { active: vatActive });

  function openBundle() {
    const p = new URLSearchParams();
    p.set("plan", plan);
    p.set("extra", String(extra));
    if (plan === "diamond") p.set("diamondAmount", String(diamondIdr));
    p.set("billTo", billTo);
    p.set("brand", brand);
    p.set("billAddress", billAddress);
    p.set("billEmail", billEmail);
    p.set("invoiceNo", invoiceNo);
    p.set("period", period);
    p.set("issued", issued);
    p.set("due", due);
    p.set("startDate", startDate);
    p.set("notes", notes);
    p.set("bankName", bankName);
    p.set("bankHolder", bankHolder);
    p.set("bankAccount", bankAccount);
    if (vatActive) p.set("vat", "1");
    router.push(`/billing/print?${p.toString()}`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form
        className="an-card space-y-4 p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          openBundle();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Paket</span>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              value={plan}
              onChange={(e) => {
                const v = e.target.value;
                if (isInvoicePlan(v)) setPlan(v);
              }}
            >
              <option value="silver">Silver — {formatIdr(ATLAS_PRICE_IDR.silverMonthly)}</option>
              <option value="gold">Gold — {formatIdr(ATLAS_PRICE_IDR.goldMonthly)}</option>
              <option value="platinum">Platinum — {formatIdr(ATLAS_PRICE_IDR.platinumMonthly)}</option>
              <option value="diamond">Diamond — quote</option>
            </select>
          </label>
          {plan === "diamond" ? (
            <label className="block text-sm">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Nominal Diamond (IDR)
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                inputMode="numeric"
                value={diamondAmount}
                onChange={(e) => setDiamondAmount(e.target.value)}
                placeholder="12000000"
              />
            </label>
          ) : (
            <label className="block text-sm">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Outlet extra (− n +)
              </span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                type="number"
                min={0}
                max={99}
                value={extra}
                onChange={(e) => setExtra(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
          )}
        </div>

        <label className="block text-sm">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Tagihan kepada</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            value={billTo}
            onChange={(e) => setBillTo(e.target.value)}
            placeholder="PT Brand Contoh"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Merek di AtlasNow</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Nama brand di desk"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Alamat</span>
          <textarea
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            rows={2}
            value={billAddress}
            onChange={(e) => setBillAddress(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Email klien</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            type="email"
            value={billEmail}
            onChange={(e) => setBillEmail(e.target.value)}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">No. invoice</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Periode (YYYY-MM)</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Tanggal invoice</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              type="date"
              value={issued}
              onChange={(e) => setIssued(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Jatuh tempo</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Tanggal mulai SOW</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Bank</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="BCA / Mandiri / …"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">a.n.</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              value={bankHolder}
              onChange={(e) => setBankHolder(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">No. rekening</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="2480707501"
            />
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={vatActive}
            onChange={(e) => setVatActive(e.target.checked)}
          />
          <span>
            <span className="font-semibold text-slate-800">VAT</span>
            <span className="mt-0.5 block text-[13px] text-slate-500">
              Default mati. Nyala = PPN Indonesia 11% di invoice, termasuk klien perusahaan Singapore. Setoran ke DJP
              manual — atau transfer balik ke klien.
            </span>
          </span>
        </label>

        <label className="block text-sm">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Catatan</span>
          <textarea
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2 pt-2">
          <button type="submit" className="an-btn-primary px-5 py-2.5">
            Buka invoice + SOW
          </button>
        </div>
      </form>

      <aside className="an-card h-fit p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Total bulan ini</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{formatIdr(q.totalIdr)}</p>
        <p className="mt-1 text-sm text-slate-500">
          {q.vat.active ? `termasuk ${q.vat.label} ${formatIdr(q.vat.amountIdr)}` : "Tanpa VAT"}
        </p>
        <dl className="mt-4 space-y-1.5 text-sm text-slate-600">
          <div className="flex justify-between gap-3">
            <dt>Paket</dt>
            <dd className="tabular-nums">{formatIdr(q.baseIdr)}</dd>
          </div>
          {q.plan !== "diamond" ? (
            <div className="flex justify-between gap-3">
              <dt>Extra × {q.extraCount}</dt>
              <dd className="tabular-nums">{formatIdr(q.extraIdr)}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-4 text-[13px] leading-relaxed text-slate-500">
          Penerbit: {BILLING_SELLER.legalName} ({BILLING_SELLER.tradeName}). Bukan payment gateway. Kredit WhatsApp
          tidak masuk angka ini. Catat transfer di spreadsheet.
        </p>
      </aside>
    </div>
  );
}
