"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Branding } from "@/lib/branding-defaults";
import type { Messages } from "@/lib/i18n/messages";
import { BrandMark } from "@/components/BrandMark";

type Props = { initial: Branding; t: Messages["settings"] };

export function SettingsBrandingForm({ initial, t }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    appName: initial.appName,
    logoUrl: initial.logoUrl,
    logoLetter: initial.logoLetter,
    tagline: initial.tagline,
    heroHeadline: initial.heroHeadline,
    supportingNarrative: initial.supportingNarrative,
    productPromise: initial.productPromise,
    flowStepsText: initial.flowSteps.join("\n"),
    taglineId: initial.taglineId,
    heroHeadlineId: initial.heroHeadlineId,
    supportingNarrativeId: initial.supportingNarrativeId,
    productPromiseId: initial.productPromiseId,
    flowStepsIdText: initial.flowStepsId.join("\n"),
    supportEmail: initial.supportEmail || "",
    primaryColor: initial.primaryColor,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onLogoFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "err", text: t.logoNotImage });
      return;
    }
    if (file.size > 600_000) {
      setMessage({ type: "err", text: t.logoTooLarge });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setField("logoUrl", String(reader.result));
      setMessage(null);
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const flowSteps = form.flowStepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const flowStepsId = form.flowStepsIdText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName: form.appName,
          logoUrl: form.logoUrl,
          logoLetter: form.logoLetter,
          tagline: form.tagline,
          heroHeadline: form.heroHeadline,
          supportingNarrative: form.supportingNarrative,
          productPromise: form.productPromise,
          flowSteps: flowSteps.length ? flowSteps : undefined,
          taglineId: form.taglineId,
          heroHeadlineId: form.heroHeadlineId,
          supportingNarrativeId: form.supportingNarrativeId,
          productPromiseId: form.productPromiseId,
          flowStepsId: flowStepsId.length ? flowStepsId : undefined,
          supportEmail: form.supportEmail || null,
          primaryColor: form.primaryColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || t.saveFailed });
        setSaving(false);
        return;
      }
      setMessage({ type: "ok", text: t.saved });
      setSaving(false);
      router.refresh();
    } catch {
      setMessage({ type: "err", text: t.saveFailed });
      setSaving(false);
    }
  }

  function resetForm() {
    setForm({
      appName: initial.appName,
      logoUrl: initial.logoUrl,
      logoLetter: initial.logoLetter,
      tagline: initial.tagline,
      heroHeadline: initial.heroHeadline,
      supportingNarrative: initial.supportingNarrative,
      productPromise: initial.productPromise,
      flowStepsText: initial.flowSteps.join("\n"),
      taglineId: initial.taglineId,
      heroHeadlineId: initial.heroHeadlineId,
      supportingNarrativeId: initial.supportingNarrativeId,
      productPromiseId: initial.productPromiseId,
      flowStepsIdText: initial.flowStepsId.join("\n"),
      supportEmail: initial.supportEmail || "",
      primaryColor: initial.primaryColor,
    });
    setMessage(null);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="an-card p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t.appIdentity}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t.appIdentityHint}</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
            <BrandMark logoUrl={form.logoUrl} logoLetter={form.logoLetter} size="md" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">{form.appName || "—"}</div>
              <div className="max-w-[200px] truncate text-[11px] text-slate-400">
                {form.tagline || "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              {t.appName}
            </label>
            <input
              className="an-input"
              value={form.appName}
              onChange={(e) => setField("appName", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              {t.monogram}
            </label>
            <input
              className="an-input"
              value={form.logoLetter}
              maxLength={2}
              onChange={(e) => setField("logoLetter", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              {t.logoImage}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="an-btn-ghost text-xs"
                onClick={() => fileRef.current?.click()}
              >
                {t.uploadLogo}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
              />
              {form.logoUrl && (
                <button
                  type="button"
                  className="an-btn-soft text-xs"
                  onClick={() => setField("logoUrl", null)}
                >
                  {t.clearLogo}
                </button>
              )}
              <span className="text-[11px] text-slate-400">{t.logoHint}</span>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              {t.primaryColor}
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setField("primaryColor", e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
              />
              <input
                className="an-input font-mono text-xs"
                value={form.primaryColor}
                onChange={(e) => setField("primaryColor", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              {t.supportEmail}
            </label>
            <input
              className="an-input"
              type="email"
              value={form.supportEmail}
              onChange={(e) => setField("supportEmail", e.target.value)}
              placeholder="hello@p2plabs.local"
            />
          </div>
        </div>
      </div>

      <div className="an-card p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
            EN
          </span>
          <h2 className="text-sm font-semibold text-slate-900">{t.messagingEn}</h2>
        </div>
        <p className="text-xs text-slate-500">{t.messagingEnHint}</p>

        <div className="mt-5 space-y-4">
          <Field label={t.tagline} value={form.tagline} onChange={(v) => setField("tagline", v)} />
          <Field label={t.hero} value={form.heroHeadline} onChange={(v) => setField("heroHeadline", v)} />
          <TextArea
            label={t.narrative}
            value={form.supportingNarrative}
            onChange={(v) => setField("supportingNarrative", v)}
          />
          <Field
            label={t.promise}
            value={form.productPromise}
            onChange={(v) => setField("productPromise", v)}
          />
          <TextArea
            label={t.flow}
            value={form.flowStepsText}
            onChange={(v) => setField("flowStepsText", v)}
            mono
          />
          <p className="text-[11px] text-slate-400">{t.flowHint}</p>
        </div>
      </div>

      <div className="an-card p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800">
            ID
          </span>
          <h2 className="text-sm font-semibold text-slate-900">{t.messagingId}</h2>
        </div>
        <p className="text-xs text-slate-500">{t.messagingIdHint}</p>

        <div className="mt-5 space-y-4">
          <Field
            label={t.tagline}
            value={form.taglineId}
            onChange={(v) => setField("taglineId", v)}
          />
          <Field
            label={t.hero}
            value={form.heroHeadlineId}
            onChange={(v) => setField("heroHeadlineId", v)}
          />
          <TextArea
            label={t.narrative}
            value={form.supportingNarrativeId}
            onChange={(v) => setField("supportingNarrativeId", v)}
          />
          <Field
            label={t.promise}
            value={form.productPromiseId}
            onChange={(v) => setField("productPromiseId", v)}
          />
          <TextArea
            label={t.flow}
            value={form.flowStepsIdText}
            onChange={(v) => setField("flowStepsIdText", v)}
            mono
          />
        </div>
      </div>

      {message && (
        <p
          className={`rounded-xl px-3.5 py-2.5 text-xs font-medium ${
            message.type === "ok"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="an-btn-primary" disabled={saving}>
          {saving ? t.saving : t.save}
        </button>
        <button type="button" className="an-btn-ghost" disabled={saving} onClick={resetForm}>
          {t.reset}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <input className="an-input" value={value} onChange={(e) => onChange(e.target.value)} required />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <textarea
        className={`an-input min-h-[120px] resize-y leading-relaxed ${mono ? "font-mono text-xs" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </div>
  );
}
