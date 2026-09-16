"use client";

import { useEffect, useMemo, useState } from "react";
import { pickReceiptNo } from "@/lib/loyalty/receipt-nos";

export function GuestReceiptForm({
  slug,
  memberId,
  token,
  locations,
}: {
  slug: string;
  memberId: string;
  token: string;
  locations: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [trxId, setTrxId] = useState("");
  const [amount, setAmount] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<"auto" | "queue" | null>(null);
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  if (locations.length === 0) return null;

  if (done === "auto") {
    return (
      <div className="mt-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-100">
        Stamp tercatat. Refresh kartu ini kalau angkanya belum pindah.
      </div>
    );
  }
  if (done === "queue") {
    return (
      <div className="mt-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
        Struk masuk kantor. Belum stamp sampai disetujui. Kasir juga bisa input di toko.
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
        <p className="text-sm font-semibold text-[var(--ink)]">Sudah bayar, kasir sibuk?</p>
        <p className="mt-1 text-[13px] text-slate-500">Foto kertas struk dari kartu ini. Bukan stiker daftar di meja.</p>
        <button type="button" className="an-btn-primary mt-3 text-sm" onClick={() => setOpen(true)}>
          Kirim struk
        </button>
      </div>
    );
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const picked = pickReceiptNo(trxId);
    if (!picked.ok) {
      setErr(picked.error);
      return;
    }
    if (!amount.trim() || !Number.isFinite(Number(amount.replace(/[^\d]/g, "")))) {
      setErr("Nominal wajib. Isi Rp dari kertas.");
      return;
    }
    if (!photo) {
      setErr("Foto struk wajib.");
      return;
    }
    setBusy(true);
    setErr(null);
    const body = new FormData();
    body.set("token", token);
    body.set("locationId", locationId);
    body.set("trxId", picked.trxId);
    body.set("amount", amount.replace(/[^\d]/g, ""));
    body.set("photo", photo);
    const res = await fetch(`/api/c/${encodeURIComponent(slug)}/${encodeURIComponent(memberId)}/receipt`, {
      method: "POST",
      body,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(typeof data.error === "string" ? data.error : "Gagal kirim");
      return;
    }
    if (data.autoApproved) {
      setDone("auto");
      window.setTimeout(() => window.location.reload(), 1600);
    } else {
      setDone("queue");
    }
  }

  return (
    <form className="mt-6 space-y-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80" onSubmit={(e) => void send(e)}>
      <p className="text-sm font-semibold text-[var(--ink)]">Kirim struk</p>
      <p className="text-[13px] text-slate-500">HP sudah dari kartu ini. Foto kertas kasir, bukan chat.</p>
      {locations.length > 1 ? (
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Cabang
          <select className="an-input mt-1 w-full py-2 normal-case" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-[12px] text-slate-500">Cabang: {locations[0]?.name}</p>
      )}
      <label className="block text-[10px] font-bold uppercase text-slate-400">
        No. transaksi / No. Struk / No. Invoice
        <input className="an-input mt-1 w-full py-2 normal-case" value={trxId} onChange={(e) => setTrxId(e.target.value)} autoComplete="off" required />
      </label>
      <label className="block text-[10px] font-bold uppercase text-slate-400">
        Nominal (Rp)
        <input className="an-input mt-1 w-full py-2 normal-case" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </label>
      <label className="an-btn-ghost inline-block cursor-pointer text-sm">
        {photo ? "Ganti foto" : "Ambil foto kertas"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            e.target.value = "";
            setPhoto(f);
          }}
        />
      </label>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="Struk" className="h-36 w-36 rounded-xl object-cover ring-1 ring-slate-200" src={preview} />
      ) : null}
      {err ? <p className="text-[12px] text-rose-700">{err}</p> : null}
      <div className="flex gap-2">
        <button type="submit" className="an-btn-primary text-sm" disabled={busy}>
          {busy ? "Membaca struk…" : "Kirim"}
        </button>
        <button type="button" className="an-btn-ghost text-sm" onClick={() => setOpen(false)}>
          Batal
        </button>
      </div>
    </form>
  );
}
