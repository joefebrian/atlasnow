import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/google/crypto";
import { generateAtlasLocationId } from "@/lib/locations/ids";
import { ensureWabaPhone, PhoneOwnedByAnotherWorkspace } from "@/lib/waba/service-quota";
import { keepSyncStatus, type ConnectionMode } from "@/lib/conversations/es-launch";
import { canonPhone } from "@/lib/conversations/identity";

export const WHATSAPP_CLOUD_PROVIDER = "WHATSAPP_CLOUD";

export type CloudHqConfig = {
  tenantId: string;
  connectorId: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  displayPhone: string | null;
  status: string;
};

function parseMeta(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v == null) continue;
      out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

export async function ensureHqLocation(
  tenantId: string,
  opts?: { name?: string; phone?: string | null }
) {
  const existing = await prisma.location.findFirst({
    where: { tenantId, kind: "HQ", status: { not: "ARCHIVED" } },
  });
  if (existing) {
    const patch: { phone?: string | null; name?: string } = {};
    if (opts?.phone && opts.phone !== existing.phone) patch.phone = opts.phone;
    if (opts?.name && opts.name !== existing.name) patch.name = opts.name;
    if (Object.keys(patch).length) {
      return prisma.location.update({ where: { id: existing.id }, data: patch });
    }
    return existing;
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  return prisma.location.create({
    data: {
      tenantId,
      atlasLocationId: generateAtlasLocationId(),
      name: opts?.name || `${tenant?.name || "Brand"} HQ`,
      kind: "HQ",
      phone: opts?.phone || null,
      status: "ACTIVE",
      readiness: "PARTIAL",
      country: "ID",
      timezone: "Asia/Jakarta",
    },
  });
}

export async function listConnectedCloudHq(): Promise<CloudHqConfig[]> {
  const rows = await prisma.connector.findMany({
    where: { provider: WHATSAPP_CLOUD_PROVIDER, status: { not: "DISCONNECTED" } },
    select: { tenantId: true },
  });
  const out: CloudHqConfig[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.tenantId)) continue;
    seen.add(row.tenantId);
    const cfg = await getCloudHqConfig(row.tenantId);
    if (cfg) out.push(cfg);
  }
  return out;
}

export async function getCloudHqConfig(tenantId: string): Promise<CloudHqConfig | null> {
  const row = await prisma.connector.findUnique({
    where: { tenantId_provider: { tenantId, provider: WHATSAPP_CLOUD_PROVIDER } },
  });
  if (!row || row.status === "DISCONNECTED") return null;
  if (!row.accessTokenEnc) return null;
  const meta = parseMeta(row.metaJson);
  const phoneNumberId = (meta.phoneNumberId || "").trim();
  if (!phoneNumberId) return null;
  try {
    return {
      tenantId,
      connectorId: row.id,
      phoneNumberId,
      wabaId: (meta.wabaId || "").trim(),
      accessToken: decryptSecret(row.accessTokenEnc),
      displayPhone: (meta.displayPhone || "").trim() || null,
      status: row.status,
    };
  } catch {
    return null;
  }
}

