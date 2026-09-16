import { META_GRAPH } from "@/lib/meta/oauth";
import type { CloudHqConfig } from "@/lib/conversations/cloud-hq";
import { resolvedMetaApp } from "@/lib/integrations/service";

export const IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
export const DOC_MIME = new Set(["application/pdf"]);
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const DOC_MAX_BYTES = 16 * 1024 * 1024;

export type BroadcastMediaKind = "image" | "document";

export type BroadcastMedia = {
  id: string;
  kind: BroadcastMediaKind;
  mime: string;
  filename: string;
};

export function classifyBroadcastFile(mimeRaw: string, size: number, name: string):
  | { ok: true; kind: BroadcastMediaKind; mime: string }
  | { ok: false; error: string } {
  const mime = (mimeRaw || "").toLowerCase();
  const lower = name.toLowerCase();
  const asImage = IMAGE_MIME.has(mime) || /\.(jpe?g|png|webp)$/.test(lower);
  const asPdf = DOC_MIME.has(mime) || lower.endsWith(".pdf");
  if (asImage) {
    if (size > IMAGE_MAX_BYTES) return { ok: false, error: "Image max 5 MB (JPEG, PNG, WebP)." };
    return { ok: true, kind: "image", mime: mime || "image/jpeg" };
  }
  if (asPdf) {
    if (size > DOC_MAX_BYTES) return { ok: false, error: "PDF max 16 MB." };
    return { ok: true, kind: "document", mime: "application/pdf" };
  }
  return { ok: false, error: "Only JPEG, PNG, WebP, or PDF." };
}

export async function uploadPhoneMedia(
  cfg: CloudHqConfig,
  file: { bytes: Buffer; mime: string; filename: string }
): Promise<BroadcastMedia> {
  const kind = IMAGE_MIME.has(file.mime) ? "image" : "document";
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", file.mime);
  form.set("file", new File([new Uint8Array(file.bytes)], file.filename, { type: file.mime }));
  const res = await fetch(`${META_GRAPH}/${encodeURIComponent(cfg.phoneNumberId)}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.accessToken}` },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    throw new Error(json.error?.message || `Media upload failed (${res.status})`);
  }
  return { id: json.id, kind, mime: file.mime, filename: file.filename };
}

/** App resumable upload → header_handle for creating IMAGE/DOCUMENT templates. */
export async function uploadTemplateHeaderHandle(
  cfg: CloudHqConfig,
  file: { bytes: Buffer; mime: string; filename: string }
): Promise<string> {
  const app = await resolvedMetaApp();
  const appId = app.appId;
  if (!appId) throw new Error("Meta App ID is not set");
  const start = new URL(`${META_GRAPH}/${encodeURIComponent(appId)}/uploads`);
  start.searchParams.set("file_name", file.filename);
  start.searchParams.set("file_length", String(file.bytes.length));
  start.searchParams.set("file_type", file.mime);
  const sessionRes = await fetch(start, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.accessToken}` },
    signal: AbortSignal.timeout(20000),
  });
  const sessionJson = (await sessionRes.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!sessionRes.ok || !sessionJson.id) {
    throw new Error(sessionJson.error?.message || `Upload session failed (${sessionRes.status})`);
  }
  const put = await fetch(`${META_GRAPH}/${encodeURIComponent(sessionJson.id)}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${cfg.accessToken}`,
      file_offset: "0",
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(file.bytes),
    signal: AbortSignal.timeout(60000),
  });
  const putJson = (await put.json().catch(() => ({}))) as { h?: string; error?: { message?: string } };
  if (!put.ok || !putJson.h) {
    throw new Error(putJson.error?.message || `Header file upload failed (${put.status})`);
  }
  return putJson.h;
}
