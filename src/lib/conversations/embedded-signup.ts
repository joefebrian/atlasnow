import { randomInt } from "crypto";
import { META_GRAPH } from "@/lib/meta/oauth";
import { resolvedMetaApp } from "@/lib/integrations/service";
import { assertCloudPhoneAvailable, mergeCloudConnectorMeta, saveCloudHqConnector } from "@/lib/conversations/cloud-hq";
import { coexistenceLaunchEnabled } from "@/lib/conversations/es-config";
import { decideConnection, type ConnectionMode } from "@/lib/conversations/es-launch";

export const ES_COEXISTENCE_EVENT = "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING";

export type EsSession = {
  event: string;
  wabaId: string;
  phoneNumberId: string;
  businessId: string;
  coexistence: boolean;
};

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v != null ? String(v).trim() : "";
}

export function parseEsSession(raw: unknown): EsSession | { error: string } {
  const root = rec(raw);
  if (!root) return { error: "invalid_session" };
  const inner = rec(root.data) || root;
  const event = str(root.event || inner.event);
  if (event === "CANCEL" || event === "ERROR") {
    return { error: event === "CANCEL" ? "cancelled" : str(inner.error_message) || "es_error" };
  }
  const wabaId = str(inner.waba_id || inner.wabaId);
  const phoneNumberId = str(inner.phone_number_id || inner.phoneNumberId);
  const businessId = str(inner.business_id || inner.businessId);
  if (!wabaId) return { error: "missing_waba" };
  return {
    event: event || "FINISH",
    wabaId,
    phoneNumberId,
    businessId,
    coexistence: event === ES_COEXISTENCE_EVENT,
  };
}

async function graphJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    access_token?: string;
    success?: boolean;
    data?: Array<{ id?: string; display_phone_number?: string; verified_name?: string }>;
    display_phone_number?: string;
    verified_name?: string;
    is_on_biz_app?: boolean;
    platform_type?: string;
    code_verification_status?: string;
    request_id?: string;
  };
  return { ok: res.ok, body };
}

