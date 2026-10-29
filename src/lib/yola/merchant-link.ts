export const PAYMENT_MODES = [
  "DEMO_CHECKOUT",
  "MERCHANT_EXTERNAL_LINK",
  "MERCHANT_GATEWAY_WEBHOOK",
  "ATLASNOW_GATEWAY",
] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number];

const SAVABLE_MODES = new Set<PaymentMode>(["DEMO_CHECKOUT", "MERCHANT_EXTERNAL_LINK"]);

export type MerchantUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: "empty" | "invalid" | "not_https" | "credentials" | "port" | "destination" | "too_long" };

export type PaymentPlan =
  | { kind: "demo" }
  | { kind: "merchant"; url: string };

const MAX_URL_LENGTH = 500;

function ipv4Parts(host: string) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return null;
  return parts;
}

function blockedIpv4(a: number, b: number) {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function blockedMappedIpv4(ipv6: string) {
  const parts = ipv6.toLowerCase().split(":").filter((part) => part.length > 0);
  const marker = parts.lastIndexOf("ffff");
  if (marker < 0 || parts.length - marker < 3) return false;
  const hi = Number.parseInt(parts[parts.length - 2], 16);
  const lo = Number.parseInt(parts[parts.length - 1], 16);
  if (!Number.isInteger(hi) || !Number.isInteger(lo) || hi > 0xffff || lo > 0xffff) return false;
  return blockedIpv4(hi >> 8, hi & 0xff);
}

function blockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    host === "atlasnow.co" ||
    host.endsWith(".atlasnow.co")
  ) {
    return true;
  }
  const ipv4 = ipv4Parts(host);
  if (ipv4) return blockedIpv4(ipv4[0], ipv4[1]);
  const ipv6 = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (ipv6.includes(":")) {
    const value = ipv6.toLowerCase();
    if (value === "::" || value === "::1" || value === "https://example.net/id/garnet") return true;
    if (value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
    if (blockedMappedIpv4(value)) return true;
  }
  return false;
}

/** Accepts one HTTPS URL. Does not add query parameters or customer data. */
export function validateMerchantPaymentUrl(raw: string): MerchantUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > MAX_URL_LENGTH) return { ok: false, reason: "too_long" };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (parsed.protocol !== "https:") return { ok: false, reason: "not_https" };
  if (parsed.username || parsed.password) return { ok: false, reason: "credentials" };
  if (parsed.port && parsed.port !== "443") return { ok: false, reason: "port" };
  if (blockedHost(parsed.hostname)) return { ok: false, reason: "destination" };
  return { ok: true, url: parsed.href };
}

export function savablePaymentMode(mode: string): mode is "DEMO_CHECKOUT" | "MERCHANT_EXTERNAL_LINK" {
  return SAVABLE_MODES.has(mode as PaymentMode);
}

export function resolvePaymentPlan(config: { mode: string; merchantUrl: string } | null): PaymentPlan {
  if (!config || config.mode === "DEMO_CHECKOUT") return { kind: "demo" };
  if (config.mode !== "MERCHANT_EXTERNAL_LINK") return { kind: "demo" };
  const checked = validateMerchantPaymentUrl(config.merchantUrl);
  if (!checked.ok) return { kind: "demo" };
  return { kind: "merchant", url: checked.url };
}

export function merchantHandoffMessage(input: { orderId: string; url: string }) {
  return [
    "Pesanan YOLA FUN kamu sudah kami terima!",
    "",
    `Order ID: ${input.orderId}`,
    "",
    "Produk: Presale Card 2x Entry",
    "",
    "Total: Rp499.000",
    "",
    "Status: Menunggu Pembayaran",
    "",
    "Buka link berikut untuk melanjutkan pembayaran:",
    "",
    input.url,
    "",
    "Membuka halaman ini belum membuktikan pembayaran. Link merchant statis tidak mencatat pembayaran otomatis ke order. Tiket belum diterbitkan.",
  ].join("\n");
}
