import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/google/crypto";
import {
  getIntegrationDef,
  INTEGRATION_CATALOG,
  type IntegrationDefinition,
} from "@/lib/integrations/catalog";

export type IntegrationPublicView = {
  provider: string;
  name: string;
  category: IntegrationDefinition["category"];
  description: string;
  phase: string;
  opsHref?: string;
  opsLabel?: string;
  modes: IntegrationDefinition["modes"];
  mode: string;
  enabled: boolean;
  displayName: string | null;
  notes: string | null;
  lastError: string | null;
  lastCheckedAt: string | null;
  updatedAt: string | null;
  /** Effective readiness for UI badges */
  status: "ready" | "partial" | "mock" | "off" | "planned" | "missing";
  statusLabel: string;
  fields: Array<{
    key: string;
    label: string;
    kind: string;
    secret?: boolean;
    placeholder?: string;
    help?: string;
    /** Current non-secret value (DB, else env) */
    value: string;
    /** Secret is set (DB or env) without revealing value */
    hasSecret: boolean;
    /** Source of effective value */
    source: "db" | "env" | "none";
    envFallback?: string;
  }>;
};

function parseJson(raw: string | null | undefined): Record<string, string> {
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

function envValue(name?: string): string {
  if (!name) return "";
  return (process.env[name] || "").trim();
}

function decryptSecrets(blob: string | null | undefined): Record<string, string> {
  if (!blob) return {};
  try {
    return parseJson(decryptSecret(blob));
  } catch {
    return {};
  }
}

export async function getIntegrationRow(provider: string) {
  return prisma.integrationConfig.findUnique({ where: { provider } });
}

/** Resolved public + secret maps (DB overrides env). */
export async function resolveIntegrationValues(provider: string): Promise<{
  mode: string;
  enabled: boolean;
  public: Record<string, string>;
  secrets: Record<string, string>;
}> {
  const def = getIntegrationDef(provider);
  const row = await getIntegrationRow(provider);
  const pub = parseJson(row?.publicJson);
  const secrets = decryptSecrets(row?.secretsEnc);

  const mergedPublic: Record<string, string> = { ...pub };
  const mergedSecrets: Record<string, string> = { ...secrets };

  if (def) {
    for (const f of def.fields) {
      const env = envValue(f.envFallback);
      if (f.secret) {
        if (!mergedSecrets[f.key] && env) mergedSecrets[f.key] = env;
      } else if (!mergedPublic[f.key] && env) {
        mergedPublic[f.key] = env;
      }
    }
  }

  // Extra env aliases for maps
  if (provider === "google_maps" && !mergedSecrets.apiKey) {
    const alt = envValue("GOOGLE_GEOCODING_API_KEY");
    if (alt) mergedSecrets.apiKey = alt;
  }

  return {
    mode: row?.mode || "AUTO",
    enabled: row?.enabled ?? true,
    public: mergedPublic,
    secrets: mergedSecrets,
  };
}

function computeStatus(
  def: IntegrationDefinition,
  mode: string,
  enabled: boolean,
  fields: IntegrationPublicView["fields"]
): { status: IntegrationPublicView["status"]; statusLabel: string } {
  if (!enabled || mode === "OFF") {
    return { status: "off", statusLabel: "Off" };
  }
  if (mode === "MOCK") {
    return { status: "mock", statusLabel: "Mock" };
  }
  if (def.phase.includes("planned")) {
    const anySet = fields.some((f) => (f.secret ? f.hasSecret : Boolean(f.value)));
    if (!anySet) return { status: "planned", statusLabel: "Planned" };
  }

  // Readiness by provider
  if (def.provider === "google_business_profile") {
    const id = fields.find((f) => f.key === "clientId");
    const secret = fields.find((f) => f.key === "clientSecret");
    if (id?.value && secret?.hasSecret) return { status: "ready", statusLabel: "Ready" };
    return { status: "missing", statusLabel: "Missing credentials" };
  }
  if (def.provider === "google_maps") {
    const k = fields.find((f) => f.key === "apiKey");
    if (k?.hasSecret) return { status: "ready", statusLabel: "Ready" };
    return { status: "partial", statusLabel: "Optional · using Nominatim" };
  }
  if (def.provider === "nominatim") {
    return { status: "ready", statusLabel: "Ready (default)" };
  }
  if (def.provider === "app_base") {
    const b = fields.find((f) => f.key === "baseUrl");
    if (b?.value) return { status: "ready", statusLabel: "Ready" };
    return { status: "partial", statusLabel: "Default localhost" };
  }
  if (def.provider === "smtp") {
    const host = fields.find((f) => f.key === "host");
    const user = fields.find((f) => f.key === "user");
    const pass = fields.find((f) => f.key === "password");
    if (host?.value && user?.value && pass?.hasSecret) {
      return { status: "ready", statusLabel: "Ready" };
    }
    return { status: "missing", statusLabel: "Needed for Contact us" };
  }
  if (def.provider === "meta") {
    const id = fields.find((f) => f.key === "appId");
    const secret = fields.find((f) => f.key === "appSecret");
    if (id?.value && secret?.hasSecret) return { status: "ready", statusLabel: "Ready" };
    return { status: "missing", statusLabel: "Missing App ID / Secret" };
  }
  if (def.provider === "waha") {
    const base = fields.find((f) => f.key === "baseUrl");
    if (base?.value) return { status: "partial", statusLabel: "URL set" };
    return { status: "off", statusLabel: "Not configured" };
  }
  if (def.provider === "tiktok") {
    const key = fields.find((f) => f.key === "clientKey");
    const secret = fields.find((f) => f.key === "clientSecret");
    if (key?.value && secret?.hasSecret) return { status: "ready", statusLabel: "Ready" };
    return { status: "missing", statusLabel: "Missing client key / secret" };
  }
  if (def.provider === "tiktok_go") {
    const id = fields.find((f) => f.key === "merchantId");
    const token = fields.find((f) => f.key === "accessToken");
    if (id?.value && token?.hasSecret) return { status: "ready", statusLabel: "Ready" };
    if (id?.value || token?.hasSecret) return { status: "partial", statusLabel: "Merchant id or token missing" };
    return { status: "missing", statusLabel: "Not connected" };
  }

  const any = fields.some((f) => (f.secret ? f.hasSecret : Boolean(f.value)));
  if (any) return { status: "partial", statusLabel: "Partial" };
  if (def.phase.includes("planned")) return { status: "planned", statusLabel: "Planned" };
  return { status: "missing", statusLabel: "Not configured" };
}

export async function listIntegrationViews(): Promise<IntegrationPublicView[]> {
  // Guard stale Prisma client after schema add (dev HMR)
  const delegate = (
    prisma as unknown as {
      integrationConfig?: { findMany: () => Promise<Array<Record<string, unknown>>> };
    }
  ).integrationConfig;
  if (!delegate?.findMany) {
    throw new Error(
      "Prisma client missing IntegrationConfig. Run: npx prisma generate && restart npm run dev"
    );
  }

  const rows = await prisma.integrationConfig.findMany();
  const byProvider = Object.fromEntries(rows.map((r) => [r.provider, r]));

  return INTEGRATION_CATALOG.map((def) => {
    const row = byProvider[def.provider];
    const pub = parseJson(row?.publicJson);
    const secrets = decryptSecrets(row?.secretsEnc);
    const mode = row?.mode || "AUTO";
    const enabled = row?.enabled ?? true;

    const fields: IntegrationPublicView["fields"] = def.fields.map((f) => {
      const env = envValue(f.envFallback);
      if (f.secret) {
        const dbHas = Boolean(secrets[f.key]?.trim());
        const envHas = Boolean(env);
        return {
          key: f.key,
          label: f.label,
          kind: f.kind,
          secret: true,
          placeholder: f.placeholder,
          help: f.help,
          value: "",
          hasSecret: dbHas || envHas,
          source: dbHas ? "db" : envHas ? "env" : "none",
          envFallback: f.envFallback,
        };
      }
      const dbVal = (pub[f.key] || "").trim();
      const value = dbVal || env;
      return {
        key: f.key,
        label: f.label,
        kind: f.kind,
        secret: false,
        placeholder: f.placeholder,
        help: f.help,
        value,
        hasSecret: false,
        source: dbVal ? "db" : env ? "env" : "none",
        envFallback: f.envFallback,
      };
    });

    const { status, statusLabel } = computeStatus(def, mode, enabled, fields);

    return {
      provider: def.provider,
      name: def.name,
      category: def.category,
      description: def.description,
      phase: def.phase,
      opsHref: def.opsHref,
      opsLabel: def.opsLabel,
      modes: def.modes,
      mode,
      enabled,
      displayName: row?.displayName ?? null,
      notes: row?.notes ?? null,
      lastError: row?.lastError ?? null,
      lastCheckedAt: row?.lastCheckedAt?.toISOString() ?? null,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      status,
      statusLabel,
      fields,
    };
  });
}

export type UpsertIntegrationInput = {
  mode?: string;
  enabled?: boolean;
  notes?: string | null;
  displayName?: string | null;
  /** Non-secret field values */
  publicFields?: Record<string, string>;
  /**
   * Secret field values. Empty string = leave unchanged.
   * Literal "__CLEAR__" = remove stored secret (env may still apply).
   */
  secretFields?: Record<string, string>;
};

export async function upsertIntegration(
  provider: string,
  input: UpsertIntegrationInput
) {
  const def = getIntegrationDef(provider);
  if (!def) throw new Error(`Unknown provider: ${provider}`);

  const existing = await getIntegrationRow(provider);
  const pub = parseJson(existing?.publicJson);
  const secrets = decryptSecrets(existing?.secretsEnc);

  if (input.publicFields) {
    for (const f of def.fields.filter((x) => !x.secret)) {
      if (f.key in input.publicFields!) {
        const v = (input.publicFields![f.key] || "").trim();
        if (v) pub[f.key] = v;
        else delete pub[f.key];
      }
    }
  }

  if (input.secretFields) {
    for (const f of def.fields.filter((x) => x.secret)) {
      if (!(f.key in input.secretFields!)) continue;
      const v = input.secretFields![f.key];
      if (v === "__CLEAR__") {
        delete secrets[f.key];
      } else if (v && v.trim()) {
        secrets[f.key] = v.trim();
      }
      // empty string → keep existing
    }
  }

  const mode = input.mode && def.modes.includes(input.mode as never) ? input.mode : existing?.mode || "AUTO";

  const secretsEnc =
    Object.keys(secrets).length > 0 ? encryptSecret(JSON.stringify(secrets)) : null;

  return prisma.integrationConfig.upsert({
    where: { provider },
    create: {
      provider,
      mode,
      enabled: input.enabled ?? true,
      displayName: input.displayName ?? def.name,
      publicJson: JSON.stringify(pub),
      secretsEnc,
      notes: input.notes ?? null,
    },
    update: {
      mode,
      enabled: input.enabled ?? existing?.enabled ?? true,
      displayName: input.displayName === undefined ? existing?.displayName : input.displayName,
      publicJson: JSON.stringify(pub),
      secretsEnc,
      notes: input.notes === undefined ? existing?.notes : input.notes,
      lastError: null,
      lastCheckedAt: new Date(),
    },
  });
}

/** Convenience resolvers used by Google / Maps code paths */
export async function resolvedGoogleOAuth(): Promise<{
  clientId: string;
  clientSecret: string;
  redirectUri: string | null;
  mode: string;
  configured: boolean;
}> {
  const v = await resolveIntegrationValues("google_business_profile");
  const clientId = (v.public.clientId || envValue("GOOGLE_CLIENT_ID")).trim();
  const clientSecret = (v.secrets.clientSecret || envValue("GOOGLE_CLIENT_SECRET")).trim();
  const redirectUri = (v.public.redirectUri || envValue("GOOGLE_REDIRECT_URI")).trim() || null;
  return {
    clientId,
    clientSecret,
    redirectUri,
    mode: v.mode,
    configured: Boolean(clientId && clientSecret) && v.mode !== "OFF" && v.enabled,
  };
}

export async function resolvedMapsApiKey(): Promise<string | null> {
  const v = await resolveIntegrationValues("google_maps");
  if (!v.enabled || v.mode === "OFF") return null;
  const key = (v.secrets.apiKey || "").trim();
  return key || null;
}

export async function resolvedMetaApp(): Promise<{
  appId: string;
  appSecret: string;
  verifyToken: string;
  redirectUri: string | null;
  loginConfigId: string | null;
  whatsappEsConfigId: string | null;
  mode: string;
  configured: boolean;
}> {
  const v = await resolveIntegrationValues("meta");
  const appId = (v.public.appId || envValue("META_APP_ID")).trim();
  const appSecret = (v.secrets.appSecret || envValue("META_APP_SECRET")).trim();
  const verifyToken =
    (v.secrets.verifyToken || envValue("META_VERIFY_TOKEN") || "atlasnow-meta").trim();
  const redirectUri = (v.public.redirectUri || envValue("META_REDIRECT_URI")).trim() || null;
  const loginConfigId =
    (v.public.loginConfigId || envValue("META_LOGIN_CONFIG_ID")).trim() || null;
  const whatsappEsConfigId =
    (v.public.whatsappEsConfigId || envValue("META_WHATSAPP_ES_CONFIG_ID") || "1401943948578182").trim() ||
    null;
  return {
    appId,
    appSecret,
    verifyToken,
    redirectUri,
    loginConfigId,
    whatsappEsConfigId,
    mode: v.mode,
    configured: Boolean(appId && appSecret) && v.mode !== "OFF" && v.enabled,
  };
}

export async function resolvedAppBaseUrl(): Promise<string> {
  const v = await resolveIntegrationValues("app_base");
  const fromDb = (v.public.baseUrl || "").trim().replace(/\/$/, "");
  if (fromDb) return fromDb;
  return (
    process.env.APP_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}
