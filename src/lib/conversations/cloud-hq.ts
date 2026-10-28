import { prisma } from "@/lib/db";
import { connectorUnique } from "@/lib/connectors/key";
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

export type NumberHealth = "healthy" | "not_configured" | "disconnected" | "unauthorized" | "needs_attention";

export type WorkspaceWhatsAppNumber = {
  phoneNumberId: string;
  displayPhone: string;
  wabaId: string;
  alias: string;
  label: string;
  teamLabel: string;
  locationId: string | null;
  locationName: string | null;
  isDefault: boolean;
  connectionMode: ConnectionMode | "";
  health: NumberHealth;
  lastActivity: string;
  phoneStatus: string;
  onboardingError: string;
};

type ConnectorRow = {
  id: string;
  tenantId: string;
  status: string;
  accessTokenEnc: string | null;
  lastError: string | null;
  displayName: string | null;
  metaJson: string | null;
  accountKey: string;
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

export function cloudPhoneFromSession(sessionId: string): string {
  const prefix = "cloud:";
  return sessionId.startsWith(prefix) ? sessionId.slice(prefix.length).trim() : "";
}

export function deriveNumberHealth(row: {
  status: string;
  accessTokenEnc: string | null;
  lastError: string | null;
  metaJson: string | null;
} | null): NumberHealth {
  if (!row) return "not_configured";
  if (row.status === "DISCONNECTED") return "disconnected";
  if (!row.accessTokenEnc) return "not_configured";
  const meta = parseMeta(row.metaJson);
  if (row.status === "UNAUTHORIZED" || meta.connectionStatus === "unauthorized") return "unauthorized";
  if (row.lastError && /unauthorized|oauth|invalid token|error.?190/i.test(row.lastError)) return "unauthorized";
  try {
    decryptSecret(row.accessTokenEnc);
  } catch {
    return "unauthorized";
  }
  if (meta.connectionStatus === "needs_attention" || meta.automationPaused === "true") return "needs_attention";
  return "healthy";
}

function configFromRow(row: ConnectorRow | null, expectedPhone = ""): CloudHqConfig | null {
  if (!row || row.status === "DISCONNECTED" || !row.accessTokenEnc) return null;
  const meta = parseMeta(row.metaJson);
  const phoneNumberId = (meta.phoneNumberId || row.accountKey || "").trim();
  if (!phoneNumberId) return null;
  if (expectedPhone && phoneNumberId !== expectedPhone) return null;
  try {
    return {
      tenantId: row.tenantId,
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
  });
  const out: CloudHqConfig[] = [];
  for (const row of rows) {
    const cfg = configFromRow(row);
    if (cfg) out.push(cfg);
  }
  return out;
}

async function connectedConfigs(tenantId: string): Promise<CloudHqConfig[]> {
  const rows = await prisma.connector.findMany({
    where: { tenantId, provider: WHATSAPP_CLOUD_PROVIDER, status: { not: "DISCONNECTED" } },
  });
  const out: CloudHqConfig[] = [];
  for (const row of rows) {
    const cfg = configFromRow(row);
    if (cfg) out.push(cfg);
  }
  return out;
}

/** Phone argument selects that number only. Omitted uses the default, or the only connected number. */
export async function getCloudHqConfig(
  tenantId: string,
  phoneNumberId?: string | null
): Promise<CloudHqConfig | null> {
  const phone = (phoneNumberId || "").trim();
  if (phone) {
    const row = await prisma.connector.findUnique({
      where: connectorUnique(tenantId, WHATSAPP_CLOUD_PROVIDER, phone),
    });
    return configFromRow(row, phone);
  }
  const preferred = await prisma.wabaPhone.findFirst({
    where: { tenantId, isDefault: true, status: "ACTIVE" },
    select: { phoneNumberId: true },
  });
  if (preferred) {
    const hit = await getCloudHqConfig(tenantId, preferred.phoneNumberId);
    if (hit) return hit;
  }
  const usable = await connectedConfigs(tenantId);
  return usable.length === 1 ? usable[0] : null;
}

export async function cloudSendConfig(
  tenantId: string,
  sessionId: string,
  businessPhoneNumberId = ""
): Promise<CloudHqConfig | null> {
  const phone = businessPhoneNumberId.trim() || cloudPhoneFromSession(sessionId);
  if (!phone) return null;
  const cfg = await getCloudHqConfig(tenantId, phone);
  if (!cfg || cfg.phoneNumberId !== phone || cfg.tenantId !== tenantId) return null;
  return cfg;
}

export async function findCloudHqByPhoneNumberId(
  phoneNumberId: string
): Promise<CloudHqConfig | null> {
  const id = phoneNumberId.trim();
  if (!id) return null;
  const owner = await prisma.wabaPhone.findUnique({
    where: { phoneNumberId: id },
    select: { tenantId: true },
  });
  const rows = await prisma.connector.findMany({
    where: {
      provider: WHATSAPP_CLOUD_PROVIDER,
      accountKey: id,
      status: { not: "DISCONNECTED" },
    },
  });
  const owned = owner ? rows.filter((row) => row.tenantId === owner.tenantId) : rows;
  if (owned.length === 1) return configFromRow(owned[0], id);
  if (owned.length > 1) return null;
  const legacy = await prisma.connector.findMany({
    where: { provider: WHATSAPP_CLOUD_PROVIDER, status: { not: "DISCONNECTED" }, accountKey: "" },
  });
  const matches = legacy.filter((row) => {
    if (owner && row.tenantId !== owner.tenantId) return false;
    return (parseMeta(row.metaJson).phoneNumberId || "").trim() === id;
  });
  if (matches.length !== 1) return null;
  return configFromRow(matches[0], id);
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
  const other = await prisma.connector.findFirst({
    where: {
      provider: WHATSAPP_CLOUD_PROVIDER,
      accountKey: id,
      status: { not: "DISCONNECTED" },
      NOT: { tenantId },
    },
    select: { id: true },
  });
  if (other) throw new PhoneOwnedByAnotherWorkspace();
  const rows = await prisma.connector.findMany({
    where: {
      provider: WHATSAPP_CLOUD_PROVIDER,
      accountKey: "",
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
    where: connectorUnique(opts.tenantId, WHATSAPP_CLOUD_PROVIDER, phoneNumberId),
    select: { metaJson: true },
  });
  const prev = parseMeta(existing?.metaJson);
  const samePhone = !existing || (prev.phoneNumberId || "").trim() === phoneNumberId;
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
  const peers = await prisma.wabaPhone.count({ where: { tenantId: opts.tenantId } });
  await prisma.wabaPhone.update({
    where: { phoneNumberId },
    data: {
      ...(peers === 1 ? { isDefault: true } : {}),
      ...(opts.connectionMode ? { connectionMode: opts.connectionMode } : {}),
    },
  });
  const tokenEnc = encryptSecret(opts.accessToken.trim());
  const row = await prisma.connector.upsert({
    where: connectorUnique(opts.tenantId, WHATSAPP_CLOUD_PROVIDER, phoneNumberId),
    create: {
      tenantId: opts.tenantId,
      provider: WHATSAPP_CLOUD_PROVIDER,
      accountKey: phoneNumberId,
      status: "CONNECTED",
      displayName: verifiedName || displayPhone || "WhatsApp",
      accessTokenEnc: tokenEnc,
      mode: "LIVE",
      lastError: null,
      metaJson: JSON.stringify(meta),
    },
    update: {
      status: "CONNECTED",
      displayName: verifiedName || displayPhone || "WhatsApp",
      accessTokenEnc: tokenEnc,
      lastError: null,
      metaJson: JSON.stringify(meta),
    },
  });
  const savedPhone = await prisma.wabaPhone.findUnique({
    where: { phoneNumberId },
    select: { isDefault: true },
  });
  if (peers <= 1 || savedPhone?.isDefault) {
    await ensureHqLocation(opts.tenantId, {
      phone: displayPhone || null,
      name: verifiedName ? `${verifiedName} HQ` : undefined,
    });
  } else {
    await ensureHqLocation(opts.tenantId);
  }
  return row;
}

export async function readCloudConnection(
  tenantId: string,
  phoneNumberId?: string | null
): Promise<CloudConnectionView | null> {
  const phone = (phoneNumberId || "").trim();
  const row = phone
    ? await prisma.connector.findUnique({
        where: connectorUnique(tenantId, WHATSAPP_CLOUD_PROVIDER, phone),
      })
    : null;
  const chosen = row || (await (async () => {
    const cfg = await getCloudHqConfig(tenantId);
    if (!cfg) return null;
    return prisma.connector.findUnique({ where: { id: cfg.connectorId } });
  })());
  if (!chosen || chosen.status === "DISCONNECTED" || !chosen.accessTokenEnc) return null;
  const view = connectionViewFromMeta(parseMeta(chosen.metaJson), chosen.status, chosen.lastError, chosen.displayName || "");
  if (!view.phoneNumberId) return null;
  return view;
}

export async function listWorkspaceWhatsAppNumbers(tenantId: string): Promise<WorkspaceWhatsAppNumber[]> {
  const [phones, connectors] = await Promise.all([
    prisma.wabaPhone.findMany({
      where: { tenantId },
      include: { location: { select: { id: true, name: true } } },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    prisma.connector.findMany({
      where: { tenantId, provider: WHATSAPP_CLOUD_PROVIDER },
    }),
  ]);
  const byPhone = new Map(connectors.map((row) => [row.accountKey, row]));
  const seen = new Set<string>();
  const out: WorkspaceWhatsAppNumber[] = [];
  for (const phone of phones) {
    seen.add(phone.phoneNumberId);
    const connector = byPhone.get(phone.phoneNumberId) || null;
    const meta = parseMeta(connector?.metaJson);
    const storedMode = meta.connectionMode || phone.connectionMode;
    const mode: ConnectionMode | "" = storedMode === "COEXISTENCE"
      ? "COEXISTENCE"
      : connector
        ? "CLOUD_API_ONLY"
        : storedMode === "CLOUD_API_ONLY"
          ? "CLOUD_API_ONLY"
          : "";
    const displayPhone = phone.displayPhone || meta.displayPhone || "";
    out.push({
      phoneNumberId: phone.phoneNumberId,
      displayPhone,
      wabaId: phone.wabaId || meta.wabaId || "",
      alias: phone.alias || "",
      label: phone.alias || displayPhone || phone.phoneNumberId,
      teamLabel: phone.teamLabel || "",
      locationId: phone.locationId,
      locationName: phone.location?.name || null,
      isDefault: phone.isDefault,
      connectionMode: mode,
      health: deriveNumberHealth(connector),
      lastActivity: meta.lastWebhookAt || meta.lastHealthAt || "",
      phoneStatus: phone.status,
      onboardingError: meta.onboardingError || connector?.lastError || "",
    });
  }
  for (const connector of connectors) {
    if (!connector.accountKey || seen.has(connector.accountKey)) continue;
    const meta = parseMeta(connector.metaJson);
    const displayPhone = meta.displayPhone || "";
    out.push({
      phoneNumberId: connector.accountKey,
      displayPhone,
      wabaId: meta.wabaId || "",
      alias: "",
      label: displayPhone || connector.accountKey,
      teamLabel: "",
      locationId: null,
      locationName: null,
      isDefault: false,
      connectionMode: meta.connectionMode === "COEXISTENCE" ? "COEXISTENCE" : meta.connectionMode === "CLOUD_API_ONLY" ? "CLOUD_API_ONLY" : "",
      health: deriveNumberHealth(connector),
      lastActivity: meta.lastWebhookAt || meta.lastHealthAt || "",
      phoneStatus: "",
      onboardingError: meta.onboardingError || connector.lastError || "",
    });
  }
  return out;
}

/** Merge webhook notes into the matching connector. Does not rotate the token or move the phone. */
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
  const matches = rows.filter((row) => {
    const meta = parseMeta(row.metaJson);
    const phone = (row.accountKey || meta.phoneNumberId || "").trim();
    const waba = (meta.wabaId || "").trim();
    const shown = canonPhone(meta.displayPhone || "");
    if (phoneNumberId) return phone === phoneNumberId;
    if (wabaId) return waba === wabaId;
    return shown === displayPhone;
  });
  if (!phoneNumberId) {
    const tenants = new Set(matches.map((row) => row.tenantId));
    if (tenants.size !== 1) return 0;
  }
  let updated = 0;
  for (const row of matches) {
    const meta = parseMeta(row.metaJson);
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

export async function disconnectCloudHq(tenantId: string, phoneNumberId?: string | null) {
  const phone = (phoneNumberId || "").trim();
  await prisma.connector.updateMany({
    where: {
      tenantId,
      provider: WHATSAPP_CLOUD_PROVIDER,
      ...(phone ? { accountKey: phone } : {}),
    },
    data: { status: "DISCONNECTED", accessTokenEnc: null, lastError: null },
  });
}
