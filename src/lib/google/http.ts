import {
  acquireGoogleRateSlot,
  backoffDelayMs,
  humanizeGoogleQuotaError,
  isGoogleQuotaError,
  sleep,
} from "@/lib/google/rate-limit";

export async function googleFetch(
  url: string,
  accessToken: string,
  init?: RequestInit,
  attempt = 0
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  await acquireGoogleRateSlot();

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg = googleErrorMessage(json, res.status);
    if (isGoogleQuotaError(msg, res.status) && attempt < 5) {
      await sleep(backoffDelayMs(attempt));
      return googleFetch(url, accessToken, init, attempt + 1);
    }
  }

  return { ok: res.ok, status: res.status, json, text };
}

export function googleErrorMessage(json: unknown, status: number): string {
  const err = json as {
    error?: { message?: string; status?: string; details?: unknown[] };
  };
  const raw = err?.error?.message || `Google API error ${status}`;
  return humanizeGoogleQuotaError(raw, status);
}

/** Business Information API expects `locations/{id}` resource name. */
export function toLocationResourceName(externalId: string): string {
  const trimmed = externalId.trim();
  if (trimmed.startsWith("locations/")) return trimmed;
  const tail = trimmed.match(/locations\/[^/?#]+$/i);
  if (tail) return tail[0];
  if (!trimmed.includes("/")) return `locations/${trimmed}`;
  const parts = trimmed.split("/");
  const idx = parts.findIndex((p) => p === "locations");
  if (idx >= 0 && parts[idx + 1]) {
    return `locations/${parts[idx + 1]}`;
  }
  return trimmed;
}
