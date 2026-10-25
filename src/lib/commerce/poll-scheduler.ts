import { resumeCatalogBatches } from "@/lib/commerce/connection-service";

/** One tick handles a small batch. A crashed worker's lock can be reclaimed after this lease inside resume. */
export const COMMERCE_POLL_LIMIT = 5;

/** Live polling stays off until this is exactly "true". The sync switch does not turn this on. */
export function commercePollLiveEnabled(env: Record<string, string | undefined> = process.env) {
  return env.COMMERCE_CATALOG_POLL_ENABLED === "true";
}

export type PollTick = {
  enabled: boolean;
  polled: number;
  statuses: string[];
};

/**
 * Internal tick. When polling is off, this does not read jobs and does not call Meta.
 * The summary has counts only. It does not include tokens, handles, or catalog ids.
 */
export async function runCommercePollTick(opts: { fetchImpl?: typeof fetch; now?: Date } = {}): Promise<PollTick> {
  if (!commercePollLiveEnabled()) return { enabled: false, polled: 0, statuses: [] };
  const jobs = await resumeCatalogBatches({ limit: COMMERCE_POLL_LIMIT, fetchImpl: opts.fetchImpl, now: opts.now });
  const statuses = jobs.map((job) => job.status);
  console.info(JSON.stringify({ source: "commerce.poll", enabled: true, polled: jobs.length, statuses }));
  return { enabled: true, polled: jobs.length, statuses };
}
