"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Branding, LocalizedBranding } from "@/lib/branding-defaults";
import { DEFAULT_BRANDING, localizeBranding } from "@/lib/branding-defaults";
import { AuthSplitShell } from "@/components/auth/AuthSplitShell";
import { SocialButtons } from "@/components/auth/SocialButtons";
import type { Locale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";
import { atlasProductCopyright } from "@/lib/legal/copy";
import { DEFAULT_SOCIAL, type SocialLinks } from "@/lib/social";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/control-tower";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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

  const t = getMessages(locale).login;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = typeof data.error === "string" ? data.error : "";
        setError(
          code === "pending"
            ? t.pendingActivation
            : code === "disabled"
              ? t.accountDisabled
              : code === "invalid" || !code
                ? t.loginFailed
                : data.error
        );
        setLoading(false);
        return;
      }
      router.push(typeof data.home === "string" && !search.get("next") ? data.home : next);
      router.refresh();
    } catch {
      setError(t.networkError);
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
      cardFooter={t.cardFooter}
    >
      <div className="rounded-2xl border border-white bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.1)] sm:rounded-3xl sm:p-10">
        <div className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2a9bb8]">
            {t.eyebrow}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">
            {t.signInTitle}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{t.signInHint}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
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
              autoComplete="username"
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
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="an-btn-cta w-full py-3.5 text-[15px] disabled:opacity-60"
          >
            {loading ? t.signingIn : t.continue}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          {t.or}
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <SocialButtons
          acceptTerms
          onNeedTerms={() => undefined}
          googleLabel={t.continueGoogle}
          facebookLabel={t.continueFacebook}
          tone="light"
        />
        <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
          {t.socialTermsBefore}{" "}
          <Link href="/terms" className="font-semibold text-slate-600 hover:text-slate-900">
            {t.socialTermsLink}
          </Link>{" "}
          {t.socialTermsAnd}{" "}
          <Link href="/privacy" className="font-semibold text-slate-600 hover:text-slate-900">
            {t.socialPrivacyLink}
          </Link>
          {t.socialTermsAfter}
        </p>
        <p className="mt-4 text-center text-sm text-slate-500">
          {t.noAccount}{" "}
          <Link href="/signup" className="font-semibold text-slate-900 hover:underline">
            {t.signUp}
          </Link>
        </p>
      </div>
    </AuthSplitShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--warm)]" />}>
      <LoginForm />
    </Suspense>
  );
}
