const DAY_MS = 24 * 60 * 60 * 1000;

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

/** Staff Business App traffic must not start automation. History never counts as a handoff. */
export function suppressForHumanHandoff(input: {
  sentAt: Date;
  echoInPayload: boolean;
  previous: { fromMe: boolean; source: string; sentAt: Date } | null;
}): boolean {
  if (input.echoInPayload) return true;
  const previous = input.previous;
  if (!previous?.fromMe || previous.source !== "business_app") return false;
  const delta = input.sentAt.getTime() - previous.sentAt.getTime();
  return delta >= 0 && delta <= DAY_MS;
}
