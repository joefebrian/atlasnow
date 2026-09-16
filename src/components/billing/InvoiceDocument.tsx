import { ATLAS_PRICE_IDR } from "@/lib/marketing/pricing";
import { BILLING_SELLER, sellerLine, type BillingBank } from "@/lib/billing/seller";
import { formatIdr, invoiceQuote, planLabel, type InvoicePlanId } from "@/lib/billing/quote";
import type { BillingPrintInput } from "@/lib/billing/print-input";
import { PrintDoc } from "@/components/billing/PrintDoc";

function dash(v: string, empty = "—") {
  return v.trim() ? v : empty;
}

function formatPeriod(period: string): string {
  if (!/^\d{4}-\d{2}$/.test(period)) return dash(period);
  const [y, m] = period.split("-");
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${months[Number(m) - 1]} ${y}`;
}

function BankBlock({ bank }: { bank: BillingBank }) {
  const ready = bank.bankName && bank.accountNumber;
  return (
    <div className="an-print-bank">
      <p className="an-print-label">Transfer ke</p>
      {ready ? (
        <p>
          {bank.bankName}
          <br />
          a.n. {bank.accountName || BILLING_SELLER.legalName}
          <br />
          {bank.accountNumber}
        </p>
      ) : (
        <p>Rekening {BILLING_SELLER.legalName} — isi nomor rekening di form sebelum kirim.</p>
      )}
    </div>
  );
}

export function InvoiceDocument({ input }: { input: BillingPrintInput }) {
  const q = invoiceQuote(input.plan, input.extraCount, input.diamondAmountIdr, {
    active: input.vatActive,
  });
  const plan = planLabel(input.plan as InvoicePlanId, "id");

  return (
    <PrintDoc
      kind="Invoice"
      title={`${BILLING_SELLER.product} — ${plan}`}
      metaRight={
        <>
          <p className="an-print-strong">{dash(input.invoiceNo, "AN-XXXX-001")}</p>
          <p>Tanggal {dash(input.issued)}</p>
          <p>Jatuh tempo {dash(input.due)}</p>
          <p>Periode {formatPeriod(input.period)}</p>
        </>
      }
      foot={`${sellerLine()} · ${BILLING_SELLER.product} · ${q.vat.active ? q.vat.label : "Tanpa VAT pada invoice ini"} · Setoran DJP manual`}
    >
      <div className="an-print-parties">
        <div className="an-print-card">
          <p className="an-print-label">Tagihan kepada</p>
          <p className="an-print-strong">{dash(input.billTo, "Nama perusahaan brand")}</p>
          {input.brand ? <p>Merek di AtlasNow: {input.brand}</p> : null}
          {input.billAddress ? <p className="whitespace-pre-line">{input.billAddress}</p> : null}
          {input.billEmail ? <p>{input.billEmail}</p> : null}
        </div>
        <div className="an-print-card">
          <p className="an-print-label">Dari</p>
          <p className="an-print-strong">{sellerLine()}</p>
          <p>{BILLING_SELLER.product}</p>
          <p>{BILLING_SELLER.email}</p>
        </div>
      </div>

      <table className="an-print-table">
        <thead>
          <tr>
            <th>Uraian</th>
            <th className="an-print-num">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Paket {plan}
              {q.includedOutlets != null ? ` · ${q.includedOutlets} outlet termasuk` : " · quote"}
            </td>
            <td className="an-print-num">{formatIdr(q.baseIdr)}</td>
          </tr>
          {q.plan !== "diamond" ? (
            <tr>
              <td>
                Outlet extra {q.extraCount} × {formatIdr(ATLAS_PRICE_IDR.extraOutletMonthly)}
              </td>
              <td className="an-print-num">{formatIdr(q.extraIdr)}</td>
            </tr>
          ) : null}
          <tr>
            <td>{q.vat.active ? q.vat.label : "VAT"}</td>
            <td className="an-print-num">{q.vat.active ? formatIdr(q.vat.amountIdr) : "Tidak ditagih"}</td>
          </tr>
          <tr className="an-print-total">
            <td>Total dibayar</td>
            <td className="an-print-num an-print-money">{formatIdr(q.totalIdr)}</td>
          </tr>
        </tbody>
      </table>

      <BankBlock bank={input.bank} />

      <ul className="an-print-ul an-print-fine">
        <li>Kredit WhatsApp (blast / pesan berbayar Meta) bukan bagian invoice ini — ditagih terpisah.</li>
        <li>Laporan = struk, stamp, dan hadiah yang diserahkan. Kami tidak mengarang kunjungan, lead, atau omzet.</li>
        <li>Voucher berbayar TikTok GO bukan stamp. Login dinyalakan setelah transfer diterima.</li>
        {input.notes ? <li className="whitespace-pre-line">{input.notes}</li> : null}
      </ul>
    </PrintDoc>
  );
}
