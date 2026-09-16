export const DELETION_KINDS = [
  "facebook",
  "instagram",
  "whatsapp",
  "tiktok",
  "account",
  "other",
] as const;

export type DeletionKind = (typeof DELETION_KINDS)[number];

export type DeletionRequest = {
  name: string;
  email: string;
  kind: DeletionKind;
  identifier: string;
  details: string;
};

export type ParseDeletionResult =
  | { ok: true; value: DeletionRequest }
  | { ok: false; error: string };

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isKind(v: string): v is DeletionKind {
  return (DELETION_KINDS as readonly string[]).includes(v);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseDeletionRequest(input: unknown): ParseDeletionResult {
  const o = rec(input);
  if (!o) return { ok: false, error: "invalid_json" };

  const email = trimStr(o.email).toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "email_required" };

  const kindRaw = trimStr(o.kind).toLowerCase();
  if (!isKind(kindRaw)) return { ok: false, error: "kind_invalid" };

  return {
    ok: true,
    value: {
      name: trimStr(o.name),
      email,
      kind: kindRaw,
      identifier: trimStr(o.identifier),
      details: trimStr(o.details),
    },
  };
}

export function formatDeletionRequest(req: DeletionRequest): string {
  return [
    `name: ${req.name || "—"}`,
    `email: ${req.email}`,
    `kind: ${req.kind}`,
    `identifier: ${req.identifier || "—"}`,
    `details: ${req.details || "—"}`,
  ].join("\n");
}
