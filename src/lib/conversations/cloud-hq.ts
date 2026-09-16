import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/google/crypto";
import { generateAtlasLocationId } from "@/lib/locations/ids";

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

export async function saveCloudHqConnector(opts: {
  tenantId: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  displayPhone?: string | null;
  verifiedName?: string | null;
}) {
  const meta = {
    phoneNumberId: opts.phoneNumberId.trim(),
    wabaId: opts.wabaId.trim(),
    displayPhone: (opts.displayPhone || "").trim(),
    verifiedName: (opts.verifiedName || "").trim(),
  };
  const tokenEnc = encryptSecret(opts.accessToken.trim());
  const row = await prisma.connector.upsert({
    where: {
      tenantId_provider: { tenantId: opts.tenantId, provider: WHATSAPP_CLOUD_PROVIDER },
    },
    create: {
      tenantId: opts.tenantId,
      provider: WHATSAPP_CLOUD_PROVIDER,
      status: "CONNECTED",
      displayName: meta.verifiedName || meta.displayPhone || "WhatsApp HQ",
      accessTokenEnc: tokenEnc,
      mode: "LIVE",
      lastError: null,
      metaJson: JSON.stringify(meta),
    },
    update: {
      status: "CONNECTED",
      displayName: meta.verifiedName || meta.displayPhone || "WhatsApp HQ",
      accessTokenEnc: tokenEnc,
      lastError: null,
      metaJson: JSON.stringify(meta),
    },
  });
  await ensureHqLocation(opts.tenantId, {
    phone: meta.displayPhone || null,
    name: meta.verifiedName ? `${meta.verifiedName} HQ` : undefined,
  });
  try {
    const { ensureWabaPhone } = await import("@/lib/waba/service-quota");
    await ensureWabaPhone({
      tenantId: opts.tenantId,
      phoneNumberId: meta.phoneNumberId,
      wabaId: meta.wabaId,
      displayPhone: meta.displayPhone,
    });
  } catch {
    /* connector is saved; quota row can catch up on the next send */
  }
  return row;
}

export async function disconnectCloudHq(tenantId: string) {
  await prisma.connector.updateMany({
    where: { tenantId, provider: WHATSAPP_CLOUD_PROVIDER },
    data: { status: "DISCONNECTED", accessTokenEnc: null, lastError: null },
  });
}
