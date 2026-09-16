"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n/locale";
import { CONTACT_INBOX, type SitePages } from "@/lib/site-pages";
import { FaqEditor } from "@/components/settings/FaqEditor";
import type { FaqItem } from "@/lib/faq";
import {
  SOCIAL_ICON_MAX_BYTES,
  SOCIAL_IDS,
  SOCIAL_LABELS,
  SOCIAL_URL_HINT,
  type SocialId,
} from "@/lib/social";
import { PublicSocialLinks } from "@/components/marketing/PublicSocialLinks";

const HREF_KEY = {
  instagram: "socialInstagram",
  facebook: "socialFacebook",
  threads: "socialThreads",
  tiktok: "socialTiktok",
  x: "socialX",
} as const;

const ICON_KEY = {
  instagram: "socialIconInstagram",
  facebook: "socialIconFacebook",
  threads: "socialIconThreads",
  tiktok: "socialIconTiktok",
  x: "socialIconX",
} as const;

function SocialRow({
  id,
  localeId,
  href,
  icon,
  onHref,
  onIcon,
  onError,
}: {
  id: SocialId;
  localeId: boolean;
  href: string;
  icon: string | null;
  onHref: (v: string) => void;
  onIcon: (v: string | null) => void;
  onError: (text: string) => void;
}) {
  function onFile(file: File | null) {
    if (!file) return;
    const okType = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type);
    if (!okType) {
      onError(
        localeId
          ? "Icon harus PNG, SVG, WebP, atau JPG."
          : "Icon must be PNG, SVG, WebP, or JPG."
      );
      return;
    }
    if (file.size > SOCIAL_ICON_MAX_BYTES) {
      onError(localeId ? "Icon maks 80 KB." : "Icon max 80 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onIcon(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-xl ring-1 ring-slate-200/80">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
        <p className="text-sm font-semibold text-slate-900">{SOCIAL_LABELS[id]}</p>
        {icon ? (
          <button type="button" className="text-[11px] font-semibold text-indigo-600" onClick={() => onIcon(null)}>
            {localeId ? "Pakai icon default" : "Use default icon"}
          </button>
        ) : (
          <span className="text-[11px] text-slate-400">{localeId ? "Icon default" : "Default icon"}</span>
        )}
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-[auto_1fr]">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-slate-900 text-slate-200">
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" className="h-6 w-6 object-contain" />
          ) : (
            <span className="text-[10px] font-bold uppercase text-slate-500">{id.slice(0, 2)}</span>
          )}
        </div>
        <div className="space-y-2">
          <input
            className="an-input"
            value={href}
            onChange={(e) => onHref(e.target.value)}
            placeholder={SOCIAL_URL_HINT[id]}
            inputMode="url"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="an-btn-ghost cursor-pointer text-xs">
              {localeId ? "Unggah icon" : "Upload icon"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <span className="text-[11px] text-slate-400">PNG / SVG / WebP / JPG · 80 KB</span>
          </div>
        </div>
      </div>
    </div>
  );
}

type MessageRow = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  locale: string;
  mailSent: boolean;
  mailError: string | null;
  createdAt: string | Date;
};

