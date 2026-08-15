"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Avatar,
  PageHeader,
  SearchField,
  TableShell,
  Toolbar,
} from "@/components/ui";
import type { ConversationListItem } from "@/lib/conversations/service";
import { formatDateTime } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/locale";
import { getMessages } from "@/lib/i18n/messages";

type Stats = { total: number; unreplied: number; open: number; mappings: number };

type ThreadMessage = {
  id: string;
  direction: string;
  body: string;
  sentAt: string;
  fromMe: boolean;
};

type ThreadPayload = {
  conversation: ConversationListItem & { tenantId: string };
  messages: ThreadMessage[];
};

function contactLabel(contact: ConversationListItem["contact"]): string {
  return contact.phone || contact.lid || contact.displayName || "—";
}

export function ConversationsInbox({ locale }: { locale: Locale }) {
  const t = getMessages(locale).conversations;
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    unreplied: 0,
    open: 0,
    mappings: 0,
  });
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unreplied">("all");
  const [locationId, setLocationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState<ConversationListItem | null>(null);
  const [thread, setThread] = useState<ThreadPayload | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set("q", q.trim());
      if (filter !== "all") qs.set("filter", filter);
      if (locationId) qs.set("locationId", locationId);
      const res = await fetch(`/api/conversations?${qs}`, { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Failed to load conversations");
        setLoading(false);
        return;
      }
      const rows: ConversationListItem[] = data.conversations || [];
      setConversations(rows);
      setStats(
        data.stats || { total: 0, unreplied: 0, open: 0, mappings: 0 }
      );
      setLocations((prev) => {
        const map = new Map(prev.map((l) => [l.id, l]));
        for (const row of rows) {
          if (row.location?.id) map.set(row.location.id, row.location);
        }
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
      });
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }, [q, filter, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openThread(row: ConversationListItem) {
    setActive(row);
    setThread(null);
    setThreadLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/conversations/${row.id}`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Failed to load thread");
        setThreadLoading(false);
        return;
      }
      setThread(data);
    } catch {
      setErr("Network error");
    } finally {
      setThreadLoading(false);
    }
  }

  const filters = useMemo(
    () =>
      [
        { id: "all" as const, label: t.filterAll },
        { id: "unreplied" as const, label: t.filterUnreplied },
      ] as const,
    [t.filterAll, t.filterUnreplied]
  );

  const emptyCopy =
    stats.mappings === 0 ? t.emptyNoMap : t.emptyWait;

  return (
    <div className="an-section">
      <PageHeader
        eyebrow={t.eyebrow}
        badge={t.badge}
        title={t.title}
        description={t.description}
        actions={
          <span className="an-badge-warn">
            {stats.unreplied} {t.unreplied}
          </span>
        }
      />

      {err && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {err}
        </p>
      )}

      <div className="an-card p-4 text-xs leading-relaxed text-slate-500">
        {t.sourceHint}{" "}
        <Link href="/locations" className="font-semibold text-indigo-600 hover:underline">
          Location 360
        </Link>
      </div>

      <Toolbar>
        <SearchField
          placeholder={t.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
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
            className="an-input w-auto min-w-[160px] text-xs"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="">{t.allLocations}</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </Toolbar>

      <TableShell
        metaLeft={
          <>
            <span className="font-semibold text-slate-800">{conversations.length}</span>
            {loading ? " · loading…" : ""}
          </>
        }
        metaRight={t.badge}
      >
        <table className="an-table">
          <thead>
            <tr>
              <th>{t.colLast}</th>
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
                <td colSpan={6} className="py-10 text-center text-sm text-slate-400">
                  {emptyCopy}
                </td>
              </tr>
            ) : (
              conversations.map((row) => {
                const label = contactLabel(row.contact);
                return (
                  <tr
                    key={row.id}
                    className={row.direction === "UNREPLIED" ? "bg-rose-50/20" : undefined}
                  >
                    <td className="whitespace-nowrap text-xs tabular-nums text-slate-400">
                      {formatDateTime(row.lastMessageAt, locale)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={label} />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800">{label}</div>
                          {row.contact.displayName &&
                            row.contact.displayName !== label && (
                              <div className="truncate text-[11px] text-slate-400">
                                {row.contact.displayName}
                              </div>
                            )}
                          <span className="an-badge-muted mt-0.5">
                            {row.contact.confidence}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[260px]">
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
                      ) : (
                        <span className="an-badge-muted">{row.direction}</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="an-btn-soft text-xs"
                        onClick={() => void openThread(row)}
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
      </TableShell>

      {active && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div
            className="absolute inset-0"
            onClick={() => setActive(null)}
            aria-hidden
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">
                  {contactLabel(active.contact)}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {active.location.name}
                </p>
                <span className="an-badge-muted mt-1.5">
                  {active.contact.confidence}
                </span>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-700"
                onClick={() => setActive(null)}
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
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-snug">
                          {m.body || "—"}
                        </p>
                        {m.fromMe && (
                          <div
                            className={`mt-1 text-[10px] ${
                              outbound ? "text-indigo-200" : "text-slate-400"
                            }`}
                          >
                            {t.accountResponder}
                          </div>
                        )}
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
          </div>
        </div>
      )}
    </div>
  );
}
