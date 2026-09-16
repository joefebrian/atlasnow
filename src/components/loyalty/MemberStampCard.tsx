import { SaveCardApp } from "@/components/loyalty/SaveCardApp";
import { GuestReceiptForm } from "@/components/loyalty/GuestReceiptForm";

export function MemberStampCard({
  token,
  brandName,
  brandSlug,
  memberId,
  name,
  phone,
  life,
  stamp,
  guestReceiptUpload = false,
  locations = [],
}: {
  token: string;
  brandName: string;
  brandSlug: string;
  memberId: string;
  name: string;
  phone: string;
  life: string;
  guestReceiptUpload?: boolean;
  locations?: { id: string; name: string }[];
  stamp: {
    count: number;
    goal: number;
    enabled: boolean;
    reward?: string;
    tiers?: { stamps: number; reward: string; canRedeem: boolean; claimed: boolean }[];
  };
}) {
  const goal = stamp.goal || 10;
  const count = stamp.count || 0;
  const next = stamp.tiers?.find((t) => !t.claimed && t.stamps > count);
  const claimable = stamp.tiers?.filter((t) => t.canRedeem) || [];
  const encoded = encodeURIComponent(token);
  const iconSrc = `/i/${encodeURIComponent(brandSlug)}/180.png?v=3`;
  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={brandName}
        className="h-14 w-14 rounded-2xl bg-white object-contain ring-1 ring-slate-200/80"
        src={iconSrc}
      />
      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#2a9bb8]">{brandName}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">Kartu stamp</h1>
      <p className="mt-1 text-sm text-slate-500">
        {name || "Member"} · {phone}
      </p>
      {life === "calon" ? (
        <div className="mt-3 rounded-2xl bg-[#ffd6b3]/60 px-4 py-3 ring-1 ring-black/[0.04]">
          <p className="text-sm font-semibold text-[var(--ink)]">Membership Belum Aktif</p>
          <p className="mt-0.5 text-[13px] text-slate-600">Lakukan transaksi pertama ke kasir.</p>
        </div>
      ) : null}

      <SaveCardApp brandName={brandName} brandSlug={brandSlug} memberId={memberId} />

      {guestReceiptUpload ? (
        <GuestReceiptForm slug={brandSlug} memberId={memberId} token={token} locations={locations} />
      ) : null}

      <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
        <p className="text-3xl font-semibold tabular-nums text-[var(--ink)]">
          {count} / {goal}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Array.from({ length: goal }).map((_, i) => (
            <span
              key={i}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
                i < count ? "bg-[var(--ink)] text-white" : "bg-[#eef8ff] text-slate-300"
              }`}
            >
              {i + 1}
            </span>
          ))}
        </div>
        {claimable.length > 0 ? (
          <p className="mt-4 text-sm font-medium text-emerald-700">
            Bisa ditukar: {claimable.map((t) => t.reward || `${t.stamps} stamp`).join(", ")}. Tunjukkan ke kasir.
          </p>
        ) : next ? (
          <p className="mt-4 text-sm text-slate-600">
            Berikutnya {next.stamps} stamp: {next.reward || "lihat kasir"}
          </p>
        ) : (
          <p className="mt-4 text-sm text-slate-500">{stamp.reward || "Hadiah diatur toko."}</p>
        )}
      </div>

      <div className="mt-6 rounded-2xl bg-white p-5 text-center ring-1 ring-slate-200/80">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="QR stamp member"
          className="mx-auto h-44 w-44 rounded-xl border border-slate-100 bg-white p-2"
          src={`/api/card/qr?token=${encoded}`}
        />
        <p className="mt-3 text-sm font-semibold text-[var(--ink)]">Tunjukkan QR ini ke kasir</p>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
          Kasir buka AtlasNow di HP/tablet toko (login akun cabang) → Loyalty → Scan QR stamp. Bukan kamera
          WhatsApp. Atau kasir ketik nomor HP di Loyalty → Cek member.
        </p>
      </div>
    </main>
  );
}
