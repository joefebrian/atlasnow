"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthSplitShell } from "@/components/auth/AuthSplitShell";
import { SocialButtons } from "@/components/auth/SocialButtons";
import type { Branding, LocalizedBranding } from "@/lib/branding-defaults";
import { DEFAULT_BRANDING, localizeBranding } from "@/lib/branding-defaults";
import type { Locale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";
import { atlasProductCopyright } from "@/lib/legal/copy";
import { rememberSignupMethod, setAdsUserData } from "@/lib/analytics/ga";
import { signupPendingPath } from "@/lib/signup/hq-whatsapp";
import { DEFAULT_SOCIAL, type SocialLinks } from "@/lib/social";

function LogoPicker({
  file,
  onFile,
  label,
  hint,
  replace,
  optional,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  label: string;
  hint: string;
  replace: string;
  optional: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-[#faf8fc] px-3 py-3 transition hover:border-slate-300 hover:bg-white">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] || null)}
        />
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg text-slate-300">+</span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-800">
            {file ? file.name : hint}
          </span>
          <span className="mt-0.5 block text-[11px] text-slate-400">
            {file ? replace : optional}
          </span>
        </span>
      </label>
    </div>
  );
}

function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [wantsGroup, setWantsGroup] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState(search.get("error") || "");
  const [loading, setLoading] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [localized, setLocalized] = useState<LocalizedBranding>(
    localizeBranding(DEFAULT_BRANDING, "en")
  );
  const [social, setSocial] = useState<SocialLinks>(DEFAULT_SOCIAL);

  const applyLocale = useCallback(
    (l: Locale, b: Branding = branding) => {
      setLocale(l);
      setLocalized(localizeBranding(b, l));
    },
    [branding]
  );

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/branding").then((r) => r.json()),
      fetch("/api/settings/locale").then((r) => r.json()),
    ])
      .then(([brand, loc]) => {
        const l: Locale = loc.locale === "id" ? "id" : "en";
        const b: Branding = brand.branding || DEFAULT_BRANDING;
        setBranding(b);
        setLocale(l);
        setLocalized(localizeBranding(b, l));
        if (brand.social) setSocial(brand.social);
      })
      .catch(() => {
        /* defaults */
      });
  }, []);

  const t = getMessages(locale).signup;
  const errorText = error ? t.errors[error] || t.errors.signup_failed : "";

  function needTerms() {
    setError("terms_required");
  }

  function needPhone() {
    setError("phone_required");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!acceptTerms) {
      needTerms();
      return;
    }
    if (!phone.trim()) {
      needPhone();
      return;
    }
    setLoading(true);
    setError("");
    try {
      let res: Response;
      if (logoFile) {
        const fd = new FormData();
        fd.append("email", email);
        fd.append("password", password);
        if (name) fd.append("name", name);
        fd.append("phone", phone);
        fd.append("acceptTerms", "true");
        fd.append("method", "email");
        fd.append("kind", "brand");
        if (wantsGroup) fd.append("wantsGroup", "true");
        fd.append("logo", logoFile);
        res = await fetch("/api/auth/signup", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            name: name || undefined,
            phone,
            acceptTerms: true,
            method: "email",
            kind: "brand",
            wantsGroup,
          }),
        });
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string; pending?: boolean };
      if (!res.ok) {
        setError(data.error || "signup_failed");
        setLoading(false);
        return;
      }
      rememberSignupMethod("email");
      setAdsUserData(email);
      router.push(signupPendingPath(name));
      router.refresh();
    } catch {
      setError("network");
      setLoading(false);
    }
  }

  return (
    <AuthSplitShell
      locale={locale}
      localized={localized}
      social={social}
      onLocaleChange={(l) => applyLocale(l)}
      leftFooter={atlasProductCopyright()}
      cardFooter={t.footer}
    >
      <div className="rounded-2xl border border-white bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.1)] sm:rounded-3xl sm:p-10">
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2a9bb8]">{t.eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{t.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{t.hint}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <LogoPicker
            file={logoFile}
            onFile={setLogoFile}
            label={t.logoLabel}
            hint={t.logoHint}
            replace={t.logoReplace}
            optional={t.logoOptional}
          />
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              {t.nameBrand}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="an-input py-3"
              autoComplete="organization"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              {t.phone}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (error === "phone_required") setError("");
              }}
              className="an-input py-3"
              autoComplete="tel"
              inputMode="tel"
              placeholder="08…"
              required
            />
            <p className="mt-1.5 text-[11px] text-slate-400">{t.phoneHint}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              {t.email}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="an-input py-3"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              {t.password}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="an-input py-3"
              required
              autoComplete="new-password"
              minLength={8}
              maxLength={80}
            />
            <p className="mt-1.5 text-[11px] text-slate-400">{t.passwordHint}</p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-[#faf8fc] px-3 py-3">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                if (e.target.checked && error === "terms_required") setError("");
              }}
              required
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900"
            />
            <span className="text-[12px] leading-relaxed text-slate-500">
              {t.termsBefore}{" "}
              <Link href="/terms" className="font-semibold text-slate-800 underline-offset-2 hover:underline">
                {t.termsLink}
              </Link>{" "}
              {t.termsAnd}{" "}
              <Link href="/privacy" className="font-semibold text-slate-800 underline-offset-2 hover:underline">
                {t.privacyLink}
              </Link>
              {t.termsAfter}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 px-1 py-1">
            <input
              type="checkbox"
              checked={wantsGroup}
              onChange={(e) => setWantsGroup(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900"
            />
            <span className="text-[12px] leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-700">{t.wantsGroup}</span>
              <span className="mt-0.5 block text-[11px] text-slate-400">{t.wantsGroupHint}</span>
            </span>
          </label>

          {errorText ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
              {errorText}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="an-btn-cta w-full py-3.5 text-[15px] disabled:opacity-60"
          >
            {loading ? t.creating : t.continue}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          {t.or}
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <SocialButtons
          acceptTerms={acceptTerms}
          onNeedTerms={needTerms}
          googleLabel={t.continueGoogle}
          facebookLabel={t.continueFacebook}
          tone="light"
          phone={phone}
          requirePhone
          onNeedPhone={needPhone}
          wantsGroup={wantsGroup}
        />

        <p className="mt-4 text-center text-[12px] text-slate-400">{t.noCard}</p>
        <p className="mt-3 text-center text-sm text-slate-500">
          {t.haveAccount}{" "}
          <Link href="/login" className="font-semibold text-slate-900 hover:underline">
            {t.logIn}
          </Link>
        </p>
      </div>
    </AuthSplitShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--warm)]" />}>
      <SignupForm />
    </Suspense>
  );
}
