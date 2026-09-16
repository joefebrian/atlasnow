import { createHash } from "crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { resolveIntegrationValues } from "@/lib/integrations/service";
import { LEGAL_CONTACT_EMAIL, LEGAL_PRODUCT } from "@/lib/legal/copy";
import {
  formatContactEmail,
  formatJakartaTime,
  parseOptionalPage,
  parseOptionalReferrer,
  type ContactMailMeta,
  type ContactRequest,
} from "./parse";
import { formatFromHeader, isValidEmail, resolveContactTo } from "./smtp";

const RATE_PER_HOUR = 8;

export function hashClientIp(ip: string | null): string | null {
  if (!ip) return null;
  const secret = process.env.AUTH_SECRET || "atlasnow-dev-secret-change-me";
  return createHash("sha256").update(`${secret}:${ip}`).digest("hex").slice(0, 24);
}

export async function tooManyContactFrom(ipHash: string | null): Promise<boolean> {
  if (!ipHash) return false;
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const n = await prisma.contactMessage.count({
    where: { ipHash, createdAt: { gte: since } },
  });
  return n >= RATE_PER_HOUR;
}

async function smtpConfig() {
  const cfg = await resolveIntegrationValues("smtp");
  const host = (cfg.public.host || process.env.SMTP_HOST || "").trim();
  const portRaw = (cfg.public.port || process.env.SMTP_PORT || "587").trim();
  const port = Number(portRaw) || 587;
  const user = (cfg.public.user || process.env.SMTP_USER || "").trim();
  const pass = (cfg.secrets.password || process.env.SMTP_PASS || "").trim();
  const from =
    (cfg.public.from || process.env.SMTP_FROM || "").trim() ||
    `${LEGAL_PRODUCT} <${LEGAL_CONTACT_EMAIL}>`;
  const to = resolveContactTo(cfg.public.to || process.env.SMTP_TO || "");
  const secureFlag = (cfg.public.secure || process.env.SMTP_SECURE || "").trim().toLowerCase();
  const secure = port === 465 || secureFlag === "true" || secureFlag === "1";
  return { host, port, user, pass, from, to, secure };
}

export type SendMailResult = {
  sent: boolean;
  error: string | null;
  messageId?: string | null;
  to?: string;
};

async function dispatchMail(input: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<SendMailResult> {
  const smtp = await smtpConfig();
  if (!smtp.host || !smtp.user || !smtp.pass) {
    return { sent: false, error: "smtp_not_configured", to: input.to };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      requireTLS: !smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    const info = await transporter.sendMail({
      from: formatFromHeader(smtp.from),
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
    });
    return {
      sent: true,
      error: null,
      messageId: typeof info.messageId === "string" ? info.messageId : null,
      to: input.to,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "smtp_send_failed";
    return { sent: false, error: message.slice(0, 400), to: input.to };
  }
}

export function clientIp(request: Request): string | null {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

export function collectContactMeta(request: Request, body: unknown): ContactMailMeta {
  const rec = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const headerReferrer = parseOptionalReferrer(request.headers.get("referer"));
  const countryRaw = (request.headers.get("cf-ipcountry") || "").trim().toUpperCase();
  const country = countryRaw && countryRaw !== "XX" ? countryRaw : null;
  return {
    sentAt: formatJakartaTime(),
    ip: clientIp(request),
    country,
    userAgent: (request.headers.get("user-agent") || "").trim().slice(0, 300) || null,
    acceptLanguage: (request.headers.get("accept-language") || "").trim().slice(0, 120) || null,
    referrer: parseOptionalReferrer(rec.referrer) || headerReferrer,
    page: parseOptionalPage(rec.page),
  };
}

export async function sendContactMail(
  req: ContactRequest,
  meta?: ContactMailMeta
): Promise<SendMailResult> {
  const smtp = await smtpConfig();
  return dispatchMail({
    to: smtp.to,
    replyTo: `${req.name} <${req.email}>`,
    subject: req.company
      ? `${LEGAL_PRODUCT} contact · ${req.name} · ${req.company}`
      : `${LEGAL_PRODUCT} contact · ${req.name}`,
    text: formatContactEmail(req, meta),
  });
}

/** Agency-staff SMTP probe. Send to a mailbox that is NOT the SMTP username so Gmail puts it in Inbox. */
export async function sendSmtpTestMail(to: string): Promise<SendMailResult> {
  const dest = to.trim().toLowerCase();
  if (!isValidEmail(dest)) {
    return { sent: false, error: "email_required" };
  }
  const smtp = await smtpConfig();
  return dispatchMail({
    to: dest,
    subject: `${LEGAL_PRODUCT} SMTP tes`,
    text: [
      "Tes email dari AtlasNow.",
      "",
      "Kalau ini sampai di Inbox, SMTP-nya jalan.",
      "",
      `Kirim ke: ${dest}`,
      `SMTP user: ${smtp.user || "—"}`,
      `Waktu: ${new Date().toISOString()}`,
      "",
      "Kalau kirim ke alamat yang sama dengan Username Gmail (hello@ → hello@), Gmail biasanya taruh di Sent — bukan Inbox.",
    ].join("\n"),
  });
}

export async function recordContactMessage(input: {
  req: ContactRequest;
  ipHash: string | null;
  mailSent: boolean;
  mailError: string | null;
}) {
  return prisma.contactMessage.create({
    data: {
      name: input.req.name,
      email: input.req.email,
      company: input.req.company || null,
      message: input.req.message,
      locale: input.req.locale,
      ipHash: input.ipHash,
      mailSent: input.mailSent,
      mailError: input.mailError,
    },
  });
}

export async function listRecentContactMessages(take = 30) {
  return prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      message: true,
      locale: true,
      mailSent: true,
      mailError: true,
      createdAt: true,
    },
  });
}
