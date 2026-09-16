/**
 * Conservative Maps HTTP session.
 *
 * Adopted from public Maps fetchers (cookie warmup + same-origin headers +
 * stop-on-403). No proxies, no captcha solving, no TLS impersonation.
 */

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const RPC_COOLDOWN_MS = 30 * 60 * 1000;

let rpcBlockedUntil = 0;

export function isMapsRpcBlocked(): boolean {
  return Date.now() < rpcBlockedUntil;
}

export function markMapsRpcBlocked(): void {
  rpcBlockedUntil = Date.now() + RPC_COOLDOWN_MS;
}

export function resetMapsRpcCircuit(): void {
  rpcBlockedUntil = 0;
}

export function mapsRpcBlockedRemainingMs(): number {
  return Math.max(0, rpcBlockedUntil - Date.now());
}

export function parseSetCookiePair(raw: string): { name: string; value: string } | null {
  const first = raw.split(";")[0] || "";
  const eq = first.indexOf("=");
  if (eq < 1) return null;
  const name = first.slice(0, eq).trim();
  const value = first.slice(eq + 1).trim();
  if (!name) return null;
  return { name, value };
}

export function extractMapsIdsFromHtml(html: string): {
  featureId: string | null;
  placeId: string | null;
} {
  const feature =
    html.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/)?.[1] ||
    html.match(/\b(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)\b/)?.[1] ||
    null;
  const place = html.match(/\b(ChIJ[A-Za-z0-9_-]{10,})\b/)?.[1] || null;
  return { featureId: feature, placeId: place };
}

export class MapsHttpSession {
  private cookies = new Map<string, string>();
  readonly userAgent = CHROME_UA;
  warmed = false;

  cookieHeader(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  absorbSetCookie(headers: Headers): void {
    const raw =
      typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : headers.get("set-cookie")
          ? [headers.get("set-cookie") as string]
          : [];
    for (const line of raw) {
      const pair = parseSetCookiePair(line);
      if (pair) this.cookies.set(pair.name, pair.value);
    }
  }

  private headers(opts: {
    referer?: string;
    accept?: string;
    navigation?: boolean;
    rpc?: boolean;
  }): Record<string, string> {
    const h: Record<string, string> = {
      "User-Agent": this.userAgent,
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      Referer: opts.referer || "https://www.google.com/maps/",
    };
    if (opts.navigation) {
      h.Accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
      h["Upgrade-Insecure-Requests"] = "1";
      h["Sec-Fetch-Dest"] = "document";
      h["Sec-Fetch-Mode"] = "navigate";
      h["Sec-Fetch-Site"] = "none";
      h["Sec-Fetch-User"] = "?1";
    } else {
      h.Accept = opts.accept || "*/*";
      h["Sec-Fetch-Dest"] = "empty";
      h["Sec-Fetch-Mode"] = "cors";
      h["Sec-Fetch-Site"] = "same-origin";
      h.Origin = "https://www.google.com";
      h["Cache-Control"] = "no-cache";
    }
    if (opts.rpc) {
      h["x-maps-diversion-context-bin"] = "CAE=";
    }
    const cookie = this.cookieHeader();
    if (cookie) h.Cookie = cookie;
    return h;
  }

  async get(url: string, opts?: { referer?: string; rpc?: boolean; navigation?: boolean }): Promise<{
    status: number;
    url: string;
    body: string;
  }> {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: this.headers({
        referer: opts?.referer,
        rpc: opts?.rpc,
        navigation: opts?.navigation,
      }),
    });
    this.absorbSetCookie(res.headers);
    const body = await res.text();
    return { status: res.status, url: res.url, body };
  }

  async warmup(placeUrl?: string): Promise<{ html: string; finalUrl: string; status: number }> {
    await this.get("https://www.google.com/maps?hl=id&gl=id", { navigation: true });
    if (placeUrl) {
      const page = await this.get(placeUrl, {
        navigation: true,
        referer: "https://www.google.com/maps",
      });
      this.warmed = true;
      return { html: page.body, finalUrl: page.url || placeUrl, status: page.status };
    }
    this.warmed = true;
    return { html: "", finalUrl: placeUrl || "https://www.google.com/maps", status: 200 };
  }
}

export function looksBlocked(status: number, body: string, finalUrl?: string): string | null {
  const t = body.slice(0, 500).toLowerCase();
  const url = (finalUrl || "").toLowerCase();
  if (status === 403 || status === 429) {
    return status === 429
      ? "Google rate-limited the public Maps feed. We paused RPC for 30 minutes."
      : "Google blocked the public Maps feed from this server. We paused RPC for 30 minutes.";
  }
  if (status === 401) {
    return "Google rejected the Maps session (401).";
  }
  if (url.includes("consent.google") || t.includes("before you continue") || t.includes("consent.google")) {
    return "Google showed a consent page instead of reviews.";
  }
  if (t.includes("captcha") || t.includes("unusual traffic")) {
    return "Google showed a bot check instead of reviews.";
  }
  if (status >= 400) {
    return `Google Maps feed returned HTTP ${status}.`;
  }
  return null;
}
