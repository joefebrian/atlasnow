export const INBOX_MEDIA_LIMITS = {
  image: 8 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  document: 16 * 1024 * 1024,
} as const;

export type InboxMediaKind = keyof typeof INBOX_MEDIA_LIMITS;

const IMAGE = /^image\/(jpeg|jpg|png|webp)$/i;
const AUDIO = /^audio\/(ogg|mpeg|mp4|aac|amr|opus)$/i;
const VIDEO = /^video\/(mp4|3gpp)$/i;
const DOCUMENTS = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

const EXT_KIND: Record<string, InboxMediaKind> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  ogg: "audio",
  mp3: "audio",
  m4a: "audio",
  aac: "audio",
  amr: "audio",
  mp4: "video",
  "3gp": "video",
  pdf: "document",
  doc: "document",
  docx: "document",
  xls: "document",
  xlsx: "document",
  ppt: "document",
  pptx: "document",
  txt: "document",
  csv: "document",
};

export function safeMediaFilename(name: string, fallback: string): string {
  const base = (name || "").replace(/\\/g, "/").split("/").pop() || "";
  const cleaned = base.replace(/[^\w.\- ()]/g, "").replace(/^\.+/, "").slice(0, 120);
  return cleaned || fallback;
}

export function blockedMediaFilename(name: string): boolean {
  const lower = (name || "").trim().toLowerCase();
  return lower.endsWith(".exe") || lower.endsWith(".rar");
}

export function dangerousMediaBytes(bytes: Uint8Array): boolean {
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) return true;
  if (
    bytes.length >= 7 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x61 &&
    bytes[2] === 0x72 &&
    bytes[3] === 0x21 &&
    bytes[4] === 0x1a &&
    bytes[5] === 0x07
  ) {
    return true;
  }
  return false;
}

export function kindFromFilename(name: string): InboxMediaKind | null {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return EXT_KIND[ext] || null;
}

export function inboxMediaKind(mime: string): InboxMediaKind | null {
  const value = mime.split(";")[0].trim().toLowerCase();
  if (IMAGE.test(value)) return "image";
  if (AUDIO.test(value)) return "audio";
  if (VIDEO.test(value)) return "video";
  if (DOCUMENTS.has(value)) return "document";
  return null;
}

export function mimeForKind(kind: InboxMediaKind, filename: string, claimed: string): string {
  const known = inboxMediaKind(claimed);
  if (known === kind) return claimed.split(";")[0].trim().toLowerCase();
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "mp4") return kind === "audio" ? "audio/mp4" : "video/mp4";
  if (ext === "3gp") return "video/3gpp";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "pdf") return "application/pdf";
  if (ext === "txt") return "text/plain";
  if (ext === "csv") return "text/csv";
  return claimed.split(";")[0].trim().toLowerCase();
}

export function classifyInboxUpload(
  filename: string,
  mime: string,
  size: number
):
  | { ok: true; kind: InboxMediaKind; filename: string; mime: string }
  | { ok: false; error: "file_empty" | "file_blocked" | "file_type" | "file_too_large" } {
  if (!size) return { ok: false, error: "file_empty" };
  const safeName = safeMediaFilename(filename, "");
  if (!safeName || blockedMediaFilename(filename) || blockedMediaFilename(safeName)) {
    return { ok: false, error: "file_blocked" };
  }
  const kind = inboxMediaKind(mime) || kindFromFilename(safeName);
  if (!kind) return { ok: false, error: "file_type" };
  if (size > INBOX_MEDIA_LIMITS[kind]) return { ok: false, error: "file_too_large" };
  return { ok: true, kind, filename: safeName, mime: mimeForKind(kind, safeName, mime) };
}

export function placeholderBody(kind: InboxMediaKind): string {
  return `[${kind}]`;
}

export function isMediaPlaceholder(body: string): boolean {
  return /^\[(image|audio|video|document|blocked)\]$/.test((body || "").trim());
}
