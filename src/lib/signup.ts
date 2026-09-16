import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword, passwordMeetsPolicy } from "@/lib/auth";
import { parseSignupPhone } from "@/lib/signup/phone";
import { slugify } from "@/lib/slug";
import { LEGAL_EFFECTIVE, LEGAL_PRODUCT } from "@/lib/legal/copy";

const SIGNUP_PER_HOUR = 40;

export const TERMS_VERSION = LEGAL_EFFECTIVE;
export const PRIVACY_VERSION = LEGAL_EFFECTIVE;

export type SignupMethod = "email" | "google" | "facebook";
export type SignupKind = "brand" | "agency";

export type SignupInput = {
  email: string;
  password?: string;
  name?: string;
  phone: string;
  acceptTerms: boolean;
  method: SignupMethod;
  /** Always a brand tenant. Group / several brands is P2P Activate, not self-serve. */
  kind: SignupKind;
  wantsGroup: boolean;
};

export type ParseSignupResult =
  | { ok: true; value: SignupInput }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function parseSignupRequest(input: unknown): ParseSignupResult {
  const o = rec(input);
  if (!o) return { ok: false, error: "invalid_json" };
  if (o.acceptTerms !== true) return { ok: false, error: "terms_required" };

  const email = trimStr(o.email).toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "email_required" };

  const methodRaw = trimStr(o.method).toLowerCase();
  const method: SignupMethod =
    methodRaw === "google" || methodRaw === "facebook" ? methodRaw : "email";

  const name = trimStr(o.name).slice(0, 80);
  const password = typeof o.password === "string" ? o.password : "";
  const wantsGroup = o.wantsGroup === true || o.wantsGroup === "true" || o.wantsGroup === "on";
  const phone = parseSignupPhone(o.phone);
  if (!phone) return { ok: false, error: "phone_required" };

  if (method === "email") {
    if (!passwordMeetsPolicy(password)) return { ok: false, error: "password_policy" };
  }

  return {
    ok: true,
    value: {
      email,
      password: password || undefined,
      name,
      phone,
      acceptTerms: true,
      method,
      kind: "brand",
      wantsGroup,
    },
  };
}

function randomSecret(length = 24): string {
  return randomBytes(Math.ceil((length * 3) / 4))
    .toString("base64url")
    .slice(0, length);
}

export async function isSignupRateLimited(): Promise<boolean> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.user.count({ where: { createdAt: { gte: hourAgo } } });
  return recent > SIGNUP_PER_HOUR;
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "workspace";
  for (let i = 0; i < 25; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const exists = await prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function registerWorkspace(input: SignupInput): Promise<{
  userId: string;
  tenantId: string;
  email: string;
  name: string | null;
}> {
  if (await isSignupRateLimited()) {
    throw Object.assign(new Error("too_many"), { code: "too_many" });
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw Object.assign(new Error("email_taken"), { code: "email_taken" });
  }

  const display =
    input.name ||
    input.email.split("@")[0]?.replace(/[._-]+/g, " ") ||
    LEGAL_PRODUCT;
  const title = display.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80);
  const password = input.password || randomSecret(24);
  const passwordHash = await hashPassword(password);
  const slug = await uniqueSlug(title);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        name: title,
        passwordHash,
        isActive: true,
        signupMethod: input.method,
        termsAcceptedAt: now,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
      },
    });
    const tenant = await tx.tenant.create({
      data: {
        name: title,
        slug,
        type: "CLIENT",
        status: "ACTIVE",
        loginEnabled: false,
        plan: "free",
        timezone: "Asia/Jakarta",
        contactName: title,
        contactEmail: input.email,
        contactPhone: input.phone,
        notes: [
          `Self-serve signup (${input.method}). Waiting for platform follow-up.`,
          input.wantsGroup
            ? "Asked for several brands — still one brand tenant. Group workspace only after Activate."
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });
    await tx.membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: "CLIENT_ADMIN",
        status: "ACTIVE",
      },
    });
    return { user, tenant };
  });

  return {
    userId: result.user.id,
    tenantId: result.tenant.id,
    email: result.user.email,
    name: result.user.name,
  };
}

export async function loginOrRegisterOAuth(input: {
  email: string;
  name?: string;
  phone?: string | null;
  method: "google" | "facebook";
  acceptTerms: boolean;
  kind?: SignupKind;
  wantsGroup?: boolean;
}): Promise<{
  userId: string;
  tenantId: string;
  email: string;
  name: string | null;
  created: boolean;
}> {
  if (!input.acceptTerms) {
    throw Object.assign(new Error("terms_required"), { code: "terms_required" });
  }
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { where: { status: "ACTIVE" }, include: { tenant: true } } },
  });
  if (existing) {
    if (!existing.isActive) {
      throw Object.assign(new Error("account_disabled"), { code: "account_disabled" });
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        termsAcceptedAt: existing.termsAcceptedAt ?? new Date(),
        termsVersion: existing.termsVersion ?? TERMS_VERSION,
        privacyVersion: existing.privacyVersion ?? PRIVACY_VERSION,
      },
    });
    const membership =
      existing.memberships.find((m) => m.tenant.status !== "ARCHIVED") || existing.memberships[0];
    if (!membership) {
      throw Object.assign(new Error("no_workspace"), { code: "no_workspace" });
    }
    return {
      userId: existing.id,
      tenantId: membership.tenantId,
      email: existing.email,
      name: existing.name,
      created: false,
    };
  }

  const phone = parseSignupPhone(input.phone);
  if (!phone) {
    throw Object.assign(new Error("phone_required"), { code: "phone_required" });
  }

  const created = await registerWorkspace({
    email,
    name: input.name,
    phone,
    acceptTerms: true,
    method: input.method,
    kind: "brand",
    wantsGroup: input.wantsGroup === true,
  });
  return { ...created, created: true };
}
