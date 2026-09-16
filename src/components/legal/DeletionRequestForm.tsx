"use client";

import { FormEvent, useState } from "react";
import { DELETION_KINDS, type DeletionKind } from "@/lib/legal/deletion-request";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/copy";
import type { Locale } from "@/lib/i18n/locale";

const KIND_LABEL: Record<Locale, Record<DeletionKind, string>> = {
  en: {
    facebook: "Facebook Messenger",
    instagram: "Instagram",
    whatsapp: "WhatsApp",
    tiktok: "TikTok",
    account: "AtlasNow account",
    other: "Other",
  },
  id: {
    facebook: "Facebook Messenger",
    instagram: "Instagram",
    whatsapp: "WhatsApp",
    tiktok: "TikTok",
    account: "Akun AtlasNow",
    other: "Lainnya",
  },
};

export function DeletionRequestForm({ locale }: { locale: Locale }) {
  const id = locale === "id";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<DeletionKind>("facebook");
  const [identifier, setIdentifier] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/legal/deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, kind, identifier, details }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatus("err");
        setError(data.error || (id ? "Gagal mengirim." : "Could not send."));
        return;
      }
      setStatus("ok");
    } catch {
      setStatus("err");
      setError(id ? "Kesalahan jaringan." : "Network error.");
    }
  }

  if (status === "ok") {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
        {id
          ? `Permintaan tercatat. Kami akan menindaklanjuti lewat ${email}. Untuk salinan, email juga ${LEGAL_CONTACT_EMAIL}.`
          : `Request logged. We will follow up at ${email}. You can also write ${LEGAL_CONTACT_EMAIL}.`}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-8 space-y-4 rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6"
    >
      <h2 className="text-lg font-semibold text-[var(--ink)]">
        {id ? "Formulir permintaan" : "Request form"}
      </h2>
      <p className="text-sm text-[var(--ink)]/45">
        {id
          ? "Tidak perlu akun. Kami memakai ini untuk menemukan data yang harus dihapus."
          : "No account needed. We use this to find the data we should delete."}
      </p>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--ink)]/45">
          {id ? "Nama" : "Name"}
        </label>
        <input
          className="an-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--ink)]/45">
          Email
        </label>
        <input
          type="email"
          required
          className="an-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--ink)]/45">
          {id ? "Jenis data" : "What to delete"}
        </label>
        <select
          className="an-input"
          value={kind}
          onChange={(e) => setKind(e.target.value as DeletionKind)}
        >
          {DELETION_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[locale][k]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--ink)]/45">
          {id ? "Page, merek, atau ID" : "Page, brand, or ID"}
        </label>
        <input
          className="an-input"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={id ? "Contoh: Brisia Jodie / PSID" : "e.g. Brisia Jodie / PSID"}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--ink)]/45">
          {id ? "Detail" : "Details"}
        </label>
        <textarea
          className="an-input min-h-[96px]"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={
            id
              ? "Kapan Anda menulis, cuplikan pesan, nama profil…"
              : "When you wrote, a message snippet, profile name…"
          }
        />
      </div>
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={status === "sending"}
        className="an-btn-primary disabled:opacity-60"
      >
        {status === "sending"
          ? id
            ? "Mengirim…"
            : "Sending…"
          : id
            ? "Kirim permintaan"
            : "Submit request"}
      </button>
    </form>
  );
}
