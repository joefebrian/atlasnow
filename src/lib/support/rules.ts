export const SILENCE_MS = 10 * 60 * 1000;
export const AGENT_NAME = "Radit";
export const PRESENCE_TTL_MS = 45_000;

export type SupportThreadStatus = "QUEUED" | "ACTIVE" | "CLOSED";
export type SupportVisitorKind = "PROSPECT" | "USER";
export type SupportCloseReason = "VISITOR_SILENCE" | "AGENT" | "VISITOR_ENDED";
export type SupportFrom = "VISITOR" | "AGENT";

export function visitorMessageSeen(openedAt: Date | null, sentAt: Date): boolean {
  return openedAt != null && openedAt.getTime() >= sentAt.getTime();
}

export function silenceDeadline(lastAgentAt: Date): Date {
  return new Date(lastAgentAt.getTime() + SILENCE_MS);
}

export function shouldCloseForSilence(
  thread: {
    status: string;
    lastAgentAt: Date | null;
    lastVisitorAt: Date | null;
    silenceDeadlineAt: Date | null;
  },
  now: Date
): boolean {
  if (thread.status !== "ACTIVE") return false;
  if (!thread.lastAgentAt) return false;
  if (thread.lastVisitorAt && thread.lastVisitorAt.getTime() > thread.lastAgentAt.getTime()) {
    return false;
  }
  const deadline = thread.silenceDeadlineAt ?? silenceDeadline(thread.lastAgentAt);
  return now.getTime() >= deadline.getTime();
}

export function canVisitorSend(opts: {
  hoursOpen: boolean;
  threadStatus: string | null;
}): { ok: true } | { ok: false; reason: "closed_hours" } {
  if (opts.threadStatus === "ACTIVE") return { ok: true };
  if (!opts.hoursOpen) return { ok: false, reason: "closed_hours" };
  return { ok: true };
}

export function canAgentOpenThread(opts: {
  activeId: string | null;
  targetId: string;
  hoursOpen: boolean;
}): boolean {
  if (opts.activeId && opts.activeId !== opts.targetId) return false;
  if (!opts.hoursOpen && opts.activeId !== opts.targetId) return false;
  return true;
}

/** After 17:00, do not promote the next QUEUED thread. */
export function nextQueuedNotAutoOpenedAfterHours(hoursOpen: boolean): boolean {
  return !hoursOpen;
}

export function presenceIsActive(agentSeenAt: Date | null, now: Date): boolean {
  if (!agentSeenAt) return false;
  return now.getTime() - agentSeenAt.getTime() <= PRESENCE_TTL_MS;
}
