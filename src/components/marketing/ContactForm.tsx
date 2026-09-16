"use client";

import { FormEvent, useState } from "react";
import { setAdsUserData, trackGenerateLead } from "@/lib/analytics/ga";
import type { Locale } from "@/lib/i18n/locale";

export function ContactForm({ locale }: { locale: Locale }) {
  const id = locale === "id";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company,
          message,
          website,
          locale,
          page: typeof window !== "undefined" ? window.location.pathname : "/contact",
          referrer: typeof document !== "undefined" ? document.referrer : "",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatus("err");
        if (data.error === "too_many") {
          setError(id ? "Terlalu banyak kiriman. Coba lagi nanti." : "Too many sends. Try again later.");
        } else if (data.error === "message_required") {
          setError(id ? "Tulis pesan yang lebih lengkap." : "Please write a bit more in the message.");
        } else if (data.error === "email_required") {
          setError(id ? "Email tidak valid." : "That email does not look right.");
        } else if (data.error === "name_required") {
          setError(id ? "Nama wajib diisi." : "Name is required.");
        } else {
          setError(id ? "Gagal mengirim." : "Could not send.");
        }
        return;
      }
      setStatus("ok");
      setAdsUserData(email);
      trackGenerateLead("contact");
    } catch {
      setStatus("err");
      setError(id ? "Kesalahan jaringan." : "Network error.");
    }
  }

  const fieldClass = "an-input";

  if (status === "ok") {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
        {id ? `Terkirim. Kami membalas ke ${email}.` : `Sent. We’ll reply to ${email}.`}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--ink)]/45">
            {id ? "Nama" : "Name"}
          </label>
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--ink)]/45">
            Email
          </label>
          <input
            type="email"
            required
            className={fieldClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--ink)]/45">
          {id ? "Brand / perusahaan (opsional)" : "Brand / company (optional)"}
        </label>
        <input
          className={fieldClass}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          autoComplete="organization"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--ink)]/45">
          {id ? "Pesan" : "Message"}
        </label>
        <textarea
          required
          className={`${fieldClass} min-h-[140px]`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            id
              ? "Ceritakan brand, jumlah cabang, atau yang ingin ditanyakan…"
              : "Tell us about the brand, how many branches, or what you need…"
          }
        />
      </div>
      <div className="hidden" aria-hidden>
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={status === "sending"} className="an-btn-primary disabled:opacity-60">
        {status === "sending" ? (id ? "Mengirim…" : "Sending…") : id ? "Kirim" : "Send"}
      </button>
    </form>
  );
}
