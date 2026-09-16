import { BILLING_SELLER, sellerLine } from "@/lib/billing/seller";
import { formatIdr, invoiceQuote, planLabel, type InvoicePlanId } from "@/lib/billing/quote";
import { ATLAS_PRICE_IDR } from "@/lib/marketing/pricing";
import type { BillingPrintInput } from "@/lib/billing/print-input";
import { PrintDoc, PrintDl, PrintSection } from "@/components/billing/PrintDoc";

function dash(v: string, empty = "—") {
  return v.trim() ? v : empty;
}

const SCOPE: Record<InvoicePlanId, string[]> = {
  silver: [
    "Meja membership: QR daftar, stamp / poin / pelanggan teratas, ultah, foto struk kasir, member, laporan dari tiket yang disetujui.",
    "Outlet extra setelah 2 termasuk, sesuai jumlah di tabel harga.",
    "Satu nomor WhatsApp Business resmi (Cloud HQ). Inbox orang, bukan bot. Bukan QR cabang.",
    "Blast opt-in dari nomor itu — tarif Meta ditagih terpisah (kredit).",
    "Tidak termasuk: listing Google, kasir TikTok GO live, watch chat cabang (WAHA), nomor HQ kedua.",
  ],
  gold: [
    "Semua yang ada di Silver.",
    "Inbox WhatsApp HQ di nomor resmi merek. Orang yang membalas, bukan bot.",
    "Chat cabang bisa dilihat; AtlasNow tidak membalas dari nomor cabang.",
    "Listing Google dan balasan ulasan oleh orang.",
    "Kasir TikTok GO: cek, tukar, recap per cabang. Voucher GO berbayar bukan stamp.",
    "Blast opt-in dari nomor HQ — tarif Meta ditagih terpisah (kredit).",
  ],
  platinum: [
    "Semua yang ada di Gold.",
    "15 outlet termasuk. Recap semua pintu: stamp, voucher GO, struk, cabang sepi.",
    "Training di meja. Masih di server bersama AtlasNow.",
  ],
  diamond: [
    "Semua yang ada di Platinum, di domain dan server yang dikutip di SOW ini.",
    "Meja Grup hanya jika klien pegang lebih dari satu merek — ditulis di catatan.",
    "Cap sesi live WAHA mengikuti box klien, bukan 6 di VPS bersama.",
  ],
};