export async function findCloudHqByPhoneNumberId(
  phoneNumberId: string
): Promise<CloudHqConfig | null> {
  const id = phoneNumberId.trim();
  if (!id) return null;
  const rows = await prisma.connector.findMany({
    where: { provider: WHATSAPP_CLOUD_PROVIDER, status: { not: "DISCONNECTED" } },
  });
  for (const row of rows) {
    const meta = parseMeta(row.metaJson);
    if ((meta.phoneNumberId || "").trim() !== id) continue;
    if (!row.accessTokenEnc) continue;
    try {
      return {
        tenantId: row.tenantId,
        connectorId: row.id,
        phoneNumberId: id,
        wabaId: (meta.wabaId || "").trim(),
        accessToken: decryptSecret(row.accessTokenEnc),
        displayPhone: (meta.displayPhone || "").trim() || null,
        status: row.status,
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** Read-only. Does not move a phone and does not write a connector. */
export async function assertCloudPhoneAvailable(tenantId: string, phoneNumberId: string) {
  const id = phoneNumberId.trim();
  if (!id || !tenantId.trim()) throw new PhoneOwnedByAnotherWorkspace();
  const owner = await prisma.wabaPhone.findUnique({
    where: { phoneNumberId: id },
    select: { tenantId: true },
  });
  if (owner && owner.tenantId !== tenantId) throw new PhoneOwnedByAnotherWorkspace();
  const rows = await prisma.connector.findMany({
    where: {
      provider: WHATSAPP_CLOUD_PROVIDER,
      status: { not: "DISCONNECTED" },
      NOT: { tenantId },
    },
    select: { metaJson: true },
  });
  for (const row of rows) {
    if ((parseMeta(row.metaJson).phoneNumberId || "").trim() === id) {
      throw new PhoneOwnedByAnotherWorkspace();
    }
  }
}

export type CloudConnectionView = {
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string;
  verifiedName: string;
  connectionMode: ConnectionMode;
  coexistence: boolean;
  connectionStatus: string;
  syncStatus: string;
  syncDetail: string;
  contactSync: string;
  codeVerificationStatus: string;
  lastWebhookAt: string;
  lastHealthAt: string;
  onboardingError: string;
  platformType: string;
  status: string;
};

export function connectionViewFromMeta(
  meta: Record<string, string>,
  status: string,
  lastError: string | null,
  displayName = ""
): CloudConnectionView {
  const connectionMode: ConnectionMode = meta.connectionMode === "COEXISTENCE" ? "COEXISTENCE" : "CLOUD_API_ONLY";
  return {
    phoneNumberId: (meta.phoneNumberId || "").trim(),
    wabaId: (meta.wabaId || "").trim(),
    displayPhone: (meta.displayPhone || "").trim(),
    verifiedName: (meta.verifiedName || displayName || "").trim(),
    connectionMode,
    coexistence: connectionMode === "COEXISTENCE",
    connectionStatus: meta.connectionStatus || status || "CONNECTED",
    syncStatus: meta.syncStatus || (connectionMode === "COEXISTENCE" ? "idle" : "not_applicable"),
    syncDetail: meta.syncDetail || "",
    contactSync: meta.contactSync || "",
    codeVerificationStatus: meta.codeVerificationStatus || "",
    lastWebhookAt: meta.lastWebhookAt || "",
    lastHealthAt: meta.lastHealthAt || "",
    onboardingError: meta.onboardingError || lastError || "",
    platformType: meta.platformType || "",
    status,
  };
}

const PHONE_SCOPED_META = [
  "syncStatus",
  "syncDetail",
  "historyRequestId",
  "contactRequestId",
  "onboardingError",
  "connectionMode",
  "coexistence",
  "codeVerificationStatus",
  "platformType",
  "connectionStatus",
];

export async function saveCloudHqConnector(opts: {
  tenantId: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  displayPhone?: string | null;
  verifiedName?: string | null;
  connectionMode?: ConnectionMode | null;
  codeVerificationStatus?: string | null;
  platformType?: string | null;
}) {
  const phoneNumberId = opts.phoneNumberId.trim();
  const wabaId = opts.wabaId.trim();
  const displayPhone = (opts.displayPhone || "").trim();
  const verifiedName = (opts.verifiedName || "").trim();
  const existing = await prisma.connector.findUnique({
    where: { tenantId_provider: { tenantId: opts.tenantId, provider: WHATSAPP_CLOUD_PROVIDER } },
    select: { metaJson: true },
  });
  const prev = parseMeta(existing?.metaJson);
  const samePhone = (prev.phoneNumberId || "").trim() === phoneNumberId;
  const carried = samePhone ? { ...prev } : {};
  if (!samePhone) {
    for (const key of PHONE_SCOPED_META) delete carried[key];
  }
  const meta: Record<string, string> = {
    ...carried,
    phoneNumberId,
    wabaId,
    displayPhone,
    verifiedName,
    onboardingError: "",
    connectionStatus: "connected",
    lastHealthAt: new Date().toISOString(),
  };
  if (opts.connectionMode) {
    meta.connectionMode = opts.connectionMode;
    meta.coexistence = opts.connectionMode === "COEXISTENCE" ? "true" : "false";
    if (!samePhone || prev.connectionMode !== opts.connectionMode) {
      meta.syncStatus = opts.connectionMode === "COEXISTENCE" ? "idle" : "not_applicable";
    }
  }
  if (opts.codeVerificationStatus) meta.codeVerificationStatus = opts.codeVerificationStatus.trim();
  if (opts.platformType) meta.platformType = opts.platformType.trim();
  await assertCloudPhoneAvailable(opts.tenantId, phoneNumberId);
  await ensureWabaPhone({
    tenantId: opts.tenantId,
    phoneNumberId,
    wabaId,
    displayPhone,
  });
  const tokenEnc = encryptSecret(opts.accessToken.trim());
  const row = await prisma.connector.upsert({
    where: {
      tenantId_provider: { tenantId: opts.tenantId, provider: WHATSAPP_CLOUD_PROVIDER },
    },
    create: {
      tenantId: opts.tenantId,
      provider: WHATSAPP_CLOUD_PROVIDER,
      status: "CONNECTED",
      displayName: verifiedName || displayPhone || "WhatsApp HQ",
      accessTokenEnc: tokenEnc,
      mode: "LIVE",
      lastError: null,
      metaJson: JSON.stringify(meta),
    },
    update: {
      status: "CONNECTED",
      displayName: verifiedName || displayPhone || "WhatsApp HQ",
      accessTokenEnc: tokenEnc,
      lastError: null,
      metaJson: JSON.stringify(meta),
    },
  });
  await ensureHqLocation(opts.tenantId, {
    phone: displayPhone || null,
    name: verifiedName ? `${verifiedName} HQ` : undefined,
  });
  return row;
}

export async function readCloudConnection(tenantId: string): Promise<CloudConnectionView | null> {
  const row = await prisma.connector.findUnique({
    where: { tenantId_provider: { tenantId, provider: WHATSAPP_CLOUD_PROVIDER } },
  });
  if (!row || row.status === "DISCONNECTED" || !row.accessTokenEnc) return null;
  const view = connectionViewFromMeta(parseMeta(row.metaJson), row.status, row.lastError, row.displayName || "");
  if (!view.phoneNumberId) return null;
  return view;
}

/** Merge webhook notes into the existing connector. Does not rotate the token or move the phone. */
export async function mergeCloudConnectorMeta(input: {
  phoneNumberId?: string;
  wabaId?: string;
  displayPhone?: string;
  patch: Record<string, string>;
  lastError?: string | null;
  clearError?: boolean;
  forceSync?: boolean;
}) {
  const phoneNumberId = (input.phoneNumberId || "").trim();
  const wabaId = (input.wabaId || "").trim();
  const displayPhone = canonPhone(input.displayPhone || "");
  if (!phoneNumberId && !wabaId && displayPhone.length < 8) return 0;
  const rows = await prisma.connector.findMany({
    where: { provider: WHATSAPP_CLOUD_PROVIDER, status: { not: "DISCONNECTED" } },
  });
  let updated = 0;
  for (const row of rows) {
    const meta = parseMeta(row.metaJson);
    const phone = (meta.phoneNumberId || "").trim();
    const waba = (meta.wabaId || "").trim();
    const shown = canonPhone(meta.displayPhone || "");
    if (phoneNumberId && phone !== phoneNumberId) continue;
    if (!phoneNumberId && wabaId && waba !== wabaId) continue;
    if (!phoneNumberId && !wabaId && shown !== displayPhone) continue;
    const next = { ...meta, ...input.patch };
    if (input.patch.syncStatus && !input.forceSync) {
      next.syncStatus = keepSyncStatus(meta.syncStatus || "", input.patch.syncStatus);
    }
    await prisma.connector.update({
      where: { id: row.id },
      data: {
        metaJson: JSON.stringify(next),
        ...(input.clearError ? { lastError: null } : {}),
        ...(input.lastError ? { lastError: input.lastError.slice(0, 500) } : {}),
      },
    });
    updated += 1;
  }
  return updated;
}

export async function disconnectCloudHq(tenantId: string) {
  await prisma.connector.updateMany({
    where: { tenantId, provider: WHATSAPP_CLOUD_PROVIDER },
    data: { status: "DISCONNECTED", accessTokenEnc: null, lastError: null },
  });
}
