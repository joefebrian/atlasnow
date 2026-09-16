"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import type { BroadcastAudience, BroadcastPerson } from "@/lib/broadcast/audience";
import { BROADCAST_MAX } from "@/lib/broadcast/audience";
import {
  atlasEachIdr,
  DEFAULT_ATLAS_FEES,
  estimateBroadcast,
  formatIdr,
  INDONESIA,
  type AtlasFeeConfig,
  type BroadcastKind,
} from "@/lib/broadcast/rates";
import type { WaTemplate } from "@/lib/broadcast/templates";
import {
  GO_DEAL_TEMPLATE_BODY_ID,
  GO_DEAL_TEMPLATE_NAME,
} from "@/lib/broadcast/go-deal-template";
import { BIRTHDAY_TEMPLATE_BODY_ID, BIRTHDAY_TEMPLATE_NAME } from "@/lib/loyalty/birthday-template";
import type { Messages } from "@/lib/i18n/messages";
import { HistoryPanel } from "@/components/broadcast/HistoryPanel";

type Tab = "session" | "templates" | "payg" | "history";

type Attached = { id: string; kind: "image" | "document"; filename: string };

type Props = {
  t: Messages["broadcast"];
  clientId: string | null;
  isGroup: boolean;
  isPlatformAdmin?: boolean;
  brands: { id: string; name: string }[];
};

const FILE_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf";

