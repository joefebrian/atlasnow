function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Body passed to YOLA and workspace automation.
 * Keeps customer `messages` and delivery statuses. Drops Business App echoes,
 * history, contact sync, and customer wamids suppressed for a human handoff.
 */
export function customerInboundBody(body: unknown, suppressWamids: readonly string[]): unknown {
  const root = record(body);
  if (!root || !Array.isArray(root.entry)) return body;
  const suppress = new Set(suppressWamids);
  const entry = root.entry.map((item) => {
    const row = record(item);
    if (!row || !Array.isArray(row.changes)) return item;
    const changes = row.changes.flatMap((change) => {
      const current = record(change);
      if (!current) return [];
      const field = typeof current.field === "string" ? current.field : "";
      if (field && field !== "messages") return [];
      const value = record(current.value);
      if (!value) return [change];
      const messages = Array.isArray(value.messages)
        ? value.messages.filter((message) => {
            const parsed = record(message);
            const id = typeof parsed?.id === "string" ? parsed.id : "";
            return Boolean(id) && !suppress.has(id);
          })
        : [];
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      if (!messages.length && !statuses.length) return [];
      const cleaned: Record<string, unknown> = { ...value, messages };
      delete cleaned.message_echoes;
      delete cleaned.history;
      delete cleaned.state_sync;
      return [{ ...current, field: field || "messages", value: cleaned }];
    });
    return { ...row, changes };
  });
  return { ...root, entry };
}

/** Default staff handoff. This is not the Cloud API 24-hour customer service window. */
export const DEFAULT_HANDOFF_MINUTES = 30;

/** Platform setting. 0 keeps HUMAN_ACTIVE until an explicit resume. Values above 4 hours fall back to the default. */
export function handoffMinutes(env: Record<string, string | undefined> = process.env): number {
  const raw = env.WHATSAPP_HANDOFF_MINUTES;
  if (raw == null || raw.trim() === "") return DEFAULT_HANDOFF_MINUTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 240) return DEFAULT_HANDOFF_MINUTES;
  return parsed;
}

export function handoffExpiry(from: Date, minutes = handoffMinutes()): Date | null {
  if (minutes <= 0) return null;
  return new Date(from.getTime() + minutes * 60_000);
}

/** True only while this conversation is in HUMAN_ACTIVE and its own expiry has not passed. */
export function humanHandoffActive(input: { state: string; until: Date | null; now: Date }): boolean {
  if (input.state !== "HUMAN_ACTIVE") return false;
  if (!input.until) return true;
  return input.now.getTime() < input.until.getTime();
}
