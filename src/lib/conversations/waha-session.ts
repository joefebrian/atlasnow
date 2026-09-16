import { canonPhone } from "./identity";

export type WahaUiStatus =
  | "none"
  | "starting"
  | "scan"
  | "working"
  | "failed"
  | "stopped"
  | "offline";

export function mapWahaSessionStatus(
  raw: string | null | undefined
): WahaUiStatus {
  switch ((raw || "").toUpperCase()) {
    case "WORKING":
      return "working";
    case "SCAN_QR_CODE":
      return "scan";
    case "STARTING":
      return "starting";
    case "FAILED":
      return "failed";
    case "STOPPED":
      return "stopped";
    case "":
      return "none";
    default:
      return "offline";
  }
}

/** Digits WAHA pairing API wants (62…, not 08…). */
export function pairingPhoneDigits(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const d = canonPhone(phone);
  return d.length >= 8 ? d : null;
}

/**
 * URL WAHA should POST to.
 * Compose sets WAHA_WEBHOOK_BASE=http://atlas:3000 so traffic stays on the Docker network.
 * Host-dev still rewrites localhost → host.docker.internal.
 */
export function webhookUrlForWaha(
  appBase: string,
  webhookBase = process.env.WAHA_WEBHOOK_BASE
): string {
  const raw = (webhookBase || appBase || "http://localhost:3000").replace(/\/$/, "");
  try {
    const u = new URL(raw);
    if (
      !webhookBase &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1")
    ) {
      u.hostname = "host.docker.internal";
    }
    return `${u.origin}/api/webhooks/waha`;
  } catch {
    return `${raw}/api/webhooks/waha`;
  }
}

/** FAILED sessions rarely recover with /start — need a fresh QR. */
export function sessionNeedsRelink(status: string | null | undefined): boolean {
  const s = (status || "").toUpperCase();
  return s === "FAILED";
}

/**
 * WEBJS holds a Chromium process in these states.
 * STOPPED / missing does not. This 8GB VPS OOMs around ~8–10 live sessions.
 */
export function isLiveWahaEngineStatus(status: string | null | undefined): boolean {
  const s = (status || "").toUpperCase();
  return (
    s === "WORKING" ||
    s === "SCAN_QR_CODE" ||
    s === "STARTING" ||
    s === "FAILED"
  );
}

export function wahaMaxLiveSessions(
  raw: string | undefined = process.env.WAHA_MAX_LIVE_SESSIONS
): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 6;
}

/** Starting a new Chromium is allowed only under the cap, unless we replace a live one. */
export function wahaSlotAvailable(
  liveCount: number,
  max: number,
  replacingLive: boolean
): boolean {
  if (replacingLive) return true;
  return liveCount < max;
}

export function wahaSlotFullMessage(live: number, max: number): string {
  return `This server can keep ${max} live WhatsApp numbers at once (${live} in use). Disconnect a quiet branch, then connect this one.`;
}

export function wahaStatusLabel(status: WahaUiStatus): string {
  switch (status) {
    case "working":
      return "Connected";
    case "scan":
      return "Scan QR";
    case "starting":
      return "Starting…";
    case "failed":
      return "Failed";
    case "stopped":
      return "Stopped";
    case "offline":
      return "WAHA offline";
    default:
      return "Not linked";
  }
}
