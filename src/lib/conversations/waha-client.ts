import { getWahaBaseUrl, getWahaWebhookKey } from "./waha-config";
import {
  isLiveWahaEngineStatus,
  pairingPhoneDigits,
  wahaMaxLiveSessions,
  wahaSlotAvailable,
  wahaSlotFullMessage,
  webhookUrlForWaha,
} from "./waha-session";
import { resolvedAppBaseUrl } from "@/lib/integrations/service";

export type WahaSessionInfo = {
  name: string;
  status: string;
  me?: { id?: string; pushName?: string } | null;
};

async function wahaAuth(): Promise<{ base: string; key: string } | null> {
  const base = await getWahaBaseUrl();
  const key = await getWahaWebhookKey();
  if (!base || !key) return null;
  return { base, key };
}

function headers(key: string, extra?: Record<string, string>): HeadersInit {
  return {
    "X-Api-Key": key,
    Accept: "application/json",
    ...extra,
  };
}

export async function listWahaSessions(): Promise<WahaSessionInfo[] | null> {
  const auth = await wahaAuth();
  if (!auth) return null;
  try {
    const res = await fetch(`${auth.base}/api/sessions?all=true`, {
      headers: headers(auth.key),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as WahaSessionInfo[] | { sessions?: WahaSessionInfo[] };
    return Array.isArray(data) ? data : data.sessions || [];
  } catch {
    return null;
  }
}

export async function getWahaSession(name: string): Promise<WahaSessionInfo | null> {
  const auth = await wahaAuth();
  if (!auth || !name) return null;
  try {
    const res = await fetch(`${auth.base}/api/sessions/${encodeURIComponent(name)}`, {
      headers: headers(auth.key),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as WahaSessionInfo;
  } catch {
    return null;
  }
}

export type WahaSessionResult = {
  session: WahaSessionInfo | null;
  error?: string;
  code?: "WAHA_SLOT_FULL";
  live?: number;
  max?: number;
};

async function guardLiveSlot(replacingLive: boolean): Promise<WahaSessionResult | null> {
  const listed = await listWahaSessions();
  const max = wahaMaxLiveSessions();
  if (!listed) {
    return {
      session: null,
      error: "Could not read WhatsApp slots. Try Connect again in a moment.",
    };
  }
  const live = listed.filter((s) => isLiveWahaEngineStatus(s.status)).length;
  if (!wahaSlotAvailable(live, max, replacingLive)) {
    return {
      session: null,
      error: wahaSlotFullMessage(live, max),
      code: "WAHA_SLOT_FULL",
      live,
      max,
    };
  }
  return null;
}

export async function ensureWahaSession(opts: {
  name: string;
  deviceName: string;
}): Promise<WahaSessionResult> {
  const auth = await wahaAuth();
  if (!auth) return { session: null, error: "WAHA is not configured (Settings → API)." };

  const existing = await getWahaSession(opts.name);
  if (existing) {
    const st = (existing.status || "").toUpperCase();
    if (st === "STOPPED") {
      const blocked = await guardLiveSlot(false);
      if (blocked) return blocked;
      try {
        await fetch(
          `${auth.base}/api/sessions/${encodeURIComponent(opts.name)}/start`,
          {
            method: "POST",
            headers: headers(auth.key, { "Content-Type": "application/json" }),
            signal: AbortSignal.timeout(15000),
          }
        );
      } catch {
        /* status poll will show */
      }
      return { session: (await getWahaSession(opts.name)) || existing };
    }
    return { session: existing };
  }

  const blocked = await guardLiveSlot(false);
  if (blocked) return blocked;
  return createWahaSession(opts, auth);
}

async function createWahaSession(
  opts: { name: string; deviceName: string },
  auth: { base: string; key: string }
): Promise<{ session: WahaSessionInfo | null; error?: string }> {
  const appBase = await resolvedAppBaseUrl();
  const hook = webhookUrlForWaha(appBase);
  try {
    const res = await fetch(`${auth.base}/api/sessions`, {
      method: "POST",
      headers: headers(auth.key, { "Content-Type": "application/json" }),
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        name: opts.name,
        start: true,
        config: {
          client: { deviceName: opts.deviceName.slice(0, 40) || "AtlasNow", browserName: "Chrome" },
          metadata: { "atlas.location": opts.name },
          ignore: { status: true, groups: true, channels: true, broadcast: true },
          webhooks: [
            {
              url: hook,
              events: ["message", "message.any", "session.status"],
              customHeaders: [{ name: "X-Api-Key", value: auth.key }],
            },
          ],
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        session: null,
        error: text.slice(0, 240) || `WAHA create failed (${res.status})`,
      };
    }
    const created = (await res.json()) as WahaSessionInfo;
    return { session: created };
  } catch (e) {
    return {
      session: null,
      error: e instanceof Error ? e.message : "Could not reach WAHA",
    };
  }
}

export async function getWahaQr(name: string): Promise<{
  mimetype: string;
  data: string;
} | null> {
  const auth = await wahaAuth();
  if (!auth || !name) return null;
  try {
    const res = await fetch(`${auth.base}/api/${encodeURIComponent(name)}/auth/qr`, {
      headers: headers(auth.key),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { mimetype?: string; data?: string };
    if (!data.data) return null;
    return { mimetype: data.mimetype || "image/png", data: data.data };
  } catch {
    return null;
  }
}

export async function requestWahaPairingCode(
  name: string,
  phone: string
): Promise<{ code: string } | { error: string }> {
  const auth = await wahaAuth();
  if (!auth) return { error: "WAHA is not configured" };
  const digits = pairingPhoneDigits(phone);
  if (!digits) return { error: "Location needs a valid phone number" };
  try {
    const res = await fetch(
      `${auth.base}/api/${encodeURIComponent(name)}/auth/request-code`,
      {
        method: "POST",
        headers: headers(auth.key, { "Content-Type": "application/json" }),
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ phoneNumber: digits }),
      }
    );
    const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    if (!res.ok || !data.code) {
      return { error: data.message || `Pairing code unavailable (${res.status})` };
    }
    return { code: data.code };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not reach WAHA" };
  }
}

async function wahaPost(path: string, key: string, base: string, ms = 15000) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: headers(key, { "Content-Type": "application/json" }),
    signal: AbortSignal.timeout(ms),
  });
}

export async function deleteWahaSession(name: string): Promise<void> {
  const auth = await wahaAuth();
  if (!auth || !name) return;
  const enc = encodeURIComponent(name);
  try {
    await wahaPost(`/api/sessions/${enc}/stop`, auth.key, auth.base, 10000);
  } catch {
    /* ignore */
  }
  try {
    await wahaPost(`/api/sessions/${enc}/logout`, auth.key, auth.base, 15000);
  } catch {
    /* ignore */
  }
  try {
    await fetch(`${auth.base}/api/sessions/${enc}`, {
      method: "DELETE",
      headers: headers(auth.key),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    /* ignore */
  }
}

/** Stop Chromium without deleting the session — used when QR is cancelled or expired. */
export async function stopWahaSession(name: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await wahaAuth();
  if (!auth) return { ok: false, error: "WAHA is not configured" };
  if (!name) return { ok: false, error: "Missing session" };
  try {
    const res = await wahaPost(
      `/api/sessions/${encodeURIComponent(name)}/stop`,
      auth.key,
      auth.base,
      15000
    );
    if (!res.ok && res.status !== 404) {
      return { ok: false, error: `Stop failed (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reach WAHA" };
  }
}

export async function relinkWahaSession(opts: {
  name: string;
  deviceName: string;
}): Promise<WahaSessionResult & { relinked?: boolean }> {
  const auth = await wahaAuth();
  if (!auth) return { session: null, error: "WAHA is not configured (Settings → API)." };
  const existing = await getWahaSession(opts.name);
  const replacingLive = isLiveWahaEngineStatus(existing?.status);
  const blocked = await guardLiveSlot(replacingLive);
  if (blocked) return blocked;
  await deleteWahaSession(opts.name);
  await new Promise((r) => setTimeout(r, 500));
  const created = await createWahaSession(opts, auth);
  return { ...created, relinked: true };
}

export async function logoutWahaSession(name: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await wahaAuth();
  if (!auth) return { ok: false, error: "WAHA is not configured" };
  try {
    const res = await fetch(
      `${auth.base}/api/sessions/${encodeURIComponent(name)}/logout`,
      {
        method: "POST",
        headers: headers(auth.key, { "Content-Type": "application/json" }),
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!res.ok && res.status !== 404) {
      return { ok: false, error: `Logout failed (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reach WAHA" };
  }
}
