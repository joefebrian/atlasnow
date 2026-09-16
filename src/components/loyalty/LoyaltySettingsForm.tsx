"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { DEFAULT_WA_REPLIES, type WaReplyCopy } from "@/lib/loyalty/rules";
import { previewBirthdayVoucherCode } from "@/lib/loyalty/birthday-template";
import {
  countEarnPrograms,
  earnExclusiveMessage,
} from "@/lib/loyalty/earn-exclusive";

type StampTier = { stamps: number; reward: string };
type SpenderTier = { rank: number; reward: string };
type Tab = "qr" | "birthday" | "stamp" | "points" | "spender";

type Program = {
  stampEnabled: boolean;
  stampMinAmount: number;
  stampExpiry: string;
  stampTiers: StampTier[];
  pointEnabled: boolean;
  pointUnitRupiah: number;
  pointPerUnit: number;
  spenderEnabled: boolean;
  spenderScope: string;
  spenderMinAmount: number;
  spenderTiers: SpenderTier[];
  qrScope: string;
  birthdayEnabled: boolean;
  birthdayRewardText: string;
  birthdayVoucherPrefix: string;
  birthdayVoucherYear: boolean;
  birthdayVoucherSuffixLen: number;
  waReplies: WaReplyCopy;
  hasStampCardImage?: boolean;
  joinUrl?: string;
  joinKey?: string;
  receiptAuditMode?: boolean;
  guestReceiptUpload?: boolean;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "qr", label: "Membership QR" },
  { id: "birthday", label: "Birthday gift" },
  { id: "stamp", label: "Stamp card" },
  { id: "points", label: "Points" },
  { id: "spender", label: "Top spender" },
];

