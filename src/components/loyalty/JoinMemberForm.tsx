"use client";

import { useMemo, useState } from "react";
import { citiesForProvince, ID_PROVINCES, phoneLooksIndonesia } from "@/lib/geo/indonesia";

export function JoinMemberForm({
  joinKey,
  brandName,
  qrScope,
  outletId,
  locations,
  hasLogo,
  logoVersion,
}: {
  joinKey: string;
  brandName: string;
  qrScope: "BRAND" | "LOCATION";
  outletId: string;
  locations: { id: string; name: string }[];
  hasLogo?: boolean;
  logoVersion?: number;
}) {
  const logoSrc = hasLogo
    ? `/api/join/${encodeURIComponent(joinKey)}/logo${logoVersion ? `?v=${logoVersion}` : ""}`
    : null;
  const [form, setForm] = useState({
    name: "",
    phone: "",
    birthDate: "",
    email: "",
    province: "",
    city: "",
    outlet: outletId,
    birthdayWaOptIn: false,
  });
  const idPhone = !form.phone.trim() || phoneLooksIndonesia(form.phone);
  const cityOptions = useMemo(() => citiesForProvince(form.province), [form.province]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/join/${encodeURIComponent(joinKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        birthDate: form.birthDate,
        email: form.email,
        province: form.province,
        city: form.city,
        outlet: form.outlet || null,
        birthdayWaOptIn: form.birthdayWaOptIn,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setErr(data.error || "Could not save");
    else {
      setCardUrl(typeof data.cardUrl === "string" ? data.cardUrl : null);
      setDone(true);
    }
    setBusy(false);
  }

  if (done) {
    return (
      <main className="mx-auto min-h-screen max-w-md px-5 py-16">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="mb-4 h-16 w-16 rounded-2xl bg-white object-contain ring-1 ring-slate-200" src={logoSrc} />
        ) : null}
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">{brandName}</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Sudah terdaftar</h1>
        <p className="mt-3 text-sm text-slate-600">
          Membership belum aktif. Lakukan transaksi pertama ke kasir. Stamp masuk setelah struk disetujui.
        </p>
        {cardUrl ? (
          <div className="mt-6 rounded-2xl bg-white p-5 text-center ring-1 ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="QR stamp"
              className="mx-auto h-40 w-40"
              src={`/api/card/qr?url=${encodeURIComponent(cardUrl)}`}
            />
            <a href={cardUrl} className="mt-3 inline-block text-sm font-semibold text-[#2a9bb8]">
              Buka kartu stamp
            </a>
            <p className="mt-2 text-[12px] text-slate-500">
              Di kartu, simpan ke layar HP. Nama app-nya {brandName}, bukan AtlasNow.
            </p>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-10">
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="mb-4 h-16 w-16 rounded-2xl bg-white object-contain ring-1 ring-slate-200" src={logoSrc} />
      ) : null}
      <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">{brandName}</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Daftar member</h1>
      <p className="mt-2 text-sm text-slate-500">Isi sekali. Belanja hari ini baru mengaktifkan kartu.</p>
      {err && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>}
      <form className="mt-6 space-y-3" onSubmit={(e) => void submit(e)}>
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Nama
          <input className="an-input mt-1 w-full py-2" required minLength={2} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          No. HP
          <input className="an-input mt-1 w-full py-2" required inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Tanggal lahir
          <input className="an-input mt-1 w-full py-2" required type="date" min="1920-01-01" max="2018-12-31" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
        </label>
        <label className="block text-[10px] font-bold uppercase text-slate-400">
          Email
          <input className="an-input mt-1 w-full py-2" required type="email" autoComplete="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        {idPhone && (
          <>
            <p className="pt-1 text-[11px] text-slate-400">Nomor +62 — Indonesia. Pilih domisili.</p>
            <label className="block text-[10px] font-bold uppercase text-slate-400">
              Provinsi
              <select
                className="an-input mt-1 w-full py-2"
                required
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value, city: "" })}
              >
                <option value="">Pilih provinsi…</option>
                {ID_PROVINCES.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] font-bold uppercase text-slate-400">
              Kota / kabupaten
              <select
                className="an-input mt-1 w-full py-2"
                required
                disabled={!form.province}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              >
                <option value="">{form.province ? "Pilih kota / kabupaten…" : "Pilih provinsi dulu"}</option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {qrScope === "LOCATION" && !outletId && (
          <label className="block text-[10px] font-bold uppercase text-slate-400">
            Cabang
            <select className="an-input mt-1 w-full py-2" required value={form.outlet} onChange={(e) => setForm({ ...form, outlet: e.target.value })}>
              <option value="">Pilih cabang…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.birthdayWaOptIn}
            onChange={(e) => setForm({ ...form, birthdayWaOptIn: e.target.checked })}
          />
          <span>Boleh kirim ucapan ulang tahun via WhatsApp</span>
        </label>
        <button type="submit" className="an-btn-primary w-full text-sm" disabled={busy}>
          {busy ? "Menyimpan…" : "Daftar"}
        </button>
      </form>
    </main>
  );
}