export function SowDocument({ input }: { input: BillingPrintInput }) {
  const q = invoiceQuote(input.plan, input.extraCount, input.diamondAmountIdr, {
    active: input.vatActive,
  });
  const plan = planLabel(input.plan as InvoicePlanId, "id");
  const partyB = dash(input.billTo, "Nama klien");
  const start = dash(input.startDate || input.issued);

  return (
    <PrintDoc
      kind="SOW"
      title={`SOW — ${BILLING_SELLER.product} ${plan}`}
      metaRight={
        <>
          <p>{dash(input.invoiceNo, "Tanpa nomor")}</p>
          <p>Mulai {start}</p>
        </>
      }
      foot={`${sellerLine()} · ${BILLING_SELLER.product} · ${q.vat.active ? q.vat.label : "Tanpa VAT pada SOW ini"} · Setoran DJP manual`}
    >
      <div className="an-print-parties">
        <div className="an-print-card">
          <p className="an-print-label">Pihak A — penyedia</p>
          <p className="an-print-strong">{sellerLine()}</p>
          <p>Mengoperasikan {BILLING_SELLER.product}</p>
          <p>{BILLING_SELLER.email}</p>
        </div>
        <div className="an-print-card">
          <p className="an-print-label">Pihak B — klien</p>
          <p className="an-print-strong">{partyB}</p>
          {input.brand ? <p>Merek di AtlasNow: {input.brand}</p> : null}
          {input.billAddress ? <p className="whitespace-pre-line">{input.billAddress}</p> : null}
          {input.billEmail ? <p>{input.billEmail}</p> : null}
        </div>
      </div>

      <PrintSection n="01" title="Paket dan harga">
        <table className="an-print-table">
          <tbody>
            <tr>
              <td>Paket</td>
              <td>
                {plan}
                {q.includedOutlets != null ? ` · ${q.includedOutlets} outlet termasuk` : " · quote"}
              </td>
            </tr>
            {q.plan !== "diamond" ? (
              <tr>
                <td>Outlet extra</td>
                <td>
                  {q.extraCount} × {formatIdr(ATLAS_PRICE_IDR.extraOutletMonthly)}
                </td>
              </tr>
            ) : null}
            <tr>
              <td>Langganan / bulan (sebelum pajak)</td>
              <td className="an-print-money">{formatIdr(q.subtotalIdr)}</td>
            </tr>
            <tr>
              <td>{q.vat.active ? q.vat.label : "VAT"}</td>
              <td>{q.vat.active ? formatIdr(q.vat.amountIdr) : "Tidak ditagih pada SOW ini"}</td>
            </tr>
            <tr>
              <td>Total / bulan</td>
              <td className="an-print-money">{formatIdr(q.totalIdr)}</td>
            </tr>
            <tr>
              <td>Pembayaran</td>
              <td>Transfer ke rekening Pihak A, di muka</td>
            </tr>
          </tbody>
        </table>
        <p className="an-print-note">
          Kredit WhatsApp (pesan berbayar Meta) bukan biaya meja. Ditagih terpisah. Tidak ada “unlimited WhatsApp”.{" "}
          {q.vat.active
            ? `${q.vat.label} ditagih di invoice (PT Sorak Digital Media, termasuk klien perusahaan SG). Setoran ke DJP manual.`
            : "VAT tidak ditagih kecuali checklist VAT aktif pada invoice ini."}
        </p>
      </PrintSection>

      <PrintSection n="02" title="Yang termasuk">
        <ul className="an-print-ul">
          {SCOPE[input.plan].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </PrintSection>

      <PrintSection n="03" title="Yang tidak dijual sebagai live">
        <p className="an-print-mute">
          Post Google, iklan, to-do mingguan, Approve otomatis dari POS, inbox native TikTok / Instagram / Messenger,
          aplikasi mobile white-label, Meta Business Agent.
        </p>
      </PrintSection>

      <PrintSection n="04" title="Mulai, bayar, berhenti">
        <PrintDl
          rows={[
            { k: "Tanggal mulai", v: `${start} — atau hari pertama lokasi aktif, mana yang SOW ini sebut` },
            { k: "Login", v: "Dinyalakan setelah transfer invoice pertama diterima. Tidak ada kartu di situs." },
            { k: "Siklus", v: "Bulanan di muka" },
            {
              k: "Berhenti",
              v: "Pemberitahuan 30 hari. Invoice lunas tidak di-refund; workspace jalan sampai periode itu habis. Jumlah outlet = daftar terakhir sebelum notice.",
            },
            { k: "Telat", v: "14 hari setelah jatuh tempo: akses baca saja. Data tidak dihapus." },
            {
              k: "Harga",
              v: "atlasnow.co/pricing boleh berubah untuk SOW baru. SOW ini grandfather sampai change order tertulis.",
            },
          ]}
        />
      </PrintSection>

      <PrintSection n="05" title="Angka yang kami tanggung">
        <p>
          Laporan = struk, stamp, dan hadiah yang diserahkan. Kami tidak mengarang kunjungan, lead, atau omzet. Voucher
          berbayar TikTok GO bukan stamp.
        </p>
      </PrintSection>

      {input.notes ? (
        <PrintSection n="06" title="Catatan">
          <p className="whitespace-pre-line">{input.notes}</p>
        </PrintSection>
      ) : null}

      <div className="an-print-signs">
        <div className="an-print-sign">
          <p className="an-print-label">Pihak A</p>
          <p className="an-print-strong">{sellerLine()}</p>
          <div className="an-print-sign-line" />
          <p>Nama / ttd</p>
          <p>Tanggal</p>
        </div>
        <div className="an-print-sign">
          <p className="an-print-label">Pihak B</p>
          <p className="an-print-strong">{partyB}</p>
          <div className="an-print-sign-line" />
          <p>Nama / ttd</p>
          <p>Tanggal</p>
        </div>
      </div>
    </PrintDoc>
  );
}