export function BroadcastDesk({ t, clientId, isGroup, isPlatformAdmin, brands }: Props) {
  const router = useRouter();
  const qs = clientId ? `?client=${encodeURIComponent(clientId)}` : "";
  const [tab, setTab] = useState<Tab>("session");
  const [data, setData] = useState<BroadcastAudience | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [optPhones, setOptPhones] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [tplName, setTplName] = useState("");
  const [tplCat, setTplCat] = useState<"MARKETING" | "UTILITY">("MARKETING");
  const [tplLang, setTplLang] = useState("id");
  const [tplBody, setTplBody] = useState("");
  const [tplHeaderFile, setTplHeaderFile] = useState<File | null>(null);
  const [sendName, setSendName] = useState("");
  const [sendLang, setSendLang] = useState("id");
  const [sessionMedia, setSessionMedia] = useState<Attached | null>(null);
  const [sendMedia, setSendMedia] = useState<Attached | null>(null);
  const [fees, setFees] = useState<AtlasFeeConfig>(DEFAULT_ATLAS_FEES);

  const load = useCallback(async () => {
    if (isGroup && !clientId) {
      setData(null);
      return;
    }
    const res = await fetch(`/api/broadcast${qs}`, { credentials: "same-origin" });
    const json = (await res.json()) as BroadcastAudience & {
      error?: string;
      optedIn?: { phone: string; name: string }[];
      rates?: { atlasFee?: AtlasFeeConfig };
    };
    if (!res.ok) {
      setErr(json.error || "Could not load");
      setData(null);
      return;
    }
    setErr(null);
    setData({ ...json, optedIn: json.optedIn || [] });
    if (json.rates?.atlasFee) setFees(json.rates.atlasFee);
    setIds(json.people.slice(0, BROADCAST_MAX).map((p) => p.conversationId));
    setOptPhones((json.optedIn || []).slice(0, BROADCAST_MAX).map((p) => p.phone));
  }, [clientId, isGroup, qs]);

  const loadTpl = useCallback(async () => {
    if (isGroup && !clientId) return;
    const res = await fetch(`/api/broadcast/templates${qs}`, { credentials: "same-origin" });
    const json = (await res.json()) as { templates?: WaTemplate[]; error?: string };
    if (res.ok) {
      const rows = json.templates || [];
      setTemplates(rows);
      setSendName((prev) => {
        const keep = rows.find((x) => x.name === prev && x.status === "APPROVED");
        return keep?.name || rows.find((x) => x.status === "APPROVED")?.name || "";
      });
    }
  }, [clientId, isGroup, qs]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === "templates") void loadTpl();
  }, [tab, loadTpl]);

  useEffect(() => {
    const row = templates.find((x) => x.name === sendName);
    if (row) setSendLang(row.language);
  }, [sendName, templates]);

  const selected = useMemo(() => new Set(ids), [ids]);
  const selectedOpt = useMemo(() => new Set(optPhones), [optPhones]);
  const approvedTpl = templates.filter((row) => row.status === "APPROVED");
  const waitingTpl = templates.filter((row) => row.status !== "APPROVED");
  const selectedTpl = approvedTpl.find((row) => row.name === sendName) || templates.find((row) => row.name === sendName);
  const needsHeader =
    selectedTpl?.headerFormat === "IMAGE" || selectedTpl?.headerFormat === "DOCUMENT";
  const tplKind: BroadcastKind = selectedTpl?.category === "UTILITY" ? "utility" : "marketing";

  const sessionEst = estimateBroadcast({ kind: "session", count: ids.length, insideWindow: true, fees });
  const sendEst = estimateBroadcast({
    kind: tplKind,
    count: optPhones.length,
    insideWindow: false,
    fees,
  });

  const tplBlock =
    !selectedTpl || selectedTpl.status !== "APPROVED"
      ? t.whyNoTpl
      : optPhones.length === 0
        ? t.whyNoPeople
        : needsHeader && !sendMedia
          ? t.whyNoHeader
          : !confirm
            ? t.whyNoConfirm
            : null;

  function toggle(id: string) {
    setIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= BROADCAST_MAX) return prev;
      return [...prev, id];
    });
  }

  function toggleOpt(phone: string) {
    setOptPhones((prev) => {
      if (prev.includes(phone)) return prev.filter((x) => x !== phone);
      if (prev.length >= BROADCAST_MAX) return prev;
      return [...prev, phone];
    });
  }

  async function uploadToWhatsApp(file: File): Promise<Attached> {
    const form = new FormData();
    form.set("file", file);
    if (clientId) form.set("client", clientId);
    const res = await fetch("/api/broadcast/media", {
      method: "POST",
      credentials: "same-origin",
      body: form,
    });
    const json = (await res.json()) as { error?: string; media?: Attached };
    if (!res.ok || !json.media?.id) {
      throw new Error(json.error || "Upload failed");
    }
    return json.media;
  }

  async function onPickSessionFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      setSessionMedia(await uploadToWhatsApp(file));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.network);
      setSessionMedia(null);
    } finally {
      setUploading(false);
    }
  }

  async function onPickSendHeader(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      setSendMedia(await uploadToWhatsApp(file));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.network);
      setSendMedia(null);
    } finally {
      setUploading(false);
    }
  }

  async function sendSession() {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          client: clientId,
          ids,
          text,
          confirm,
          media: sessionMedia,
        }),
      });
      const json = (await res.json()) as { error?: string; sent?: number; failed?: { phone: string }[] };
      if (!res.ok) {
        setErr(json.error || "Send failed");
        return;
      }
      setOk(t.resultOk.replace("{n}", String(json.sent || 0)).replace("{f}", String(json.failed?.length || 0)));
      setConfirm(false);
      await load();
    } catch {
      setErr(t.network);
    } finally {
      setBusy(false);
    }
  }

  async function createTpl() {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const form = new FormData();
      if (clientId) form.set("client", clientId);
      form.set("name", tplName);
      form.set("category", tplCat);
      form.set("language", tplLang);
      form.set("body", tplBody);
      if (tplHeaderFile) form.set("file", tplHeaderFile);
      const res = await fetch("/api/broadcast/templates", {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      const json = (await res.json()) as { error?: string; status?: string };
      if (!res.ok) {
        setErr(json.error || "Meta rejected the template");
        return;
      }
      setOk(`${t.submitted} · ${json.status || "PENDING"}`);
      setTplName("");
      setTplBody("");
      setTplHeaderFile(null);
      await loadTpl();
    } catch {
      setErr(t.network);
    } finally {
      setBusy(false);
    }
  }

  async function sendTpl() {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          client: clientId,
          mode: "template",
          phones: optPhones,
          templateName: sendName,
          language: sendLang,
          confirm,
          media: needsHeader ? sendMedia : null,
        }),
      });
      const json = (await res.json()) as { error?: string; sent?: number; failed?: { phone: string }[] };
      if (!res.ok) {
        setErr(json.error || "Send failed");
        return;
      }
      setOk(t.resultOk.replace("{n}", String(json.sent || 0)).replace("{f}", String(json.failed?.length || 0)));
      setConfirm(false);
    } catch {
      setErr(t.network);
    } finally {
      setBusy(false);
    }
  }

  const canSendSession = confirm && ids.length > 0 && (text.trim().length >= 2 || Boolean(sessionMedia));
  const canSendTpl = !tplBlock;

  const tabs: { id: Tab; label: string }[] = [
    { id: "session", label: t.tabSession },
    { id: "templates", label: t.tabTemplates },
    { id: "history", label: t.tabHistory },
    { id: "payg", label: t.tabPayg },
  ];

  return (
    <div className="an-section">
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        actions={
          isGroup ? (
            <label className="block text-[10px] font-bold uppercase text-slate-400">
              {t.brand}
              <select
                className="an-input mt-1 min-w-[12rem] py-2 font-normal normal-case"
                value={clientId || ""}
                onChange={(e) => {
                  const next = e.target.value;
                  router.replace(next ? `/broadcast?client=${encodeURIComponent(next)}` : "/broadcast");
                }}
              >
                <option value="">{t.pickBrand}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      />

      {isGroup && !clientId ? (
        <div className="an-card px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-800">{t.pickBrand}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Mini label={t.window} value={data?.windowCount ?? "—"} hint={t.windowHint} />
            <Mini label={t.opted} value={data?.optedInCount ?? "—"} hint={t.optedHint} />
            <Mini label="HQ WhatsApp" value={data?.hqOn ? t.hqOn : t.hqOff} hint={data?.hqOn ? undefined : t.noHq} />
          </div>

          {data?.hqOn ? (
            <details className="an-card px-4 py-3 text-[13px] leading-relaxed text-slate-600">
              <summary className="cursor-pointer font-semibold text-slate-800">{t.wabaHowTitle}</summary>
              <p className="mt-2">{t.wabaHowLead}</p>
              <p className="mt-2">
                <span className="font-semibold text-slate-800">{t.wabaAtlasTitle}. </span>
                {t.wabaAtlasBody}
              </p>
              <p className="mt-2">
                <span className="font-semibold text-slate-800">{t.wabaSelfTitle}. </span>
                {t.wabaSelfBody}
              </p>
              <p className="mt-2 text-[12px] text-slate-500">{t.wabaDont}</p>
            </details>
          ) : null}

          <nav className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                  tab === item.id
                    ? "bg-[var(--ink)] text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200/90 hover:bg-[#eef8ff]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {err ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p> : null}
          {ok ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{ok}</p> : null}

          {!data?.hqOn && tab !== "history" && tab !== "payg" ? (
            <div className="an-card space-y-4 p-5 sm:p-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{t.noHq}</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">{t.wabaHowTitle}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{t.wabaHowLead}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#eef8ff] px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{t.wabaAtlasTitle}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{t.wabaAtlasBody}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/80">
                  <p className="text-sm font-semibold text-slate-900">{t.wabaSelfTitle}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{t.wabaSelfBody}</p>
                </div>
              </div>
              <p className="text-[12px] leading-relaxed text-slate-500">{t.wabaDont}</p>
              <Link
                href={clientId ? `/settings/chat-apps?client=${encodeURIComponent(clientId)}` : "/settings/chat-apps"}
                className="an-btn-primary inline-flex"
              >
                {t.wabaOpenChatApps}
              </Link>
            </div>
          ) : null}

          {tab === "history" ? <HistoryPanel t={t} qs={qs} enabled={!(isGroup && !clientId)} /> : null}

          {data?.hqOn && tab === "session" ? (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="an-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{t.sessionStepWho}</p>
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-[#2a9bb8]"
                    onClick={() => setIds((data?.people || []).slice(0, BROADCAST_MAX).map((p) => p.conversationId))}
                  >
                    {t.selectAll}
                  </button>
                </div>
                <p className="mt-1 text-[12px] text-slate-400">
                  {t.selected.replace("{n}", String(ids.length)).replace("{max}", String(BROADCAST_MAX))}
                </p>
                {!data?.people.length ? (
                  <p className="mt-6 text-sm text-slate-500">{t.empty}</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {data.people.map((p: BroadcastPerson) => (
                      <li key={p.conversationId} className="flex items-start gap-3 py-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected.has(p.conversationId)}
                          onChange={() => toggle(p.conversationId)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                          <p className="font-mono text-[12px] text-slate-500">{p.phone}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <form
                className="an-card space-y-3 p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendSession();
                }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{t.sessionStepWhat}</p>
                <EstimateBox t={t} estKind="session" est={sessionEst} />
                <FileChip
                  t={t}
                  attached={sessionMedia}
                  uploading={uploading}
                  onPick={(f) => void onPickSessionFile(f)}
                  onClear={() => setSessionMedia(null)}
                />
                <textarea
                  className="an-input min-h-[8rem] w-full py-3 text-sm"
                  value={text}
                  maxLength={1000}
                  placeholder={t.placeholder}
                  onChange={(e) => setText(e.target.value)}
                />
                <label className="flex items-start gap-2 text-[13px] text-slate-600">
                  <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
                  {t.confirm}
                </label>
                <p className="text-[12px] text-slate-400">{t.sendHint.replace("{max}", String(BROADCAST_MAX))}</p>
                <button
                  type="submit"
                  disabled={busy || uploading || !canSendSession}
                  className="an-btn-primary w-full disabled:opacity-40"
                >
                  {busy ? t.sending : t.sendToN.replace("{n}", String(ids.length))}
                </button>
              </form>
            </div>
          ) : null}

          {data?.hqOn && tab === "templates" ? (
            <div className="space-y-4">
              <p className="text-[13px] leading-relaxed text-slate-600">{t.templatesHint}</p>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="an-card p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{t.stepWhat}</p>
                  <div className="mt-3 space-y-2">
                    {!approvedTpl.length ? (
                      <p className="text-sm text-slate-500">{t.noApproved}</p>
                    ) : (
                      approvedTpl.map((row) => (
                        <button
                          key={row.id || `${row.name}-${row.language}`}
                          type="button"
                          onClick={() => {
                            setSendName(row.name);
                            setSendLang(row.language);
                            setSendMedia(null);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ring-1 ${
                            sendName === row.name ? "bg-[#eef8ff] ring-[#b7e1ff]" : "bg-white ring-slate-100"
                          }`}
                        >
                          <span>
                            <span className="font-semibold text-slate-900">{row.name}</span>
                            <span className="ml-2 text-[11px] text-slate-400">
                              {row.category} · {row.language}
                              {row.headerFormat !== "NONE" ? ` · ${row.headerFormat}` : ""}
                            </span>
                          </span>
                          <span className="text-[11px] font-bold uppercase text-emerald-700">{t.approved}</span>
                        </button>
                      ))
                    )}
                    {waitingTpl.map((row) => (
                      <div
                        key={row.id || `${row.name}-${row.language}-wait`}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500"
                      >
                        <span>
                          <span className="font-semibold">{row.name}</span>
                          <span className="ml-2 text-[11px]">
                            {row.category} · {row.language}
                          </span>
                        </span>
                        <span className="text-[11px] font-bold uppercase">{row.status}</span>
                      </div>
                    ))}
                  </div>
                  {waitingTpl.length ? (
                    <p className="mt-3 text-[12px] text-slate-400">{t.waitingMeta}</p>
                  ) : null}
                </div>

                <div className="an-card p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{t.stepWho}</p>
                    {data?.optedIn.length ? (
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-[#2a9bb8]"
                        onClick={() => setOptPhones((data?.optedIn || []).slice(0, BROADCAST_MAX).map((p) => p.phone))}
                      >
                        {t.selectAllOpt}
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{t.birthdayNotAuto}</p>
                  <p className="mt-1 text-[12px] text-slate-400">
                    {t.selected.replace("{n}", String(optPhones.length)).replace("{max}", String(BROADCAST_MAX))}
                  </p>
                  {!data?.optedIn.length ? (
                    <p className="mt-4 text-sm text-slate-500">{t.noOptIn}</p>
                  ) : (
                    <ul className="mt-3 max-h-56 divide-y divide-slate-100 overflow-y-auto">
                      {data.optedIn.map((p) => (
                        <li key={p.phone} className="flex items-center gap-3 py-2">
                          <input type="checkbox" checked={selectedOpt.has(p.phone)} onChange={() => toggleOpt(p.phone)} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{p.name}</p>
                            <p className="font-mono text-[12px] text-slate-500">{p.phone}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="an-card space-y-3 p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{t.stepSend}</p>
                <EstimateBox t={t} estKind={tplKind} est={sendEst} />
                {needsHeader ? (
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-bold uppercase text-slate-400">{t.headerOnSend}</p>
                    <p className="mt-1 text-[12px] text-slate-500">{t.needsHeader}</p>
                    <FileChip
                      t={t}
                      attached={sendMedia}
                      uploading={uploading}
                      accept={
                        selectedTpl?.headerFormat === "DOCUMENT"
                          ? "application/pdf,.pdf"
                          : "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      }
                      onPick={(f) => void onPickSendHeader(f)}
                      onClear={() => setSendMedia(null)}
                    />
                  </div>
                ) : null}
                <label className="flex items-start gap-2 text-[13px] text-slate-600">
                  <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
                  {t.confirmTemplate}
                </label>
                {tplBlock ? <p className="text-[12px] text-slate-500">{tplBlock}</p> : null}
                <button
                  type="button"
                  disabled={busy || uploading || !canSendTpl}
                  className="an-btn-primary w-full disabled:opacity-40"
                  onClick={() => void sendTpl()}
                >
                  {busy ? t.sending : t.sendToN.replace("{n}", String(optPhones.length))}
                </button>
              </div>

              <details className="an-card p-5">
                <summary className="cursor-pointer text-[13px] font-semibold text-slate-800">{t.setupTitle}</summary>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-500">{t.setupHint}</p>
                <form
                  className="mt-4 space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void createTpl();
                  }}
                >
                  <button
                    type="button"
                    className="an-btn-ghost w-full text-left text-sm"
                    onClick={() => {
                      setTplCat("MARKETING");
                      setTplName(BIRTHDAY_TEMPLATE_NAME);
                      setTplLang("id");
                      setTplBody(BIRTHDAY_TEMPLATE_BODY_ID);
                    }}
                  >
                    {t.birthdayPreset}
                  </button>
                  <p className="text-[12px] leading-relaxed text-slate-500">{t.birthdayPresetHint}</p>
                  <button
                    type="button"
                    className="an-btn-ghost w-full text-left text-sm"
                    onClick={() => {
                      setTplCat("MARKETING");
                      setTplName(GO_DEAL_TEMPLATE_NAME);
                      setTplLang("id");
                      setTplBody(GO_DEAL_TEMPLATE_BODY_ID);
                    }}
                  >
                    {t.goDealPreset}
                  </button>
                  <p className="text-[12px] leading-relaxed text-slate-500">{t.goDealPresetHint}</p>
                  <select
                    className="an-input w-full py-2"
                    value={tplCat}
                    onChange={(e) => setTplCat(e.target.value as "MARKETING" | "UTILITY")}
                  >
                    <option value="MARKETING">{t.marketingKind}</option>
                    <option value="UTILITY">{t.utilityKind}</option>
                  </select>
                  <input
                    className="an-input w-full py-2"
                    placeholder={t.templateName}
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                  />
                  <input
                    className="an-input w-full py-2"
                    placeholder={t.templateLang}
                    value={tplLang}
                    onChange={(e) => setTplLang(e.target.value)}
                  />
                  <textarea
                    className="an-input min-h-[6rem] w-full py-2 text-sm"
                    placeholder={t.templateBody}
                    value={tplBody}
                    onChange={(e) => setTplBody(e.target.value)}
                  />
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-bold uppercase text-slate-400">{t.headerSample}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{t.headerSampleHint}</p>
                    <label className="an-btn-ghost mt-2 inline-flex cursor-pointer text-sm">
                      {tplHeaderFile ? tplHeaderFile.name : t.attach}
                      <input
                        type="file"
                        accept={FILE_ACCEPT}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          e.target.value = "";
                          setTplHeaderFile(file);
                        }}
                      />
                    </label>
                    {tplHeaderFile ? (
                      <button
                        type="button"
                        className="ml-2 text-[12px] font-semibold text-slate-500"
                        onClick={() => setTplHeaderFile(null)}
                      >
                        {t.removeFile}
                      </button>
                    ) : null}
                  </div>
                  <button type="submit" disabled={busy} className="an-btn-primary w-full disabled:opacity-40">
                    {t.createTemplate}
                  </button>
                </form>
              </details>
            </div>
          ) : null}

          {tab === "payg" ? (
            <div className="space-y-4">
              <div className="an-card space-y-3 p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{t.paygTitle}</p>
                <p className="text-[14px] leading-relaxed text-slate-600">{t.paygHint}</p>
                <p className="text-[13px] text-slate-500">{t.paygMetaNote}</p>
                {fees.marginPct > 0 ? (
                  <p className="text-[13px] text-slate-600">
                    Atlas = flat Rp + {fees.marginPct}% of Meta.
                  </p>
                ) : null}
                {isPlatformAdmin ? (
                  <Link href="/settings/broadcast" className="inline-flex text-[13px] font-semibold text-[#2a9bb8]">
                    {t.editFees}
                  </Link>
                ) : (
                  <p className="text-[13px] text-slate-500">{t.feesLocked}</p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-left text-sm">
                    <thead className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="py-2">{t.category}</th>
                        <th className="py-2">{t.metaCost}</th>
                        <th className="py-2">{t.atlasFee}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["session", t.sessionKind],
                          ["marketing", t.marketingKind],
                          ["utility", t.utilityKind],
                        ] as [BroadcastKind, string][]
                      ).map(([k, label]) => (
                        <tr key={k} className="border-t border-slate-100">
                          <td className="py-2.5 font-semibold">{label}</td>
                          <td className="py-2.5 tabular-nums">
                            {k === "session" ? formatIdr(0) : formatIdr(k === "marketing" ? INDONESIA.marketing : INDONESIA.utility)}
                          </td>
                          <td className="py-2.5 tabular-nums">
                            {formatIdr(
                              atlasEachIdr(
                                k,
                                k === "session" ? 0 : k === "marketing" ? INDONESIA.marketing : INDONESIA.utility,
                                fees
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[1, 100, 1000].map((n) => {
                  const m = estimateBroadcast({ kind: "marketing", count: n, fees });
                  const u = estimateBroadcast({ kind: "utility", count: n, fees });
                  return (
                    <div key={n} className="an-card p-5">
                      <p className="text-[11px] font-bold uppercase text-slate-400">
                        {t.example} · {n}
                      </p>
                      <p className="mt-3 text-sm text-slate-600">
                        {t.marketingKind}: <strong>{formatIdr(m.total)}</strong>
                      </p>
                      <p className="text-sm text-slate-600">
                        {t.utilityKind}: <strong>{formatIdr(u.total)}</strong>
                      </p>
                      <p className="mt-2 text-[11px] text-slate-400">
                        Meta + PPN 11% + Atlas
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function FileChip({
  t,
  attached,
  uploading,
  accept = FILE_ACCEPT,
  onPick,
  onClear,
}: {
  t: Messages["broadcast"];
  attached: Attached | null;
  uploading: boolean;
  accept?: string;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="an-btn-ghost cursor-pointer text-sm">
          {uploading ? t.uploading : attached ? t.attached : t.attach}
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              onPick(file);
            }}
          />
        </label>
        {attached ? (
          <>
            <span className="truncate text-[12px] text-slate-600">{attached.filename}</span>
            <button type="button" className="text-[12px] font-semibold text-slate-500" onClick={onClear}>
              {t.removeFile}
            </button>
          </>
        ) : null}
      </div>
      <p className="text-[12px] text-slate-400">{t.attachHint}</p>
    </div>
  );
}

function EstimateBox({
  t,
  estKind,
  est,
}: {
  t: Messages["broadcast"];
  estKind: BroadcastKind;
  est: ReturnType<typeof estimateBroadcast>;
}) {
  const label =
    estKind === "session" ? t.sessionKind : estKind === "marketing" ? t.marketingKind : t.utilityKind;
  return (
    <div className="rounded-2xl bg-[#eef8ff] px-4 py-3 text-[13px] text-slate-700 ring-1 ring-[#b7e1ff]/70">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">
        {t.estimate} · {label} · {est.count}
      </p>
      <p className="mt-1">
        {t.metaCost}: {formatIdr(est.metaSubtotal)} ({formatIdr(est.metaEach)} {t.perMessage})
      </p>
      <p>
        {t.vat}: {formatIdr(est.ppnEstimate)}
      </p>
      <p>
        {t.atlasFee}: {formatIdr(est.atlasSubtotal)}
      </p>
      <p className="mt-1 font-semibold">
        {t.total}: {formatIdr(est.total)}
      </p>
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="an-card px-4 py-3">
      <div className="an-label">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}
