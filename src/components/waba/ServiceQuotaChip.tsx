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
  const recorded = quota.used;
  const estimatedBillable = Math.max(0, recorded - quota.cap);
  return (
    <div className="rounded-2xl bg-[#eef8ff] px-4 py-3 text-[13px] leading-relaxed text-slate-700 ring-1 ring-[#b7e1ff]/70">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">
        {id ? "Penggunaan & tagihan WhatsApp" : "WhatsApp Usage & Billing"}
        {quota.displayPhone ? ` · ${quota.displayPhone}` : ""}
      </p>
      <dl className="mt-2 grid gap-1 text-[12px] sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-bold uppercase text-slate-400">{id ? "Periode" : "Period"}</dt>
          <dd className="text-slate-900">{quota.periodKey} · {quota.timezone}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-slate-400">{id ? "Nomor bisnis" : "Business number"}</dt>
          <dd className="font-mono text-[11px] text-slate-900">{quota.phoneNumberId}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-slate-400">{id ? "Pemakaian tercatat" : "Recorded usage"}</dt>
          <dd className="tabular-nums text-slate-900">
            {recorded.toLocaleString("id-ID")} {id ? "balasan service terkirim" : "delivered service replies"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase text-slate-400">
            {id ? "Perkiraan yang bisa ditagih" : "Estimated billable"}
          </dt>
          <dd className="tabular-nums text-slate-900">
            {estimatedBillable.toLocaleString("id-ID")}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[12px] text-slate-500">
        {id
          ? "Sumber: webhook status terkirim yang tersimpan di AtlasNow. Bukan saldo resmi Meta dan bukan faktur. Meta menghitung 1.000 service message gratis per nomor per bulan sejak 1 Oktober 2026, tanpa rollover. Tarif tergantung negara penerima."
          : "Source: delivered status webhooks stored by AtlasNow. This is not an official Meta balance and not an invoice. Meta includes 1,000 free service messages per number each month from 1 October 2026, with no rollover. The rate depends on the recipient’s country."}
      </p>
      <p className="mt-1 text-[12px] font-medium text-slate-700">
        {id
          ? "Perkiraan pemakaian — konfirmasi tagihan akhir di Meta WhatsApp Manager."
          : "Usage estimate — confirm final charges in Meta WhatsApp Manager."}
      </p>
      <p className="mt-1 text-[12px] text-slate-500">
        <a
          className="font-medium text-[#1473a6] underline"
          href="https://business.facebook.com/latest/whatsapp_manager/overview"
          target="_blank"
          rel="noreferrer"
        >
          {id ? "Kelola tagihan di WhatsApp Manager" : "Manage billing in WhatsApp Manager"}
        </a>
      </p>
    </div>
  );
}
