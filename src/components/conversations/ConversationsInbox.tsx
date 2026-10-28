"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, BackLink, PageHeader, SearchField } from "@/components/ui";
import type { ConversationListItem } from "@/lib/conversations/service";
import { isOpaqueMetaLabel } from "@/lib/conversations/meta-label";
import { providerLabel, providerNativeClient } from "@/lib/conversations/provider";
import { formatDateTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";
import { ServiceQuotaChip } from "@/components/waba/ServiceQuotaChip";
import type { ServiceQuotaSnapshot } from "@/lib/waba/service-quota";

type Stats = { total: number; unreplied: number; open: number; mappings: number };

type ThreadMessage = {
  id: string;
  direction: string;
  body: string;
  sentAt: string;
  fromMe: boolean;
  source?: string;
};

type ThreadPayload = {
  conversation: ConversationListItem & { tenantId: string };
  messages: ThreadMessage[];
  handoffActive?: boolean;
};

const POLL_MS = 30_000;
const META_THREAD_POLL_MS = 4_000;

function isMetaMessaging(provider: string): boolean {
  return provider === "FACEBOOK" || provider === "INSTAGRAM";
}

function contactParts(
  contact: ConversationListItem["contact"],
  provider?: string
): {
  title: string;
  sub: string | null;
} {
  const phone = contact.phone;
  const name = isOpaqueMetaLabel(contact.displayName) ? null : contact.displayName;
  if (name && phone && name !== phone) return { title: name, sub: phone };
  if (name) return { title: name, sub: phone && phone !== name ? phone : null };
  if (phone) return { title: phone, sub: null };
  if (provider === "INSTAGRAM") return { title: "Instagram user", sub: null };
  if (provider === "FACEBOOK") return { title: "Messenger user", sub: null };
  const title = contact.lid || contact.identifier || "—";
  return { title, sub: null };
}

function sourceBadgeClass(provider: string): string {
  if (provider === "META_CLOUD") return "an-badge-live";
  if (provider === "INSTAGRAM" || provider === "FACEBOOK") return "an-badge-demo";
  return "an-badge-muted";
}

export function ConversationsInbox({
  locale,
  selectedClientId,
  selectedClientName,
  isAgency,
  locations,
}: {
  locale: Locale;
  selectedClientId: string | null;
  selectedClientName: string | null;
  isAgency: boolean;
  locations: { id: string; name: string }[];
}) {
  const t = getMessages(locale).conversations;
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    unreplied: 0,
    open: 0,
    mappings: 0,
  });
  const [q, setQ] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") || "";
  });
  const [filter, setFilter] = useState<"all" | "unreplied">("all");
  const [provider, setProvider] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [team, setTeam] = useState("");
  const [agent, setAgent] = useState("");
  const [lead, setLead] = useState("");
  const [channels, setChannels] = useState<Array<{ phoneNumberId: string; label: string; teamLabel: string }>>([]);
  const [locationId, setLocationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState<ConversationListItem | null>(null);
  const [thread, setThread] = useState<ThreadPayload | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [draft, setDraft] = useState("");
  const [quota, setQuota] = useState<ServiceQuotaSnapshot | null>(null);
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState<string | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const activeRef = useRef<ConversationListItem | null>(null);
  activeRef.current = active;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
        setErr(null);
      }
      try {
        const qs = new URLSearchParams();
        if (q.trim()) qs.set("q", q.trim());
        if (filter !== "all") qs.set("filter", filter);
        if (locationId) qs.set("locationId", locationId);
        if (provider) qs.set("provider", provider);
        if (phoneNumberId) qs.set("phoneNumberId", phoneNumberId);
        if (team) qs.set("team", team);
        if (agent) qs.set("agent", agent);
        if (lead.trim()) qs.set("lead", lead.trim());
        if (selectedClientId) qs.set("client", selectedClientId);
        const res = await fetch(`/api/conversations?${qs}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          if (!opts?.silent) setErr(data.error || "Failed to load conversations");
          setLoading(false);
          return;
        }
        const rows: ConversationListItem[] = data.conversations || [];
        setConversations(rows);
        setStats(data.stats || { total: 0, unreplied: 0, open: 0, mappings: 0 });
        setQuota(data.quota && data.quota.connected ? data.quota : null);
        setChannels(Array.isArray(data.channels) ? data.channels : []);
        setLastRefresh(new Date());
        const open = activeRef.current;
        if (open) {
          const next = rows.find((r) => r.id === open.id);
          if (next) setActive(next);
        }
      } catch {
        if (!opts?.silent) setErr("Network error");
      } finally {
        setLoading(false);
      }
    },
    [q, filter, locationId, provider, phoneNumberId, team, agent, lead, selectedClientId]
  );

  const loadThread = useCallback(async (id: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setThreadLoading(true);
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        if (!opts?.silent) setErr(data.error || "Failed to load thread");
        return;
      }
      setThread(data);
    } catch {
      if (!opts?.silent) setErr("Network error");
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let timer: number | undefined;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void load({ silent: true });
      const row = activeRef.current;
      if (row) void loadThread(row.id, { silent: true });
    };
    const start = () => {
      if (timer) window.clearInterval(timer);
      const metaLive = isMetaMessaging(activeRef.current?.provider || "");
      timer = window.setInterval(tick, metaLive ? META_THREAD_POLL_MS : POLL_MS);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      } else if (timer) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, loadThread, active?.provider]);

  async function openThread(row: ConversationListItem) {
    setActive(row);
    setThread(null);
    setDraft("");
    setErr(null);
    setSendNote(null);
    setSendErr(null);
    setFreshIds(new Set());
    seenIdsRef.current = new Set();
    await loadThread(row.id);
  }

  useEffect(() => {
    const msgs = thread?.messages;
    if (!msgs) return;
    const ids = msgs.map((m) => m.id);
    const prev = seenIdsRef.current;
    if (prev.size === 0) {
      seenIdsRef.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !prev.has(id));
    seenIdsRef.current = new Set(ids);
    if (fresh.length === 0) return;
    setFreshIds(new Set(fresh));
    const t = window.setTimeout(() => setFreshIds(new Set()), 8000);
    return () => window.clearTimeout(t);
  }, [thread?.messages]);

  const filters = useMemo(
    () =>
      [
        { id: "all" as const, label: t.filterAll },
        { id: "unreplied" as const, label: t.filterUnreplied },
      ] as const,
    [t.filterAll, t.filterUnreplied]
  );

  const emptyCopy = stats.mappings === 0 ? t.emptyNoMap : t.emptyWait;

  const replyPlaceholder =
    active?.provider === "META_CLOUD"
      ? t.replyHq
      : active?.provider === "INSTAGRAM"
        ? t.replyIg
        : t.replyFb;

  const sendTitle =
    active?.provider === "INSTAGRAM"
      ? t.sendTitleIg
      : active?.provider === "FACEBOOK"
        ? t.sendTitleFb
        : t.sendTitleHq;

  const composerHint =
    active?.provider === "INSTAGRAM"
      ? t.composerHintIg
      : active?.provider === "FACEBOOK"
        ? t.composerHintFb
        : t.composerHintHq;

  const sentConfirm =
    active?.provider === "INSTAGRAM"
      ? t.sentConfirmIg
      : active?.provider === "FACEBOOK"
        ? t.sentConfirmFb
        : t.sentConfirmHq;

  return (
    <div className="an-section">
      <PageHeader
        eyebrow={t.eyebrow}
        badge={t.badge}
        title={selectedClientName || t.title}
        description={t.description}
        back={
          isAgency ? (
            <BackLink href="/conversations">{t.allClients}</BackLink>
          ) : undefined
        }
        actions={
          stats.unreplied > 0 ? (
            <span className="an-badge-warn">
              {stats.unreplied} {t.unreplied}
            </span>
          ) : null
        }
      />
      {quota ? (
        <div className="mb-4">
          <ServiceQuotaChip quota={quota} locale={locale} />
        </div>
      ) : null}

      {err && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {err}
        </p>
      )}

      <div className="an-table-wrap">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchField
            placeholder={t.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-none sm:max-w-xs"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                className={filter === f.id ? "an-chip-on" : "an-chip-off"}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
            <select
              className="an-input w-auto min-w-[148px] py-1.5 text-xs"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              title={t.filterBranchTitle}
              aria-label={t.filterBranchTitle}
            >
              <option value="">{t.allLocations}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <select
              className="an-input w-auto min-w-[148px] py-1.5 text-xs"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              title={t.filterSourceTitle}
              aria-label={t.filterSourceTitle}
            >
              <option value="">{t.filterSourceAll}</option>
              <option value="META_CLOUD">{t.filterHq}</option>
              <option value="WAHA">{t.filterBranch}</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="FACEBOOK">Messenger</option>
              <option value="TIKTOK">{t.filterTiktok}</option>
            </select>
            <select
              className="an-input w-auto min-w-[148px] py-1.5 text-xs"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              aria-label="WhatsApp number"
            >
              <option value="">All WhatsApp numbers</option>
              {channels.map((channel) => (
                <option key={channel.phoneNumberId} value={channel.phoneNumberId}>
                  {channel.label}
                </option>
              ))}
            </select>
            <select
              className="an-input w-auto min-w-[120px] py-1.5 text-xs"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              aria-label="Team"
            >
              <option value="">All teams</option>
              {[...new Set(channels.map((channel) => channel.teamLabel).filter(Boolean))].map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="an-input w-auto min-w-[120px] py-1.5 text-xs"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              aria-label="Assigned agent"
            >
              <option value="">All agents</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <input
              className="an-input w-auto min-w-[120px] py-1.5 text-xs"
              value={lead}
              onChange={(e) => setLead(e.target.value)}
              placeholder="Lead status"
              aria-label="Lead status"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-2.5 text-xs text-slate-500">
          <span>
            <span className="font-semibold text-slate-800">{conversations.length}</span>
            {` ${t.cardChats.toLowerCase()}`}
            {loading ? " · …" : ""}
          </span>
          {lastRefresh ? (
            <span className="tabular-nums text-slate-400">
              {t.updated} {formatDateTime(lastRefresh.toISOString(), locale)}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 overflow-x-auto">
          <table className="an-table">
            <thead>
              <tr>
                <th>{t.colLast}</th>
                <th>{t.colSource}</th>
                <th>{t.colContact}</th>
                <th>{t.colPreview}</th>
                <th>{t.colBranch}</th>
                <th>{t.colDirection}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!loading && conversations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                    {emptyCopy}
                  </td>
                </tr>
              ) : (
                conversations.map((row) => {
                  const { title, sub } = contactParts(row.contact, row.provider);
                  return (
                    <tr
                      key={row.id}
                      className={`cursor-pointer ${
                        row.direction === "UNREPLIED" ? "bg-rose-50/25" : ""
                      }`}
                      onClick={() => void openThread(row)}
                    >
                      <td className="whitespace-nowrap text-xs tabular-nums text-slate-400">
                        {formatDateTime(row.lastMessageAt, locale)}
                      </td>
                      <td>
                        <span className={sourceBadgeClass(row.provider)}>
                          {providerLabel(row.provider)}
                        </span>
                        {row.businessLabel || row.assetLabel || isMetaMessaging(row.provider) ? (
                          <div
                            className="mt-0.5 max-w-[160px] truncate text-[11px] text-slate-500"
                            title={row.businessLabel || row.assetLabel || row.sessionId}
                          >
                            {row.businessLabel || row.assetLabel || row.sessionId}
                          </div>
                        ) : null}
                        {row.handoffState === "HUMAN_ACTIVE" ? (
                          <div className="mt-0.5 text-[10px] font-medium text-slate-500">Human</div>
                        ) : null}
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={title} />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-800">{title}</div>
                            {sub ? (
                              <div className="truncate text-[11px] tabular-nums text-slate-400">
                                {sub}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[280px]">
                        <p className="line-clamp-2 leading-snug text-slate-600">
                          {row.preview || "—"}
                        </p>
                      </td>
                      <td>
                        <span className="an-badge-muted">{row.location.name}</span>
                      </td>
                      <td>
                        {row.direction === "UNREPLIED" ? (
                          <span className="an-badge-no">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            {t.unreplied}
                          </span>
                        ) : row.direction === "OUT" ? (
                          <span className="an-badge-yes">{t.dirOut}</span>
                        ) : (
                          <span className="an-badge-muted">{t.dirIn}</span>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="an-btn-soft text-xs"
                          title={t.openTitle}
                          onClick={(e) => {
                            e.stopPropagation();
                            void openThread(row);
                          }}
                        >
                          {t.view}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div
            className="absolute inset-0"
            onClick={() => setActive(null)}
            aria-hidden
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-900">
                  {contactParts(active.contact, active.provider).title}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {providerLabel(active.provider)}
                  {active.assetLabel ? ` · ${active.assetLabel}` : ""}
                  {` · ${active.location.name}`}
                  {contactParts(active.contact, active.provider).sub
                    ? ` · ${contactParts(active.contact, active.provider).sub}`
                    : ""}
                </p>
                {isMetaMessaging(active.provider) ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    {t.colAsset}: {active.assetLabel || active.sessionId}
                    {` · ${t.listeningWebhook}`}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-700"
                onClick={() => setActive(null)}
                aria-label={t.closeThread}
                title={t.closeThread}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {threadLoading && (
                <p className="py-8 text-center text-sm text-slate-400">…</p>
              )}
              {!threadLoading &&
                thread?.messages.map((m) => {
                  const outbound = m.fromMe || m.direction === "OUT";
                  const fresh = freshIds.has(m.id);
                  const meta = isMetaMessaging(active.provider);
                  return (
                    <div
                      key={m.id}
                      className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          outbound
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-800"
                        } ${fresh && !outbound ? "ring-2 ring-[#6fd6f6] ring-offset-2" : ""}`}
                      >
                        {fresh && !outbound && meta ? (
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#2a9bb8]">
                            {t.newViaWebhook}
                          </div>
                        ) : null}
                        <p className="whitespace-pre-wrap leading-snug">{m.body || "—"}</p>
                        {m.fromMe && m.source !== "business_app" && m.source !== "history" && (
                          <div
                            className={`mt-1 text-[10px] ${
                              outbound ? "text-indigo-200" : "text-slate-400"
                            }`}
                          >
                            {t.accountResponder}
                          </div>
                        )}
                        {m.source === "business_app" || m.source === "history" ? (
                          <div
                            className={`mt-1 text-[10px] ${
                              outbound ? "text-indigo-200" : "text-slate-400"
                            }`}
                          >
                            {m.source === "business_app" ? t.businessAppSource : t.historySync}
                          </div>
                        ) : null}
                        {meta ? (
                          <div
                            className={`mt-1 text-[10px] ${
                              outbound ? "text-indigo-100" : "text-slate-500"
                            }`}
                          >
                            {outbound ? t.sentFromApp : t.viaWebhook}
                            {providerNativeClient(active.provider)
                              ? ` · ${providerNativeClient(active.provider)}`
                              : ""}
                          </div>
                        ) : null}
                        <div
                          className={`mt-1 text-[10px] tabular-nums ${
                            outbound ? "text-indigo-200/80" : "text-slate-400"
                          }`}
                        >
                          {formatDateTime(m.sentAt, locale)}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            {active.provider === "META_CLOUD" ||
            active.provider === "FACEBOOK" ||
            active.provider === "INSTAGRAM" ? (
              <form
                className="space-y-2 border-t border-slate-100 px-5 py-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = draft.trim();
                  if (!text || sending) return;
                  setSending(true);
                  setSendErr(null);
                  setSendNote(null);
                  void fetch(`/api/conversations/${active.id}/send`, {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text }),
                  })
                    .then(async (res) => {
                      const data = await res.json();
                      if (!res.ok) {
                        setSendErr(data.error || "Could not send");
                        return;
                      }
                      setDraft("");
                      setSendNote(sentConfirm);
                      await loadThread(active.id);
                      void load({ silent: true });
                    })
                    .finally(() => setSending(false));
                }}
              >
                <p className="text-[11px] text-slate-500">
                  {`${providerLabel(active.provider)} · ${
                    active.businessLabel || active.assetLabel || "Account"
                  } · ${active.location.name} · ${
                    active.assignedUserId ? "Assigned" : "Unassigned"
                  } · ${active.handoffState === "HUMAN_ACTIVE" ? "Human" : "Automation"}`}
                </p>
                {active.provider === "META_CLOUD" ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      {thread?.handoffActive ? t.handoffActive : composerHint}
                    </p>
                    <button
                      type="button"
                      className="an-btn-ghost shrink-0 px-2 py-1 text-[11px]"
                      disabled={sending}
                      onClick={() => {
                        setSending(true);
                        void fetch(`/api/conversations/${active.id}/handoff`, {
                          method: "POST",
                          credentials: "same-origin",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: thread?.handoffActive ? "resume" : "takeover" }),
                        }).finally(async () => {
                          await loadThread(active.id, { silent: true });
                          setSending(false);
                        });
                      }}
                    >
                      {thread?.handoffActive ? t.handoffResume : t.handoffTakeover}
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] leading-relaxed text-slate-500">{composerHint}</p>
                )}
                {sendNote ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800">
                    {sendNote}
                  </p>
                ) : null}
                {sendErr ? (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-800">
                    {sendErr}
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <input
                    className="an-input flex-1 py-2 text-sm"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={replyPlaceholder}
                    disabled={sending}
                    aria-label={replyPlaceholder}
                  />
                  <button
                    type="submit"
                    className="an-btn-primary text-xs"
                    disabled={sending || !draft.trim()}
                    title={sendTitle}
                  >
                    {sending ? "…" : t.send}
                  </button>
                </div>
              </form>
            ) : active.provider === "WAHA" ? (
              <p className="border-t border-slate-100 px-5 py-3 text-[11px] leading-relaxed text-slate-500">
                {t.branchWatch}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
