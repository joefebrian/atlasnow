export type ContactRequest = {
  name: string;
  email: string;
  company: string;
  message: string;
  locale: "en" | "id";
  /** Hidden honeypot — bots fill this */
  website: string;
};

export type ParseContactResult =
  | { ok: true; value: ContactRequest; spam: boolean }
  | { ok: false; error: string };

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseContactRequest(input: unknown): ParseContactResult {
  const o = rec(input);
  if (!o) return { ok: false, error: "invalid_json" };

  const website = typeof o.website === "string" ? o.website.trim() : "";
  const email = trimStr(o.email).toLowerCase();
  const name = trimStr(o.name).slice(0, 80);
  const company = trimStr(o.company).slice(0, 120);
  const message = trimStr(o.message).slice(0, 4000);
  const localeRaw = trimStr(o.locale).toLowerCase();
  const locale: "en" | "id" = localeRaw === "id" ? "id" : "en";

  if (website) {
    return {
      ok: true,
      spam: true,
      value: { name, email, company, message, locale, website },
    };
  }

  if (!name) return { ok: false, error: "name_required" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "email_required" };
  if (message.length < 8) return { ok: false, error: "message_required" };

  return {
    ok: true,
    spam: false,
    value: { name, email, company, message, locale, website: "" },
  };
}

export type ContactMailMeta = {
  sentAt: string;
  ip: string | null;
  country: string | null;
  userAgent: string | null;
  acceptLanguage: string | null;
  referrer: string | null;
  page: string | null;
};

export function parseOptionalPage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().slice(0, 200);
  if (!s.startsWith("/") || s.includes("://") || /\s/.test(s)) return null;
  return s;
}

export function parseOptionalReferrer(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().slice(0, 300);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function formatJakartaTime(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} WIB`;
}

export function formatContactEmail(req: ContactRequest, meta?: ContactMailMeta): string {
  const lines = [
    `Name: ${req.name}`,
    `Email: ${req.email}`,
    `Company: ${req.company || "—"}`,
    `Locale: ${req.locale}`,
    "",
    req.message,
  ];
  if (meta) {
    lines.push(
      "",
      "—",
      `Sent: ${meta.sentAt}`,
      `Page: ${meta.page || "—"}`,
      `Referrer: ${meta.referrer || "—"}`,
      `IP: ${meta.ip || "—"}`,
      `Country: ${meta.country || "—"}`,
      `Browser: ${meta.userAgent || "—"}`,
      `Accept-Language: ${meta.acceptLanguage || "—"}`
    );
  }
  return lines.join("\n");
}
