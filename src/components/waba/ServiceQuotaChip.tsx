import { formatIdr } from "@/lib/broadcast/rates";
import type { ServiceQuotaSnapshot } from "@/lib/waba/service-quota";

export function ServiceQuotaChip({
  quota,
  locale,
}: {
  quota: ServiceQuotaSnapshot | null | undefined;
  locale: "en" | "id";
}) {
  if (!quota?.connected || !quota.phoneNumberId) return null;
  const id = locale === "id";
  const gone = quota.remaining <= 0;
  return (
    <div
      className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed ring-1 ${
        gone
          ? "bg-amber-50 text-amber-950 ring-amber-200"
          : "bg-[#eef8ff] text-slate-700 ring-[#b7e1ff]/70"
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">
        {id ? "Service WhatsApp bulan ini" : "WhatsApp service this month"}
        {quota.displayPhone ? ` · ${quota.displayPhone}` : ""}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">
        {quota.used.toLocaleString("id-ID")} / {quota.cap.toLocaleString("id-ID")}{" "}
        {id ? "gratis" : "free"}
        <span className="ml-2 text-[12px] font-medium text-slate-500">
          {id ? `${quota.remaining.toLocaleString("id-ID")} tersisa` : `${quota.remaining.toLocaleString("id-ID")} left`}
        </span>
      </p>
      <p className="mt-1 text-[12px] text-slate-500">
        {id
          ? "Kuota Meta: 1.000 balasan orang / nomor Cloud / bulan kalender. Bukan harian. Reset tanggal 1 (zona WABA). Tidak nambah ke bulan depan. Chat masuk dan iklan klik-ke-WA tidak dihitung."
          : "Meta’s gift: 1,000 human replies / Cloud number / calendar month. Not daily. Resets on the 1st (WABA timezone). No rollover. Inbound and click-to-WhatsApp ads do not count."}
      </p>
      <p className="mt-1 text-[12px] text-slate-500">
        {gone
          ? id
            ? `Kuota habis. Balasan berikutnya Meta ≈ ${formatIdr(quota.metaEachIdr)} (utility). Tagihan WhatsApp merek, bukan Atlas.`
            : `Free tier used. Next reply Meta ≈ ${formatIdr(quota.metaEachIdr)} (utility). The brand’s WhatsApp invoice, not Atlas.`
          : id
            ? `Habis 1.000, Meta ≈ ${formatIdr(quota.metaEachIdr)} / pesan. Sampai 1 Okt tagihan Meta masih Rp 0 — angka ini preview supaya Oktober tidak kaget.`
            : `After 1,000, Meta ≈ ${formatIdr(quota.metaEachIdr)} / message. Until 1 Oct Meta’s invoice is still Rp 0 — this count is the October preview.`}
      </p>
      {!quota.paymentMethodOk ? (
        <p className="mt-1 text-[12px] font-medium text-amber-800">
          {id
            ? "Metode bayar WABA di WhatsApp Manager harus ada sebelum 30 Sep, atau Meta bisa stop kirim 1 Okt."
            : "Put a payment method on this WABA in WhatsApp Manager before 30 Sep or Meta may stop delivery on 1 Oct."}
        </p>
      ) : null}
    </div>
  );
}