export function SitePagesForm({
  initial,
  messages,
  locale,
}: {
  initial: SitePages;
  messages: MessageRow[];
  locale: Locale;
}) {
  const router = useRouter();
  const id = locale === "id";
  const [form, setForm] = useState({
    aboutHeadlineEn: initial.aboutHeadlineEn,
    aboutBodyEn: initial.aboutBodyEn,
    aboutPointsEnText: initial.aboutPointsEn.join("\n"),
    aboutHeadlineId: initial.aboutHeadlineId,
    aboutBodyId: initial.aboutBodyId,
    aboutPointsIdText: initial.aboutPointsId.join("\n"),
    contactHeadlineEn: initial.contactHeadlineEn,
    contactBodyEn: initial.contactBodyEn,
    contactHeadlineId: initial.contactHeadlineId,
    contactBodyId: initial.contactBodyId,
    contactNoteEn: initial.contactNoteEn,
    contactNoteId: initial.contactNoteId,
    socialInstagram: initial.social.instagram.href,
    socialFacebook: initial.social.facebook.href,
    socialThreads: initial.social.threads.href,
    socialTiktok: initial.social.tiktok.href,
    socialX: initial.social.x.href,
    socialIconInstagram: initial.social.instagram.icon,
    socialIconFacebook: initial.social.facebook.icon,
    socialIconThreads: initial.social.threads.icon,
    socialIconTiktok: initial.social.tiktok.icon,
    socialIconX: initial.social.x.icon,
  });
  const [faqs, setFaqs] = useState<FaqItem[]>(initial.faqs);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const res = await fetch("/api/settings/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, faqs }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "err", text: data.error || (id ? "Gagal menyimpan" : "Save failed") });
        setSaving(false);
        return;
      }
      setBanner({ type: "ok", text: id ? "Halaman tersimpan." : "Pages saved." });
      setSaving(false);
      router.refresh();
    } catch {
      setBanner({ type: "err", text: id ? "Gagal menyimpan" : "Save failed" });
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="an-card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-[13px] text-slate-500">
          {id
            ? "Form kontak selalu mengirim ke"
            : "The contact form always emails"}{" "}
          <strong className="text-slate-800">{CONTACT_INBOX}</strong>.
        </p>
        <div className="flex gap-2">
          <Link href="/about" className="an-btn-ghost text-xs" target="_blank">
            {id ? "Lihat About" : "View About"}
          </Link>
          <Link href="/contact" className="an-btn-ghost text-xs" target="_blank">
            {id ? "Lihat Contact" : "View Contact"}
          </Link>
          <Link href="/faq" className="an-btn-ghost text-xs" target="_blank">
            {id ? "Lihat FAQ" : "View FAQ"}
          </Link>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <section className="an-card p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900">
            {id ? "About us · English" : "About us · English"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {id ? "Tampil saat bahasa situs English." : "Shown when the site language is English."}
          </p>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Headline
              </span>
              <input
                className="an-input"
                value={form.aboutHeadlineEn}
                onChange={(e) => setField("aboutHeadlineEn", e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                {id ? "Isi (paragraf, pisah baris kosong)" : "Body (blank line = new paragraph)"}
              </span>
              <textarea
                className="an-input min-h-[120px]"
                value={form.aboutBodyEn}
                onChange={(e) => setField("aboutBodyEn", e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                {id ? "Poin (satu per baris)" : "Points (one per line)"}
              </span>
              <textarea
                className="an-input min-h-[96px]"
                value={form.aboutPointsEnText}
                onChange={(e) => setField("aboutPointsEnText", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="an-card p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900">About us · Bahasa Indonesia</h2>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Headline
              </span>
              <input
                className="an-input"
                value={form.aboutHeadlineId}
                onChange={(e) => setField("aboutHeadlineId", e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Isi
              </span>
              <textarea
                className="an-input min-h-[120px]"
                value={form.aboutBodyId}
                onChange={(e) => setField("aboutBodyId", e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Poin (satu per baris)
              </span>
              <textarea
                className="an-input min-h-[96px]"
                value={form.aboutPointsIdText}
                onChange={(e) => setField("aboutPointsIdText", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="an-card p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900">
            {id ? "Contact us" : "Contact us"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {id
              ? "Email tujuan tidak bisa diganti — selalu hello@atlasnow.co."
              : "Inbox is fixed — always hello@atlasnow.co."}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Headline · EN
              </span>
              <input
                className="an-input"
                value={form.contactHeadlineEn}
                onChange={(e) => setField("contactHeadlineEn", e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Headline · ID
              </span>
              <input
                className="an-input"
                value={form.contactHeadlineId}
                onChange={(e) => setField("contactHeadlineId", e.target.value)}
                required
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Intro · EN
              </span>
              <textarea
                className="an-input min-h-[72px]"
                value={form.contactBodyEn}
                onChange={(e) => setField("contactBodyEn", e.target.value)}
                required
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Intro · ID
              </span>
              <textarea
                className="an-input min-h-[72px]"
                value={form.contactBodyId}
                onChange={(e) => setField("contactBodyId", e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Note · EN
              </span>
              <input
                className="an-input"
                value={form.contactNoteEn}
                onChange={(e) => setField("contactNoteEn", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Note · ID
              </span>
              <input
                className="an-input"
                value={form.contactNoteId}
                onChange={(e) => setField("contactNoteId", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="an-card p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900">
            {id ? "Sosial media (footer)" : "Social (footer)"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {id
              ? "Ganti URL profil dan icon. Kosongkan URL untuk menyembunyikan jaringan itu."
              : "Change the profile URL and the icon. Leave the URL blank to hide that network."}
          </p>

          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-[12px] leading-relaxed text-slate-600 ring-1 ring-slate-200/80">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {id ? "Syarat icon" : "Icon requirements"}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {id ? (
                <>
                  <li>PNG, SVG, WebP, atau JPG — bukan PDF.</li>
                  <li>Persegi, 64–512 px. Latar transparan.</li>
                  <li>Maks 80 KB per icon.</li>
                  <li>Footer gelap: pakai glyph putih/terang, atau logo berwarna. Icon hitam akan hilang.</li>
                  <li>Tampil 18×18 px — bentuk sederhana lebih kebaca.</li>
                  <li>
                    URL harus HTTPS ke domain aslinya: instagram.com, facebook.com, threads.com,
                    tiktok.com, atau x.com.
                  </li>
                </>
              ) : (
                <>
                  <li>PNG, SVG, WebP, or JPG — not PDF.</li>
                  <li>Square, 64–512 px. Transparent background.</li>
                  <li>Max 80 KB per icon.</li>
                  <li>Footer is dark: use a white/light glyph, or a colored mark. Black icons vanish.</li>
                  <li>Shown at 18×18 px — a simple shape reads better.</li>
                  <li>
                    URL must be HTTPS on the real host: instagram.com, facebook.com, threads.com,
                    tiktok.com, or x.com.
                  </li>
                </>
              )}
            </ul>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {id ? "Pratinjau footer" : "Footer preview"}
            </span>
            <PublicSocialLinks
              links={{
                instagram: { href: form.socialInstagram || "#", icon: form.socialIconInstagram },
                facebook: { href: form.socialFacebook || "#", icon: form.socialIconFacebook },
                threads: { href: form.socialThreads || "#", icon: form.socialIconThreads },
                tiktok: { href: form.socialTiktok || "#", icon: form.socialIconTiktok },
                x: { href: form.socialX || "#", icon: form.socialIconX },
              }}
            />
          </div>

          <div className="mt-4 space-y-4">
            {SOCIAL_IDS.map((sid) => (
              <SocialRow
                key={sid}
                id={sid}
                localeId={id}
                href={form[HREF_KEY[sid]]}
                icon={form[ICON_KEY[sid]]}
                onHref={(v) => setField(HREF_KEY[sid], v)}
                onIcon={(v) => setField(ICON_KEY[sid], v)}
                onError={(text) => setBanner({ type: "err", text })}
              />
            ))}
          </div>
        </section>

        <FaqEditor items={faqs} onChange={setFaqs} locale={locale} />

        {banner ? (
          <p
            className={`rounded-xl px-3 py-2 text-sm ${
              banner.type === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {banner.text}
          </p>
        ) : null}

        <button type="submit" disabled={saving} className="an-btn-primary disabled:opacity-60">
          {saving ? (id ? "Menyimpan…" : "Saving…") : id ? "Simpan halaman" : "Save pages"}
        </button>
      </form>

      <section className="an-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {id ? "Pesan masuk" : "Inbox from the form"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {id
              ? "Tersimpan di sini. Salinan email: Settings → API → Outbound email. Kalau From dan Deliver to sama (hello@ → hello@), Gmail taruh di Sent — bukan Inbox."
              : "Stored here. Email copy: Settings → API → Outbound email. If From and Deliver to are both hello@, Gmail puts it in Sent — not Inbox."}
          </p>
        </div>
        {messages.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            {id ? "Belum ada kiriman." : "No messages yet."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {messages.map((m) => (
              <li key={m.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {m.name}
                    <span className="ml-2 font-normal text-slate-500">{m.email}</span>
                  </p>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide ${
                      m.mailSent ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    {m.mailSent
                      ? id
                        ? "Email terkirim"
                        : "Emailed"
                      : id
                        ? "Tersimpan saja"
                        : "Saved only"}
                  </span>
                </div>
                {m.company ? <p className="mt-0.5 text-xs text-slate-400">{m.company}</p> : null}
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600">
                  {m.message}
                </p>
                {m.mailError && m.mailError !== "smtp_not_configured" ? (
                  <p className="mt-1 text-[11px] text-rose-500">{m.mailError}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