export function LoyaltySettingsForm({
  isAgency,
  isPlatformAdmin = false,
  brands,
  clientId,
  initialTab,
}: {
  isAgency: boolean;
  isPlatformAdmin?: boolean;
  brands: { id: string; name: string }[];
  clientId: string | null;
  initialTab?: string;
}) {
  const router = useRouter();
  const qs = clientId ? `?client=${encodeURIComponent(clientId)}` : "";
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.id === initialTab) ? (initialTab as Tab) : "qr"
  );
  const [form, setForm] = useState<Program | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [qrOutlet, setQrOutlet] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  function goBrand(nextClient: string | null) {
    const p = new URLSearchParams();
    if (nextClient) p.set("client", nextClient);
    p.set("tab", tab);
    router.replace(`/settings/loyalty?${p.toString()}`);
  }

  function goTab(nextTab: Tab) {
    setTab(nextTab);
    const p = new URLSearchParams();
    if (clientId) p.set("client", clientId);
    p.set("tab", nextTab);
    window.history.replaceState(null, "", `/settings/loyalty?${p.toString()}`);
  }

  function joinQrUrls() {
    const p = new URLSearchParams();
    if (clientId) p.set("client", clientId);
    if (form?.qrScope === "LOCATION" && qrOutlet) p.set("outlet", qrOutlet);
    const src = `/api/loyalty/qr?${p.toString()}`;
    p.set("download", "1");
    const brand = brands.find((b) => b.id === clientId)?.name || "join";
    const file = `${brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "join"}-join-qr.png`;
    return { src, dl: `/api/loyalty/qr?${p.toString()}`, file };
  }

  const load = useCallback(async () => {
    if (isAgency && !clientId) {
      setForm(null);
      return;
    }
    const res = await fetch(`/api/loyalty/program${qs}`, { credentials: "same-origin" });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Could not load");
      setForm(null);
      return;
    }
    setErr(null);
    const p = data.program as Program & {
      stampGoal?: number;
      stampRewardText?: string;
      spenderTopN?: number;
      spenderRewardText?: string;
    };
    setLocations((data.locations as { id: string; name: string }[]) || []);
    setForm({
      stampEnabled: p.stampEnabled,
      stampMinAmount: p.stampMinAmount,
      stampExpiry: p.stampExpiry,
      stampTiers: p.stampTiers?.length
        ? p.stampTiers
        : [{ stamps: p.stampGoal || 10, reward: p.stampRewardText || "" }],
      pointEnabled: Boolean(p.pointEnabled),
      pointUnitRupiah: p.pointUnitRupiah || 100000,
      pointPerUnit: p.pointPerUnit || 1000,
      spenderEnabled: p.spenderEnabled,
      spenderScope: p.spenderScope,
      spenderMinAmount: p.spenderMinAmount,
      spenderTiers: p.spenderTiers?.length
        ? p.spenderTiers
        : [{ rank: 1, reward: p.spenderRewardText || "" }],
      qrScope: p.qrScope || "BRAND",
      birthdayEnabled: Boolean(p.birthdayEnabled),
      birthdayRewardText: p.birthdayRewardText || "",
      birthdayVoucherPrefix: p.birthdayVoucherPrefix || "BDY",
      birthdayVoucherYear: p.birthdayVoucherYear !== false,
      birthdayVoucherSuffixLen: p.birthdayVoucherSuffixLen || 4,
      waReplies: { ...DEFAULT_WA_REPLIES, ...(p as Program).waReplies },
      hasStampCardImage: Boolean((p as Program).hasStampCardImage),
      joinUrl: p.joinUrl,
      joinKey: p.joinKey,
      receiptAuditMode: Boolean((p as Program).receiptAuditMode),
      guestReceiptUpload: Boolean((p as Program).guestReceiptUpload),
    });
    setPreviewKey((n) => n + 1);
  }, [qs, isAgency, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setErr(null);
    if (countEarnPrograms(form) > 1) {
      setErr(earnExclusiveMessage("en"));
      setBusy(false);
      return;
    }
    const res = await fetch(`/api/loyalty/program${qs}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(
        data.code === "earn_exclusive" ? earnExclusiveMessage("en") : data.error || "Save failed"
      );
    }
    else {
      const p = data.program as Program;
      setForm({
        ...form,
        stampTiers: p.stampTiers?.length ? p.stampTiers : form.stampTiers,
        spenderTiers: p.spenderTiers?.length ? p.spenderTiers : form.spenderTiers,
        waReplies: p.waReplies || form.waReplies,
      });
      setMsg("Saved.");
    }
    setBusy(false);
  }

  async function uploadCard(file: File) {
    setCardBusy(true);
    setErr(null);
    const data = new FormData();
    data.append("file", file);
    const res = await fetch(`/api/loyalty/program/image${qs}`, {
      method: "POST",
      credentials: "same-origin",
      body: data,
    });
    const json = await res.json().catch(() => ({}));
    setCardBusy(false);
    if (!res.ok) {
      setErr(
        json.error === "image_too_large"
          ? "Image too large (max ~1.8 MB)."
          : json.error === "image_type"
            ? "Use JPG, PNG, or WebP."
            : json.error || "Upload failed"
      );
      return;
    }
    setForm((f) => (f ? { ...f, hasStampCardImage: true } : f));
    setPreviewKey((n) => n + 1);
    setMsg("Logo saved. Status Stamp will send this card.");
  }

  const qr = joinQrUrls();

  return (
    <div className="an-section max-w-5xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          eyebrow="Loyalty"
          title="Program settings"
          description="Stamp, points, and top spender: tick only one, then Save. Birthday can stay on."
        />
        {isAgency && (
          <label className="block shrink-0 text-[10px] font-bold uppercase text-slate-400 sm:min-w-[16rem] sm:pt-1">
            Brand
            <select
              className="an-input mt-1 w-full py-2 font-normal normal-case tracking-normal"
              value={clientId || ""}
              onChange={(e) => goBrand(e.target.value || null)}
            >
              <option value="">Select brand…</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {err && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>
      )}
      {msg && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{msg}</p>
      )}
      {isAgency && !clientId && (
        <p className="text-sm text-slate-500">Pick a brand (top right) to edit that merk’s program.</p>
      )}

      {form && (
        <form className="space-y-4" onSubmit={(e) => void save(e)}>
          <nav className="flex flex-wrap gap-2">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goTab(item.id)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                  tab === item.id
                    ? "bg-[var(--ink)] text-white shadow-sm"
                    : "bg-white text-slate-600 ring-1 ring-slate-200/90 hover:bg-[#eef8ff]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <p className="text-[12px] leading-relaxed text-slate-500">
            Tick stamp, points, or top spender — not two. Checkboxes stay. Save fails if more than one
            earn program is on. Birthday is separate.
          </p>

          {tab === "qr" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <fieldset className="an-card space-y-3 p-5">
                <p className="text-sm font-semibold">Join QR (daftar only)</p>
                <label className="block text-[10px] font-bold uppercase text-slate-400">
                  QR scope
                  <select
                    className="an-input mt-1 w-full py-2"
                    value={form.qrScope}
                    onChange={(e) => setForm({ ...form, qrScope: e.target.value })}
                  >
                    <option value="BRAND">One QR for the whole brand</option>
                    <option value="LOCATION">One QR per outlet</option>
                  </select>
                </label>
                {form.qrScope === "LOCATION" && (
                  <label className="block text-[10px] font-bold uppercase text-slate-400">
                    Print QR for outlet
                    <select
                      className="an-input mt-1 w-full py-2"
                      value={qrOutlet}
                      onChange={(e) => setQrOutlet(e.target.value)}
                    >
                      <option value="">Select outlet…</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="text-[11px] text-slate-400">
                  Poster meja = daftar. Never a stamp. Kasir tanya membership dulu.
                </p>
              </fieldset>
              <div className="an-card space-y-3 p-5">
                {form.joinUrl && (form.qrScope === "BRAND" || qrOutlet) ? (
                  <>
                    <img
                      alt="Membership QR"
                      className="h-44 w-44 rounded-xl border border-slate-200 bg-white p-2"
                      src={qr.src}
                    />
                    <p className="break-all text-[11px] text-slate-500">
                      {form.joinUrl}
                      {form.qrScope === "LOCATION" && qrOutlet ? `?outlet=${qrOutlet}` : ""}
                    </p>
                    <a className="an-btn-primary inline-flex text-sm" href={qr.dl} download={qr.file}>
                      Download QR
                    </a>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Select an outlet to preview the QR.</p>
                )}
              </div>
            </div>
          )}

          {tab === "birthday" && (
            <fieldset className="an-card grid gap-4 p-5 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={form.birthdayEnabled}
                    onChange={(e) => setForm({ ...form, birthdayEnabled: e.target.checked })}
                  />
                  Birthday gift on
                </label>
                <label className="block text-[10px] font-bold uppercase text-slate-400">
                  Reward
                  <input
                    className="an-input mt-1 w-full py-2"
                    value={form.birthdayRewardText}
                    onChange={(e) => setForm({ ...form, birthdayRewardText: e.target.value })}
                    placeholder="100.000"
                  />
                </label>
                <label className="block text-[10px] font-bold uppercase text-slate-400">
                  Code prefix
                  <input
                    className="an-input mt-1 w-full py-2 font-mono uppercase"
                    value={form.birthdayVoucherPrefix}
                    maxLength={8}
                    onChange={(e) => setForm({ ...form, birthdayVoucherPrefix: e.target.value.toUpperCase() })}
                    placeholder="BDY"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.birthdayVoucherYear}
                    onChange={(e) => setForm({ ...form, birthdayVoucherYear: e.target.checked })}
                  />
                  Include year (26)
                </label>
                <label className="block text-[10px] font-bold uppercase text-slate-400">
                  Random length
                  <select
                    className="an-input mt-1 w-full py-2"
                    value={form.birthdayVoucherSuffixLen}
                    onChange={(e) => setForm({ ...form, birthdayVoucherSuffixLen: Number(e.target.value) })}
                  >
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                    <option value={6}>6</option>
                  </select>
                </label>
                <p className="rounded-xl bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700">
                  {previewBirthdayVoucherCode({
                    prefix: form.birthdayVoucherPrefix,
                    includeYear: form.birthdayVoucherYear,
                    suffixLen: form.birthdayVoucherSuffixLen,
                  })}
                </p>
              </div>
              <p className="text-[13px] leading-relaxed text-slate-500">
                Birthday gift at the till, once a year, after membership is aktif. Reward ={" "}
                <code>{"{{voucher_number}}"}</code>. Prefix / year / length = how Atlas builds{" "}
                <code>{"{{code_voucher}}"}</code> (new sends only). Kasir must type that WhatsApp code to Redeem — it then
                shows on the monthly report. Same template body every brand; each WABA still needs Meta APPROVED.
              </p>
              {isPlatformAdmin && clientId ? (
                <button
                  type="button"
                  className="an-btn-ghost text-sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setErr(null);
                    setMsg(null);
                    try {
                      const res = await fetch("/api/loyalty/birthday-h2", {
                        method: "POST",
                        credentials: "same-origin",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ client: clientId }),
                      });
                      const json = (await res.json()) as {
                        error?: string;
                        tenants?: { sent?: number; failed?: number; skipped?: number; reason?: string }[];
                      };
                      if (!res.ok) {
                        setErr(json.error || "H-2 run failed");
                        return;
                      }
                      const row = json.tenants?.[0];
                      setMsg(
                        `H-2: sent ${row?.sent ?? 0}, failed ${row?.failed ?? 0}, skipped ${row?.skipped ?? 0}${
                          row?.reason ? ` (${row.reason})` : ""
                        }`
                      );
                    } catch {
                      setErr("Network error");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Send H-2 notes now
                </button>
              ) : null}
            </fieldset>
          )}

          {tab === "stamp" && (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <fieldset className="an-card space-y-3 p-5">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={form.stampEnabled}
                      onChange={(e) => setForm({ ...form, stampEnabled: e.target.checked })}
                    />
                    Stamp card on
                  </label>
                  <label className="block text-[10px] font-bold uppercase text-slate-400">
                    Min spend per receipt (Rp)
                    <input
                      className="an-input mt-1 w-full py-2"
                      type="number"
                      min={0}
                      value={form.stampMinAmount}
                      onChange={(e) => setForm({ ...form, stampMinAmount: Number(e.target.value) })}
                    />
                  </label>
                  <p className="text-[11px] text-slate-500">0 = even a small coffee counts. First valid receipt activates membership.</p>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(form.receiptAuditMode)}
                      onChange={(e) => setForm({ ...form, receiptAuditMode: e.target.checked })}
                    />
                    <span>
                      Kantor cek semua
                      <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                        Matikan auto-stamp. Foto tetap wajib. HQ Approve tiap struk — preventive, antrian bisa penuh.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(form.guestReceiptUpload)}
                      onChange={(e) => setForm({ ...form, guestReceiptUpload: e.target.checked })}
                    />
                    <span>
                      Tamu boleh kirim struk dari kartu
                      <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                        Tombol di kartu stamp HP. HP dari kartu, bukan ketik. Sama: foto + nomor + Rp. Lebih gampang palsu — unique nomor + audit tetap rem.
                      </span>
                    </span>
                  </label>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Rewards</p>
                    <p className="mt-1 text-[11px] text-slate-500">5 → kopi, 10 → tumbler. Highest gift empties the card.</p>
                    <div className="mt-2 space-y-2">
                      {form.stampTiers.map((row, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            className="an-input w-20 py-2"
                            type="number"
                            min={1}
                            aria-label={`Stamps for reward ${i + 1}`}
                            value={row.stamps}
                            onChange={(e) => {
                              const stampTiers = form.stampTiers.slice();
                              stampTiers[i] = { ...row, stamps: Number(e.target.value) };
                              setForm({ ...form, stampTiers });
                            }}
                          />
                          <input
                            className="an-input min-w-0 flex-1 py-2"
                            placeholder="Gratis 1 es kopi"
                            value={row.reward}
                            onChange={(e) => {
                              const stampTiers = form.stampTiers.slice();
                              stampTiers[i] = { ...row, reward: e.target.value };
                              setForm({ ...form, stampTiers });
                            }}
                          />
                          {form.stampTiers.length > 1 && (
                            <button
                              type="button"
                              className="an-btn-ghost px-2 text-xs"
                              onClick={() =>
                                setForm({ ...form, stampTiers: form.stampTiers.filter((_, j) => j !== i) })
                              }
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {form.stampTiers.length < 8 && (
                      <button
                        type="button"
                        className="mt-2 text-xs font-semibold text-indigo-600"
                        onClick={() => {
                          const last = form.stampTiers[form.stampTiers.length - 1]?.stamps || 0;
                          setForm({ ...form, stampTiers: [...form.stampTiers, { stamps: last + 5, reward: "" }] });
                        }}
                      >
                        + Add stamp reward
                      </button>
                    )}
                  </div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400">
                    Card expiry
                    <select
                      className="an-input mt-1 w-full py-2"
                      value={form.stampExpiry}
                      onChange={(e) => setForm({ ...form, stampExpiry: e.target.value })}
                    >
                      <option value="lifetime">Lifetime until highest gift is redeemed</option>
                      <option value="years_1">1 year from first stamp</option>
                      <option value="years_2">2 years from first stamp</option>
                    </select>
                  </label>
                </fieldset>

                <fieldset className="an-card space-y-3 p-5">
                  <p className="text-sm font-semibold">Card image (one logo)</p>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Upload the <span className="font-semibold">brand mark only</span> — not a finished poster. Atlas puts it on the card and writes the live count (3 / 10) at the bottom.
                  </p>
                  <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-500">
                    <li>Square PNG, transparent or solid background</li>
                    <li>
                      <span className="font-semibold">1080 × 1080 px</span> (min 512 × 512)
                    </li>
                    <li>Max 1.5 MB · JPG / PNG / WebP</li>
                    <li>Example for P2P Labs: AtlasNow logo (`/brand/atlasnow_logo.png`)</li>
                  </ul>
                  <img
                    alt="Preview kartu stamp"
                    className="h-64 w-auto max-w-full rounded-2xl border border-slate-200 bg-[#1f1b1d] object-contain"
                    src={`/api/loyalty/program/preview-card${qs}${qs ? "&" : "?"}n=3&v=${previewKey}`}
                  />
                  <div className="flex flex-wrap gap-2">
                    <label className="an-btn-ghost cursor-pointer text-sm">
                      {cardBusy ? "…" : form.hasStampCardImage ? "Replace logo" : "Upload logo"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={cardBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void uploadCard(file);
                        }}
                      />
                    </label>
                    {form.hasStampCardImage && (
                      <button
                        type="button"
                        className="an-btn-ghost text-sm"
                        disabled={cardBusy}
                        onClick={async () => {
                          setCardBusy(true);
                          await fetch(`/api/loyalty/program/image${qs}`, {
                            method: "DELETE",
                            credentials: "same-origin",
                          });
                          setCardBusy(false);
                          setForm({ ...form, hasStampCardImage: false });
                          setPreviewKey((n) => n + 1);
                        }}
                      >
                        Use default card
                      </button>
                    )}
                  </div>
                </fieldset>
              </div>

              <fieldset className="an-card space-y-3 p-5">
                <p className="text-sm font-semibold">WhatsApp HQ auto-reply</p>
                <p className="text-[11px] text-slate-500">
                  <span className="font-semibold">Stamp</span> = menu poin.{" "}
                  <span className="font-semibold">Status Stamp</span> = kartu + gambar. Keep {"{count}"} {"{goal}"}.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["stampMenu", "When they type Stamp", "Menu / poin. {stamp_off} inserts the off text."],
                      ["stampOff", "Stamp program off", "If Stamp card is not turned on."],
                      ["stampExpired", "Card expired", "After hangus."],
                      ["stampProgress", "Card in progress", "Has stamps, no gift ready."],
                      ["stampClaim", "Gift ready", "Tell them to show the cashier."],
                      ["stampDone", "Card complete", "Goal reached."],
                    ] as const
                  ).map(([key, label, help]) => (
                    <label key={key} className="block text-[10px] font-bold uppercase text-slate-400">
                      {label}
                      <textarea
                        className="an-input mt-1 min-h-[88px] w-full py-2 text-[13px] font-normal normal-case tracking-normal"
                        value={form.waReplies[key]}
                        onChange={(e) =>
                          setForm({ ...form, waReplies: { ...form.waReplies, [key]: e.target.value } })
                        }
                        placeholder={DEFAULT_WA_REPLIES[key]}
                      />
                      <span className="mt-0.5 block text-[11px] font-normal normal-case tracking-normal text-slate-400">
                        {help}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {tab === "points" && (
            <fieldset className="an-card grid gap-4 p-5 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={form.pointEnabled}
                    onChange={(e) => setForm({ ...form, pointEnabled: e.target.checked })}
                  />
                  Points on
                </label>
                <label className="block text-[10px] font-bold uppercase text-slate-400">
                  Every Rp
                  <input
                    className="an-input mt-1 w-full py-2"
                    type="number"
                    min={1}
                    value={form.pointUnitRupiah}
                    onChange={(e) => setForm({ ...form, pointUnitRupiah: Number(e.target.value) })}
                  />
                </label>
                <label className="block text-[10px] font-bold uppercase text-slate-400">
                  Gives points
                  <input
                    className="an-input mt-1 w-full py-2"
                    type="number"
                    min={1}
                    value={form.pointPerUnit}
                    onChange={(e) => setForm({ ...form, pointPerUnit: Number(e.target.value) })}
                  />
                </label>
                <p className="text-[12px] leading-relaxed text-slate-500">
                  Example: every Rp {form.pointUnitRupiah.toLocaleString("id-ID")} →{" "}
                  {form.pointPerUnit.toLocaleString("id-ID")} points. Remainder does not round up.
                  Gift rows and cashier redeem come next.
                </p>
              </div>
              <p className="text-[13px] leading-relaxed text-slate-500">
                Same valid receipt as stamp (photo + unique number). Cannot be on together with stamp
                or top spender — Save will fail. Frozen points stay redeemable after you switch.
              </p>
            </fieldset>
          )}

          {tab === "spender" && (
            <fieldset className="an-card grid gap-4 p-5 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={form.spenderEnabled}
                    onChange={(e) => setForm({ ...form, spenderEnabled: e.target.checked })}
                  />
                  Top spender on
                </label>
                <label className="block text-[10px] font-bold uppercase text-slate-400">
                  Scope
                  <select
                    className="an-input mt-1 w-full py-2"
                    value={form.spenderScope}
                    onChange={(e) => setForm({ ...form, spenderScope: e.target.value })}
                  >
                    <option value="BRAND">Whole brand</option>
                    <option value="LOCATION">One outlet</option>
                  </select>
                </label>
                <label className="block text-[10px] font-bold uppercase text-slate-400">
                  Min spend counted (Rp)
                  <input
                    className="an-input mt-1 w-full py-2"
                    type="number"
                    min={0}
                    value={form.spenderMinAmount}
                    onChange={(e) => setForm({ ...form, spenderMinAmount: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Places</p>
                <p className="mt-1 text-[11px] text-slate-500">Rank 1 gets rank 1’s gift only.</p>
                <div className="mt-2 space-y-2">
                  {form.spenderTiers.map((row, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="an-input w-20 py-2"
                        type="number"
                        min={1}
                        aria-label={`Rank ${i + 1}`}
                        value={row.rank}
                        onChange={(e) => {
                          const spenderTiers = form.spenderTiers.slice();
                          spenderTiers[i] = { ...row, rank: Number(e.target.value) };
                          setForm({ ...form, spenderTiers });
                        }}
                      />
                      <input
                        className="an-input min-w-0 flex-1 py-2"
                        placeholder="Voucher Rp 200.000"
                        value={row.reward}
                        onChange={(e) => {
                          const spenderTiers = form.spenderTiers.slice();
                          spenderTiers[i] = { ...row, reward: e.target.value };
                          setForm({ ...form, spenderTiers });
                        }}
                      />
                      {form.spenderTiers.length > 1 && (
                        <button
                          type="button"
                          className="an-btn-ghost px-2 text-xs"
                          onClick={() =>
                            setForm({ ...form, spenderTiers: form.spenderTiers.filter((_, j) => j !== i) })
                          }
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {form.spenderTiers.length < 8 && (
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-indigo-600"
                    onClick={() => {
                      const last = form.spenderTiers[form.spenderTiers.length - 1]?.rank || 0;
                      setForm({ ...form, spenderTiers: [...form.spenderTiers, { rank: last + 1, reward: "" }] });
                    }}
                  >
                    + Add place
                  </button>
                )}
              </div>
            </fieldset>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="an-btn-primary text-sm" disabled={busy}>
              {busy ? "Saving…" : "Save this tab"}
            </button>
            <p className="text-[11px] text-slate-400">POS Moka / Majoo later. OCR always needs Approve.</p>
          </div>
        </form>
      )}
    </div>
  );
}
