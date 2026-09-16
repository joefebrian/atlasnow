"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { StampQrScan } from "@/components/loyalty/StampQrScan";
import { pickReceiptNo } from "@/lib/loyalty/receipt-nos";
import { isTikTokGoPayload } from "@/lib/tiktok-go/detect";
import type { Messages } from "@/lib/i18n/messages";

type T = Messages["loyaltyDesk"];

type Loc = { id: string; name: string };
type Intake = {
  id: string;
  phone: string;
  trxId: string;
  amount: number | null;
  invoiceRef: string | null;
  status: string;
  notifyStatus: string;
  matchStatus?: string;
  hasPhoto?: boolean;
  ocrNomor?: string | null;
  ocrAmount?: number | null;
  createdAt: string;
  location: { id: string; name: string };
};
type Tab = "queue" | "submit" | "member" | "scan";
type MemberPayload = {
  stamp?: Record<string, unknown>;
  spender?: Record<string, unknown>;
  membership?: Record<string, unknown>;
  cardUrl?: string | null;
  phone?: string;
  error?: string;
};

const EMPTY_RECEIPT = { trxId: "" };

export function LoyaltyDesk({
  clientId,
  isAgency,
  canReview = true,
  locations,
  brands,
  t,
}: {
  clientId: string | null;
  isAgency: boolean;
  canReview?: boolean;
  locations: Loc[];
  brands: { id: string; name: string }[];
  t: T;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "queue", label: t.tabQueue },
    { id: "submit", label: t.tabSubmit },
    { id: "member", label: t.tabMember },
    { id: "scan", label: t.tabScan },
  ];
  const qs = clientId ? `?client=${encodeURIComponent(clientId)}` : "";
  const [tab, setTab] = useState<Tab>("queue");
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ locationId: locations[0]?.id || "", phone: "", amount: "", ...EMPTY_RECEIPT });
  const [lookup, setLookup] = useState("");
  const [paste, setPaste] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [member, setMember] = useState<MemberPayload | null>(null);
  const [goVoucher, setGoVoucher] = useState<{
    title: string;
    detail: string;
    shopOrderId: string;
    codes: string[];
    locationId: string;
    locationName: string;
  } | null>(null);
  const [goEvents, setGoEvents] = useState<
    { id: string; kind: string; demo: boolean; title: string; detail: string; outlet: string; at: string }[]
  >([]);

  const loadQueue = useCallback(async () => {
    if (isAgency && !clientId) return;
    const res = await fetch(`/api/loyalty/intakes${qs}${qs ? "&" : "?"}status=PENDING`, { credentials: "same-origin" });
    const data = await res.json();
    if (res.ok) setIntakes(data.intakes || []);
  }, [clientId, isAgency, qs]);

  const loadGoEvents = useCallback(async () => {
    if (isAgency && !clientId) return;
    const res = await fetch(`/api/loyalty/tiktok-go/events${qs}`, { credentials: "same-origin" });
    const data = await res.json();
    if (res.ok) setGoEvents(data.events || []);
  }, [clientId, isAgency, qs]);

  useEffect(() => {
    void loadQueue();
    void loadGoEvents();
  }, [loadQueue, loadGoEvents]);

  useEffect(() => {
    if (locations[0] && !form.locationId) {
      setForm((f) => ({ ...f, locationId: locations[0].id }));
    }
  }, [locations, form.locationId]);

  async function review(id: string, action: "approve" | "reject") {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/loyalty/intakes/${id}/review${qs}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) setErr(data.error || "Review failed");
    else {
      setMsg(action === "approve" ? "Approved. Stamp recorded (WA sent if HQ Cloud is connected)." : "Rejected.");
      await loadQueue();
    }
    setBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const picked = pickReceiptNo(form.trxId);
    if (!picked.ok) {
      setErr(t.receiptRequired);
      return;
    }
    const amount = Number(String(form.amount).replace(/[^\d]/g, ""));
    if (!Number.isFinite(amount) || amount < 0 || form.amount.trim() === "") {
      setErr(t.amountRequired);
      return;
    }
    if (!photo) {
      setErr(t.photoRequired);
      return;
    }
    setBusy(true);
    setErr(null);
    const body = new FormData();
    body.set("locationId", form.locationId);
    body.set("phone", form.phone);
    body.set("trxId", picked.trxId);
    body.set("amount", String(amount));
    body.set("photo", photo);
    const res = await fetch(`/api/loyalty/intakes${qs}`, {
      method: "POST",
      credentials: "same-origin",
      body,
    });
    const data = await res.json();
    if (!res.ok) setErr(data.error || "Submit failed");
    else {
      setPhoto(null);
      setForm((f) => ({ ...f, phone: "", amount: "", ...EMPTY_RECEIPT }));
      if (data.autoApproved) {
        setMsg(t.stampRecorded);
      } else if (data.warn) {
        setMsg(String(data.warn));
      } else if (data.matchStatus === "MATCH") {
        setMsg(t.matchOffice);
      } else if (data.matchStatus === "MISMATCH") {
        setMsg(t.mismatchQueue);
      } else {
        setMsg(t.unreadableQueue);
      }
      await loadQueue();
      setTab("queue");
    }
    setBusy(false);
  }

  function applyMemberPayload(data: MemberPayload) {
    const phone =
      typeof data.phone === "string"
        ? data.phone
        : typeof data.membership?.phone === "string"
          ? (data.membership.phone as string)
          : "";
    setMember(data);
    if (phone) {
      setLookup(phone);
      setForm((f) => ({ ...f, phone }));
    }
  }

  async function findMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/loyalty/member${qs}${qs ? "&" : "?"}phone=${encodeURIComponent(lookup)}`, {
      credentials: "same-origin",
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Not found");
      setMember(null);
    } else {
      applyMemberPayload(data);
    }
    setBusy(false);
  }

  async function scanRaw(raw: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    if (isTikTokGoPayload(raw)) {
      const res = await fetch(`/api/loyalty/tiktok-go${qs}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw, action: "query", locationId: form.locationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || t.goFailed);
        setGoVoucher(null);
      } else {
        setGoVoucher({
          title: data.title,
          detail: data.detail,
          shopOrderId: data.shopOrderId,
          codes: data.codes || [],
          locationId: data.locationId,
          locationName: data.locationName,
        });
        setMember(null);
        setTab("scan");
        void loadGoEvents();
      }
      setBusy(false);
      return;
    }
    setGoVoucher(null);
    const res = await fetch(`/api/loyalty/scan${qs}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || t.qrFailed);
      setMember(null);
    } else {
      setMsg(t.memberFound);
      applyMemberPayload(data);
      setTab("scan");
    }
    setBusy(false);
  }

  async function redeemGo() {
    if (!goVoucher) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/loyalty/tiktok-go${qs}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "redeem",
        locationId: goVoucher.locationId,
        shopOrderId: goVoucher.shopOrderId,
        codes: goVoucher.codes,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || t.goFailed);
    } else {
      setMsg(t.redeemGoOk.replace("{name}", goVoucher.locationName));
      setGoVoucher(null);
      void loadGoEvents();
    }
    setBusy(false);
  }

  const [birthdayCode, setBirthdayCode] = useState("");

  async function doRedeem(kind: "STAMP_CARD" | "TOP_SPENDER" | "BIRTHDAY", tierKey?: string) {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/loyalty/member${qs}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: lookup,
        kind,
        tierKey,
        locationId: form.locationId || undefined,
        voucherCode: kind === "BIRTHDAY" ? birthdayCode : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) setErr(data.error || "Redeem failed");
    else {
      setMsg("Redeemed — cannot be used again.");
      if (kind === "BIRTHDAY") setBirthdayCode("");
      await findMember({ preventDefault() {} } as React.FormEvent);
    }
    setBusy(false);
  }

  if (isAgency && !clientId) {
    return (
      <div className="an-section space-y-5">
        <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.pickBrand} />
        {brands.length === 0 ? (
          <p className="text-sm text-slate-500">{t.noBrands}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {brands.map((b) => (
              <Link
                key={b.id}
                href={`/loyalty?client=${b.id}`}
                className="an-card p-5 transition hover:ring-2 hover:ring-indigo-200"
              >
                <div className="font-semibold text-slate-900">{b.name}</div>
                <p className="mt-1 text-[11px] text-slate-400">{t.openBrand}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const stamp = member?.stamp as {
    count?: number;
    goal?: number;
    canRedeem?: boolean;
    full?: boolean;
    reward?: string;
    tiers?: { stamps: number; reward: string; canRedeem: boolean; claimed: boolean; isHighest: boolean }[];
  } | undefined;
  const membership = member?.membership as {
    life?: string;
    registered?: boolean;
    name?: string;
    birthdayWaOptIn?: boolean;
    birthday?: { enabled?: boolean; reward?: string; canRedeem?: boolean; inWindow?: boolean; redeemed?: boolean; waSent?: boolean };
  } | undefined;
  const spender = member?.spender as {
    enabled?: boolean;
    rank?: number | null;
    spend?: number;
    canRedeem?: boolean;
    periodKey?: string;
    reward?: string;
  } | undefined;
  const showReceipt = Boolean(membership?.registered && form.phone);

  return (
    <div className="an-section space-y-5">
      <PageHeader
        eyebrow={t.eyebrow}
        badge={t.badge}
        title={t.title}
        description={t.description}
        actions={
          <>
            <Link href={`/reports${qs}`} className="an-btn-ghost text-sm">
              {t.monthReport}
            </Link>
            <Link href={`/settings/chat-apps${qs}`} className="an-btn-ghost text-sm">
              {t.goConnect}
            </Link>
            <Link href="/demo/go" className="an-btn-ghost text-sm">
              {t.goPublicDemo}
            </Link>
          </>
        }
      />
      {isAgency && brands.length > 0 && (
        <label className="flex max-w-sm items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {t.brand}
          <select
            className="an-input flex-1 py-2 font-semibold normal-case tracking-normal"
            value={clientId || ""}
            onChange={(e) => {
              window.location.href = e.target.value ? `/loyalty?client=${e.target.value}` : "/loyalty";
            }}
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {err && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>}
      {msg && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{msg}</p>}

      {tab === "queue" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[#ffd6b3]/50 p-4 ring-1 ring-black/[0.04]">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink)]">{t.notMember}</p>
            <p className="mt-1 text-[13px] text-slate-600">{t.notMemberHint}</p>
          </div>
          <div className="rounded-2xl bg-[#b7e1ff]/50 p-4 ring-1 ring-black/[0.04]">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink)]">{t.isMember}</p>
            <p className="mt-1 text-[13px] text-slate-600">{t.isMemberHint}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? "an-chip-on" : "an-chip-off"} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "queue" && (
        <div className="an-card overflow-x-auto p-0">
          <table className="an-table">
            <thead>
              <tr>
                <th>{t.colOutlet}</th>
                <th>{t.colPhone}</th>
                <th>{t.colReceipt}</th>
                <th>{t.colRp}</th>
                <th>{t.colPhoto}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {intakes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                    {t.queueEmpty}
                  </td>
                </tr>
              ) : (
                intakes.map((row) => (
                  <tr key={row.id}>
                    <td>{row.location.name}</td>
                    <td className="font-mono text-xs">{row.phone}</td>
                    <td className="font-mono text-xs">{row.trxId}</td>
                    <td>{row.amount != null ? row.amount.toLocaleString("id-ID") : "—"}</td>
                    <td>
                      <MatchBadge status={row.matchStatus} t={t} />
                      {row.hasPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={t.photoAlt}
                          className="mt-1 h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200"
                          src={`/api/loyalty/intakes/${row.id}/photo${qs}`}
                        />
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                      {row.matchStatus === "MISMATCH" && row.ocrAmount != null ? (
                        <p className="mt-1 text-[10px] text-amber-800">
                          {t.photoRp} {row.ocrAmount.toLocaleString("id-ID")}
                        </p>
                      ) : null}
                    </td>
                    <td className="text-right">
                      {canReview ? (
                        <>
                          <button type="button" className="an-btn-primary mr-2 text-xs" disabled={busy} onClick={() => void review(row.id, "approve")}>
                            {t.approve}
                          </button>
                          <button type="button" className="an-btn-ghost text-xs" disabled={busy} onClick={() => void review(row.id, "reject")}>
                            {t.reject}
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400">{t.hqStamps}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "submit" && (
        <form className="an-card mx-auto max-w-xl space-y-3 p-5 sm:p-6" onSubmit={(e) => void submit(e)}>
          <OutletField
            locations={locations}
            form={form}
            setForm={setForm}
            t={t}
            outletsHref={clientId ? `/locations?client=${encodeURIComponent(clientId)}` : "/locations"}
          />
          <label className="block text-[10px] font-bold uppercase text-slate-400">
            {t.phoneMember}
            <input className="an-input mt-1 w-full py-2" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
          </label>
          <ReceiptNosInputs form={form} setForm={setForm} t={t} />
          <label className="block text-[10px] font-bold uppercase text-slate-400">
            {t.amount}
            <input className="an-input mt-1 w-full py-2" inputMode="numeric" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </label>
          <PhotoField photo={photo} setPhoto={setPhoto} t={t} />
          <button type="submit" className="an-btn-primary w-full justify-center text-sm sm:w-auto" disabled={busy || locations.length === 0}>
            {busy ? t.reading : t.sendReceipt}
          </button>
        </form>
      )}

      {tab === "member" && (
        <div className="mx-auto w-full max-w-xl space-y-4">
          <div className="an-card space-y-3 p-5 sm:p-6">
            <p className="text-sm font-semibold text-slate-900">{t.checkPhoneTitle}</p>
            <p className="text-[13px] leading-relaxed text-slate-500">{t.checkPhoneHint}</p>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => void findMember(e)}>
              <input
                className="an-input flex-1 py-2.5 font-mono text-[15px]"
                placeholder={t.phoneMember}
                value={lookup}
                inputMode="tel"
                autoComplete="tel"
                onChange={(e) => setLookup(e.target.value)}
              />
              <button type="submit" className="an-btn-primary justify-center px-5 py-2.5 text-sm sm:w-auto" disabled={busy}>
                {t.check}
              </button>
            </form>
          </div>
          {!membership ? <p className="px-1 text-[13px] text-slate-400">{t.checkEmpty}</p> : null}
          <MemberStatus membership={membership} stamp={stamp} spender={spender} lookup={lookup} busy={busy} onRedeem={doRedeem} t={t} birthdayCode={birthdayCode} onBirthdayCode={setBirthdayCode} />
          {showReceipt ? (
            <TillReceiptForm
              locations={locations}
              form={form}
              setForm={setForm}
              photo={photo}
              setPhoto={setPhoto}
              busy={busy}
              onSubmit={submit}
              t={t}
              outletsHref={clientId ? `/locations?client=${encodeURIComponent(clientId)}` : "/locations"}
            />
          ) : null}
        </div>
      )}

      {tab === "scan" && (
        <div className="mx-auto w-full max-w-xl space-y-4">
          <div className="an-card space-y-3 p-5">
            <p className="text-sm font-semibold text-slate-900">{t.scanTitle}</p>
            <p className="text-[13px] leading-relaxed text-slate-600">{t.scanHint}</p>
            {locations.length > 1 ? (
              <select
                className="an-input py-2 text-sm"
                value={form.locationId}
                onChange={(e) => setForm({ ...form, locationId: e.target.value })}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            ) : null}
            <StampQrScan busy={busy} onDecoded={(raw) => void scanRaw(raw)} />
            <p className="text-[12px] leading-relaxed text-slate-500">{t.goSample}</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["TT-DEMO-OK", t.goChipOk],
                  ["TT-DEMO-WRONG", t.goChipWrong],
                  ["TT-DEMO-USED", t.goChipUsed],
                  ["TT-DEMO-TIME", t.goChipTime],
                ] as const
              ).map(([payload, label]) => (
                <button
                  key={payload}
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700"
                  disabled={busy}
                  onClick={() => void scanRaw(payload)}
                >
                  {label}
                </button>
              ))}
            </div>
            {goVoucher ? (
              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{goVoucher.title}</p>
                <p className="mt-1 text-[13px] text-slate-600">{goVoucher.detail}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {t.outlet}: {goVoucher.locationName} · {t.notStampCard}
                </p>
                <button
                  type="button"
                  className="an-btn-primary mt-3 text-sm"
                  disabled={busy}
                  onClick={() => void redeemGo()}
                >
                  {t.redeemGo}
                </button>
              </div>
            ) : null}
            <details className="text-[13px] text-slate-500">
              <summary className="cursor-pointer select-none text-[12px] font-medium text-slate-500">{t.pasteLink}</summary>
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (paste.trim()) void scanRaw(paste.trim());
                }}
              >
                <input
                  className="an-input flex-1 py-2"
                  placeholder="https://atlasnow.co/c/…"
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                />
                <button type="submit" className="an-btn-ghost text-sm" disabled={busy || !paste.trim()}>
                  {t.open}
                </button>
              </form>
            </details>
          </div>
          <MemberStatus membership={membership} stamp={stamp} spender={spender} lookup={lookup} busy={busy} onRedeem={doRedeem} t={t} birthdayCode={birthdayCode} onBirthdayCode={setBirthdayCode} />
          {showReceipt ? (
            <TillReceiptForm
              locations={locations}
              form={form}
              setForm={setForm}
              photo={photo}
              setPhoto={setPhoto}
              busy={busy}
              onSubmit={submit}
              t={t}
              outletsHref={clientId ? `/locations?client=${encodeURIComponent(clientId)}` : "/locations"}
            />
          ) : null}
          <div className="an-card p-5">
            <p className="text-sm font-semibold text-slate-900">{t.goRecap}</p>
            {goEvents.length === 0 ? (
              <p className="mt-2 text-[13px] text-slate-500">{t.goRecapEmpty}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {goEvents.slice(0, 12).map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 text-[13px]">
                    <div>
                      <span className="font-semibold text-slate-800">{e.title}</span>
                      <span className="text-slate-400"> · {e.outlet}</span>
                      <div className="text-[11px] text-slate-500">
                        {e.kind}
                        {e.demo ? " · demo" : ""} · {e.detail}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {new Date(e.at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type TillForm = {
  locationId: string;
  phone: string;
  amount: string;
  trxId: string;
};

function OutletField({
  locations,
  form,
  setForm,
  t,
  outletsHref,
}: {
  locations: Loc[];
  form: TillForm;
  setForm: React.Dispatch<React.SetStateAction<TillForm>>;
  t: T;
  outletsHref: string;
}) {
  if (locations.length === 0) {
    return (
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
        {t.noOutlet}{" "}
        <Link href={outletsHref} className="font-semibold underline">
          {t.noOutletLink}
        </Link>
      </p>
    );
  }
  if (locations.length === 1) {
    return (
      <p className="text-[13px] text-slate-600">
        {t.outlet}: <span className="font-semibold text-slate-900">{locations[0].name}</span>
      </p>
    );
  }
  return (
    <label className="block text-[10px] font-bold uppercase text-slate-400">
      {t.outlet}
      <select className="an-input mt-1 w-full py-2" value={form.locationId} onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function TillReceiptForm({
  locations,
  form,
  setForm,
  photo,
  setPhoto,
  busy,
  onSubmit,
  t,
  outletsHref,
}: {
  locations: Loc[];
  form: TillForm;
  setForm: React.Dispatch<React.SetStateAction<TillForm>>;
  photo: File | null;
  setPhoto: (f: File | null) => void;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
  t: T;
  outletsHref: string;
}) {
  const blocked = locations.length === 0;
  return (
    <form className="an-card space-y-3 p-5 sm:p-6" onSubmit={(e) => void onSubmit(e)}>
      <p className="text-sm font-semibold text-slate-900">{t.fillReceipt}</p>
      <OutletField locations={locations} form={form} setForm={setForm} t={t} outletsHref={outletsHref} />
      <ReceiptNosInputs form={form} setForm={setForm} t={t} />
      <label className="block text-[10px] font-bold uppercase text-slate-400">
        {t.amount}
        <input className="an-input mt-1 w-full py-2" inputMode="numeric" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} disabled={blocked} />
      </label>
      <PhotoField photo={photo} setPhoto={setPhoto} t={t} />
      <button type="submit" className="an-btn-primary w-full justify-center text-sm sm:w-auto" disabled={busy || blocked}>
        {busy ? t.reading : t.sendReceipt}
      </button>
    </form>
  );
}

function PhotoField({ photo, setPhoto, t }: { photo: File | null; setPhoto: (f: File | null) => void; t: T }) {
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase text-slate-400">{t.photoRequiredLabel}</p>
      <label className="flex cursor-pointer flex-col items-start gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm transition hover:border-[#6fd6f6] hover:bg-[#eef8ff]">
        <span className="an-btn-ghost pointer-events-none">{photo ? t.changePhoto : t.takePhoto}</span>
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
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={t.photoAlt} className="h-36 w-36 rounded-xl object-cover ring-1 ring-slate-200" src={preview} />
        ) : (
          <span className="text-[12px] text-slate-400">{t.photoHint}</span>
        )}
      </label>
    </div>
  );
}

function MatchBadge({ status, t }: { status?: string; t: T }) {
  if (status === "MATCH") return <p className="text-[10px] font-bold uppercase text-emerald-700">{t.match}</p>;
  if (status === "MISMATCH") return <p className="text-[10px] font-bold uppercase text-amber-800">{t.mismatch}</p>;
  if (status === "UNREADABLE") return <p className="text-[10px] font-bold uppercase text-slate-500">{t.unreadable}</p>;
  return null;
}

function MemberStatus({
  membership,
  stamp,
  spender,
  lookup,
  busy,
  onRedeem,
  t,
  birthdayCode,
  onBirthdayCode,
}: {
  membership:
    | {
        life?: string;
        registered?: boolean;
        name?: string;
        birthdayWaOptIn?: boolean;
        birthday?: {
          enabled?: boolean;
          reward?: string;
          canRedeem?: boolean;
          inWindow?: boolean;
          redeemed?: boolean;
          waSent?: boolean;
        };
      }
    | undefined;
  stamp:
    | {
        count?: number;
        goal?: number;
        canRedeem?: boolean;
        reward?: string;
        tiers?: { stamps: number; reward: string; canRedeem: boolean; claimed: boolean; isHighest: boolean }[];
      }
    | undefined;
  spender:
    | {
        enabled?: boolean;
        rank?: number | null;
        spend?: number;
        canRedeem?: boolean;
        periodKey?: string;
        reward?: string;
      }
    | undefined;
  lookup: string;
  busy: boolean;
  onRedeem: (kind: "STAMP_CARD" | "TOP_SPENDER" | "BIRTHDAY", tierKey?: string) => void;
  t: T;
  birthdayCode: string;
  onBirthdayCode: (v: string) => void;
}) {
  if (!membership) return null;
  const life = membership.life || "none";
  const lifeLabel = life === "aktif" ? t.lifeMember : life === "calon" ? t.lifeProspect : t.lifeNone;
  const initials = (membership.name || lookup || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  const bday = membership.birthday;
  let birthdayHint = t.birthdayOff;
  if (bday?.enabled) {
    if (bday.redeemed) birthdayHint = t.birthdayRedeemed;
    else if (life !== "aktif") birthdayHint = t.birthdayWaitMember;
    else if (!bday.inWindow) birthdayHint = t.birthdayWaitWindow;
    else if (!bday.waSent) birthdayHint = t.birthdayNeedWa;
    else birthdayHint = t.birthdayReady;
  }
  const showBirthdayBox = Boolean(bday?.enabled && bday.canRedeem && bday.waSent);
  const count = stamp?.count || 0;
  const goal = stamp?.goal || 0;
  const pct = goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;

  return (
    <>
      <div className="an-card space-y-3 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef8ff] text-sm font-bold text-[#2a9bb8]">
            {initials || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold tracking-tight text-slate-900">{membership.name || lookup}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  life === "aktif" ? "bg-[#c5f0c1] text-slate-800" : "bg-[#ffd6b3] text-slate-800"
                }`}
              >
                {lifeLabel}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[12px] text-slate-400">{lookup}</p>
            {membership.registered && membership.birthdayWaOptIn ? (
              <p className="mt-1 text-[12px] text-slate-500">{t.waBirthdayYes}</p>
            ) : !membership.registered ? (
              <p className="mt-1 text-[12px] text-slate-500">{t.notMemberHint}</p>
            ) : null}
          </div>
        </div>
        {life !== "aktif" && membership.registered ? (
          <p className="rounded-xl bg-[#ffd6b3]/40 px-3 py-2 text-[13px] leading-relaxed text-slate-700">{t.nextProspect}</p>
        ) : null}

        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t.birthdayTitle}</p>
          {bday?.enabled && bday.reward ? (
            <p className="mt-1 text-sm font-semibold text-slate-900">{bday.reward}</p>
          ) : null}
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{birthdayHint}</p>
          {showBirthdayBox ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                className="an-input w-40 py-2 font-mono uppercase"
                placeholder={t.birthdayCodePh}
                value={birthdayCode}
                onChange={(e) => onBirthdayCode(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className="an-btn-primary text-sm"
                disabled={busy || !birthdayCode.trim()}
                onClick={() => void onRedeem("BIRTHDAY")}
              >
                {t.redeemBirthday}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {stamp ? (
        <div className="an-card space-y-3 p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">{t.stampTitle}</p>
            <p className="font-mono text-sm tabular-nums text-slate-500">
              {count}/{goal}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[#7ee5d6]" style={{ width: `${pct}%` }} />
          </div>
          {(stamp.tiers && stamp.tiers.length > 0
            ? stamp.tiers
            : [{ stamps: stamp.goal || 0, reward: stamp.reward || "", canRedeem: !!stamp.canRedeem, claimed: false, isHighest: true }]
          ).map((tier) => (
            <div key={tier.stamps} className="flex items-center justify-between gap-2 text-[13px] text-slate-600">
              <span>
                {tier.stamps} · {tier.reward || t.giftInSettings}
                {tier.claimed ? " · already redeemed" : ""}
              </span>
              {tier.canRedeem && (
                <button type="button" className="an-btn-primary shrink-0 text-xs" disabled={busy} onClick={() => void onRedeem("STAMP_CARD", String(tier.stamps))}>
                  Redeem
                </button>
              )}
            </div>
          ))}
          {stamp.tiers && stamp.tiers.filter((tier) => tier.canRedeem).length > 1 && (
            <p className="text-[11px] text-slate-400">Redeem the smaller gift first. The card empties only after the highest stamp gift.</p>
          )}
        </div>
      ) : null}
      {spender?.enabled !== false && spender ? (
        <div className="an-card space-y-2 p-5 text-sm">
          <p className="font-semibold">Top spender {spender.periodKey}</p>
          <p className="text-xs text-slate-500">
            Rank {spender.rank ?? "—"} · Rp {(spender.spend || 0).toLocaleString("id-ID")}
          </p>
          {spender.canRedeem && (
            <button type="button" className="an-btn-primary text-xs" disabled={busy} onClick={() => void onRedeem("TOP_SPENDER")}>
              Redeem spender
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}

function ReceiptNosInputs({
  form,
  setForm,
  t,
}: {
  form: TillForm;
  setForm: React.Dispatch<React.SetStateAction<TillForm>>;
  t: T;
}) {
  return (
    <label className="block text-[10px] font-bold uppercase text-slate-400">
      {t.receiptNos}
      <input
        className="an-input mt-1 w-full py-2"
        value={form.trxId}
        onChange={(e) => setForm((f) => ({ ...f, trxId: e.target.value }))}
        autoComplete="off"
        required
      />
      <span className="mt-1 block text-[11px] font-normal normal-case leading-relaxed text-slate-400">
        {t.receiptNosHint}
      </span>
    </label>
  );
}
