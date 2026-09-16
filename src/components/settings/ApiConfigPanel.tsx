"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import type { IntegrationPublicView } from "@/lib/integrations/service";
import { categoryLabel } from "@/lib/integrations/catalog";
import { formatDateTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locale";

type Props = {
  initial: IntegrationPublicView[];
  locale: Locale;
};

const STATUS_STYLES: Record<string, string> = {
  ready: "bg-emerald-50 text-emerald-800 ring-emerald-600/15",
  partial: "bg-amber-50 text-amber-900 ring-amber-600/15",
  mock: "bg-sky-50 text-sky-800 ring-sky-600/15",
  off: "bg-slate-100 text-slate-600 ring-slate-400/20",
  planned: "bg-violet-50 text-violet-800 ring-violet-600/15",
  missing: "bg-rose-50 text-rose-800 ring-rose-600/15",
};

export function ApiConfigPanel({ initial, locale }: Props) {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const grouped = useMemo(() => {
    const map = new Map<string, IntegrationPublicView[]>();
    for (const item of items) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries());
  }, [items]);

  async function save(
    provider: string,
    payload: {
      mode: string;
      enabled: boolean;
      notes: string;
      publicFields: Record<string, string>;
      secretFields: Record<string, string>;
    }
  ) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/settings/integrations/${provider}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Save failed");
      }
      const next = data.integration as IntegrationPublicView;
      setItems((prev) => prev.map((i) => (i.provider === provider ? next : i)));
      setMessage({ type: "ok", text: `${next.name} saved.` });
    } catch (e) {
      setMessage({
        type: "err",
        text: e instanceof Error ? e.message : "Save failed",
      });
    } finally {
      setSaving(false);
    }
  }

  async function testSmtp(to: string) {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/integrations/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        mailed?: boolean;
        to?: string;
        selfSend?: boolean;
      };
      if (!res.ok || !data.mailed) {
        throw new Error(data.error || "Test send failed");
      }
      if (data.selfSend) {
        setMessage({
          type: "ok",
          text: locale === "id"
            ? `Gmail terima tes ke ${data.to}. Cek folder Sent (bukan Inbox) — kirim ke diri sendiri.`
            : `Gmail accepted the test to ${data.to}. Check Sent (not Inbox) — that is a self-send.`,
        });
      } else {
        setMessage({
          type: "ok",
          text: locale === "id"
            ? `Tes terkirim ke ${data.to}. Cek Inbox (dan Spam).`
            : `Test sent to ${data.to}. Check Inbox (and Spam).`,
        });
      }
    } catch (e) {
      setMessage({
        type: "err",
        text: e instanceof Error ? e.message : "Test send failed",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="an-card p-5">
        <h2 className="text-sm font-semibold text-slate-900">API Configuration</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          One place for every external API AtlasNow uses. Secrets are encrypted in the
          database (AES-GCM via <code className="font-mono text-[11px]">AUTH_SECRET</code>
          ). Environment variables still work as fallback when a field is empty.
        </p>
        <p className="mt-2 text-[11px] text-slate-400">
          After Google credentials are set, connect the account under{" "}
          <Link href="/settings/google" className="font-medium text-indigo-600 hover:underline">
            Data Health
          </Link>
          .
        </p>
      </div>

      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            message.type === "ok"
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/10"
              : "bg-rose-50 text-rose-800 ring-1 ring-rose-600/10"
          }`}
        >
          {message.text}
        </div>
      )}

      {grouped.map(([category, list]) => (
        <section key={category} className="space-y-3">
          <h3 className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {categoryLabel(category as IntegrationPublicView["category"])}
          </h3>
          <div className="space-y-3">
            {list.map((item) => (
              <IntegrationCard
                key={item.provider}
                item={item}
                locale={locale}
                open={open === item.provider}
                saving={saving}
                testing={testing}
                onToggle={() =>
                  setOpen((o) => (o === item.provider ? null : item.provider))
                }
                onSave={(payload) => save(item.provider, payload)}
                onTestSmtp={item.provider === "smtp" ? testSmtp : undefined}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function IntegrationCard({
  item,
  locale,
  open,
  saving,
  testing,
  onToggle,
  onSave,
  onTestSmtp,
}: {
  item: IntegrationPublicView;
  locale: Locale;
  open: boolean;
  saving: boolean;
  testing: boolean;
  onToggle: () => void;
  onSave: (payload: {
    mode: string;
    enabled: boolean;
    notes: string;
    publicFields: Record<string, string>;
    secretFields: Record<string, string>;
  }) => void;
  onTestSmtp?: (to: string) => void;
}) {
  const [mode, setMode] = useState(item.mode);
  const [enabled, setEnabled] = useState(item.enabled);
  const [notes, setNotes] = useState(item.notes || "");
  const [publicFields, setPublicFields] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of item.fields) {
      if (!f.secret) o[f.key] = f.value || "";
    }
    return o;
  });
  const [secretFields, setSecretFields] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of item.fields) {
      if (f.secret) o[f.key] = "";
    }
    return o;
  });
  const [testTo, setTestTo] = useState(publicFields.to || "");
  const id = locale === "id";
  const smtpSelfSend =
    item.provider === "smtp" &&
    Boolean(publicFields.user) &&
    (testTo || publicFields.to || publicFields.user).trim().toLowerCase() ===
      publicFields.user.trim().toLowerCase();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onSave({ mode, enabled, notes, publicFields, secretFields });
  }

  return (
    <div className="an-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-slate-50/80"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{item.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                STATUS_STYLES[item.status] || STATUS_STYLES.missing
              }`}
            >
              {item.statusLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              {item.phase}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.description}</p>
        </div>
        <span className="mt-1 text-slate-400">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <form onSubmit={onSubmit} className="space-y-4 border-t border-slate-100 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs">
              <span className="font-semibold text-slate-600">Mode</span>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                {item.modes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              Enabled
            </label>
            {item.opsHref && (
              <div className="flex items-end justify-end">
                <Link
                  href={item.opsHref}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  {item.opsLabel || "Open"} →
                </Link>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {item.fields.map((f) => (
              <label key={f.key} className="block text-xs sm:col-span-1">
                <span className="font-semibold text-slate-600">{f.label}</span>
                {f.secret && f.hasSecret && (
                  <span className="ml-2 text-[10px] font-medium text-emerald-700">
                    set ({f.source})
                  </span>
                )}
                {!f.secret && f.source === "env" && (
                  <span className="ml-2 text-[10px] font-medium text-sky-700">from env</span>
                )}
                <input
                  type={f.secret ? "password" : "text"}
                  autoComplete="off"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                  placeholder={
                    f.secret
                      ? f.hasSecret
                        ? "••••••••  (leave blank to keep)"
                        : f.placeholder || "Enter secret"
                      : f.placeholder || ""
                  }
                  value={f.secret ? secretFields[f.key] || "" : publicFields[f.key] || ""}
                  onChange={(e) => {
                    if (f.secret) {
                      setSecretFields((s) => ({ ...s, [f.key]: e.target.value }));
                    } else {
                      setPublicFields((s) => ({ ...s, [f.key]: e.target.value }));
                    }
                  }}
                />
                {f.help && <p className="mt-1 text-[10px] text-slate-400">{f.help}</p>}
                {f.envFallback && (
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    Env fallback: <code className="font-mono">{f.envFallback}</code>
                  </p>
                )}
                {f.secret && f.hasSecret && (
                  <button
                    type="button"
                    className="mt-1 text-[10px] font-semibold text-rose-600 hover:underline"
                    onClick={() =>
                      setSecretFields((s) => ({ ...s, [f.key]: "__CLEAR__" }))
                    }
                  >
                    Clear stored secret
                  </button>
                )}
              </label>
            ))}
          </div>

          <label className="block text-xs">
            <span className="font-semibold text-slate-600">Notes</span>
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal ops notes…"
            />
          </label>

          {item.provider === "smtp" && onTestSmtp ? (
            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
              <p className="text-[11px] leading-relaxed text-slate-500">
                {id
                  ? "Simpan tidak mengirim email. Kirim tes ke mailbox yang BEDA dari Username (bukan hello@ → hello@) supaya masuk Inbox Gmail."
                  : "Save does not send mail. Send a test to a mailbox that is not the SMTP Username so Gmail shows Inbox, not only Sent."}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono sm:flex-1"
                  placeholder={id ? "email Inbox kamu" : "your Inbox email"}
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
                <button
                  type="button"
                  disabled={saving || testing || !testTo.trim()}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => onTestSmtp(testTo.trim())}
                >
                  {testing
                    ? id
                      ? "Mengirim tes…"
                      : "Sending test…"
                    : id
                      ? "Kirim tes"
                      : "Send test"}
                </button>
              </div>
              {smtpSelfSend ? (
                <p className="text-[11px] text-amber-800">
                  {id
                    ? "Ini kirim ke diri sendiri. Gmail akan taruh di Sent, bukan Inbox."
                    : "This is a self-send. Gmail will put it in Sent, not Inbox."}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save configuration"}
            </button>
            {item.updatedAt && (
              <span className="text-[11px] text-slate-400">
                Updated {formatDateTime(item.updatedAt, locale)}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