export async function exchangeEsCode(code: string): Promise<string> {
  const m = await resolvedMetaApp();
  if (!m.appId || !m.appSecret) throw new Error("Meta App ID / Secret missing (Settings → API)");
  const url = new URL(`${META_GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", m.appId);
  url.searchParams.set("client_secret", m.appSecret);
  url.searchParams.set("code", code);
  const { ok, body } = await graphJson(url.toString());
  if (!ok || !body.access_token) {
    throw new Error(body.error?.message || "Could not exchange Embedded Signup code");
  }
  return body.access_token;
}

async function firstWabaPhone(wabaId: string, token: string) {
  const url = `${META_GRAPH}/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name`;
  const { ok, body } = await graphJson(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!ok) throw new Error(body.error?.message || "Could not list WABA phone numbers");
  const row = body.data?.[0];
  if (!row?.id) throw new Error("No phone number on this WhatsApp account yet.");
  return {
    phoneNumberId: row.id,
    displayPhone: row.display_phone_number || null,
    verifiedName: row.verified_name || null,
  };
}

async function phoneInfo(phoneNumberId: string, token: string) {
  const url = `${META_GRAPH}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,is_on_biz_app,platform_type,code_verification_status`;
  const { ok, body } = await graphJson(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!ok) throw new Error(body.error?.message || "Cloud API rejected this phone number");
  return {
    displayPhone: body.display_phone_number || null,
    verifiedName: body.verified_name || null,
    coexistence: body.is_on_biz_app === true,
    platformType: body.platform_type || "",
    codeVerificationStatus: body.code_verification_status || "",
  };
}

async function subscribeWaba(wabaId: string, token: string) {
  const url = `${META_GRAPH}/${encodeURIComponent(wabaId)}/subscribed_apps`;
  const { ok, body } = await graphJson(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!ok || body.success === false) {
    throw new Error(body.error?.message || "Could not subscribe webhooks on this WABA");
  }
}

async function registerDedicatedPhone(phoneNumberId: string, token: string) {
  const pin = String(randomInt(100000, 1000000));
  const url = `${META_GRAPH}/${encodeURIComponent(phoneNumberId)}/register`;
  const { ok, body } = await graphJson(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
  });
  if (!ok || body.success === false) {
    throw new Error(body.error?.message || "Could not register the Cloud number");
  }
}

async function kickCoexistenceSync(phoneNumberId: string, token: string) {
  const errors: string[] = [];
  let historyRequestId = "";
  let contactRequestId = "";
  for (const sync_type of ["smb_app_state_sync", "history"] as const) {
    const url = `${META_GRAPH}/${encodeURIComponent(phoneNumberId)}/smb_app_data`;
    try {
      const { ok, body } = await graphJson(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", sync_type }),
      });
      const requestId = body.request_id || "";
      if (!ok) errors.push(body.error?.message || sync_type);
      else if (sync_type === "history") historyRequestId = requestId;
      else contactRequestId = requestId;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : sync_type);
    }
  }
  return {
    historyRequestId,
    contactRequestId,
    syncStatus: errors.length ? "error" : "requested",
    syncDetail: errors.join("; ").slice(0, 240),
  };
}

export async function finishEmbeddedSignup(opts: {
  tenantId: string;
  code: string;
  session: EsSession;
  requestedMode?: ConnectionMode | null;
}): Promise<{
  displayPhone: string | null;
  verifiedName: string | null;
  coexistence: boolean;
  connectionMode: ConnectionMode;
  phoneNumberId: string;
  wabaId: string;
  syncStatus: string;
}> {
  const requestedMode = opts.requestedMode ?? null;
  if ((opts.session.coexistence || requestedMode === "COEXISTENCE") && !coexistenceLaunchEnabled(process.env, opts.tenantId)) {
    throw new Error("coexistence_disabled");
  }
  const token = await exchangeEsCode(opts.code);
  let phoneNumberId = opts.session.phoneNumberId;
  if (!phoneNumberId) {
    const listed = await firstWabaPhone(opts.session.wabaId, token);
    phoneNumberId = listed.phoneNumberId;
  }
  const info = await phoneInfo(phoneNumberId, token);
  const decision = decideConnection({
    sessionCoexistence: opts.session.coexistence,
    graphOnBizApp: info.coexistence,
    requestedMode,
    launchEnabled: coexistenceLaunchEnabled(process.env, opts.tenantId),
  });
  if ("error" in decision) throw new Error(decision.error);
  await assertCloudPhoneAvailable(opts.tenantId, phoneNumberId);
  await subscribeWaba(opts.session.wabaId, token);
  if (decision.mode === "CLOUD_API_ONLY") {
    await registerDedicatedPhone(phoneNumberId, token);
  }
  await saveCloudHqConnector({
    tenantId: opts.tenantId,
    phoneNumberId,
    wabaId: opts.session.wabaId,
    accessToken: token,
    displayPhone: info.displayPhone,
    verifiedName: info.verifiedName,
    connectionMode: decision.mode,
    codeVerificationStatus: info.codeVerificationStatus,
    platformType: info.platformType,
  });
  let syncStatus = decision.mode === "COEXISTENCE" ? "idle" : "not_applicable";
  if (decision.mode === "COEXISTENCE") {
    const sync = await kickCoexistenceSync(phoneNumberId, token);
    syncStatus = sync.syncStatus;
    await mergeCloudConnectorMeta({
      phoneNumberId,
      patch: {
        syncStatus: sync.syncStatus,
        syncDetail: sync.syncDetail,
        historyRequestId: sync.historyRequestId,
        contactRequestId: sync.contactRequestId,
      },
      forceSync: true,
    });
  }
  return {
    displayPhone: info.displayPhone,
    verifiedName: info.verifiedName,
    coexistence: decision.mode === "COEXISTENCE",
    connectionMode: decision.mode,
    phoneNumberId,
    wabaId: opts.session.wabaId,
    syncStatus,
  };
}
