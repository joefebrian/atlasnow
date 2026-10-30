import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/google/crypto";
import { findMetaPageForThread, getMetaConnector } from "@/lib/meta/service";
import {
  classifyInboxUpload,
  dangerousMediaBytes,
  inboxMediaKind,
  INBOX_MEDIA_LIMITS,
  safeMediaFilename,
} from "./inbox-media";
import { isMetaCdnUrl } from "./meta-parse";

const MAX = 16 * 1024 * 1024;

async function fetchAllowlisted(start: string, token: string | null): Promise<Response | null> {
  let current = start;
  for (let hop = 0; hop < 4; hop++) {
    if (!isMetaCdnUrl(current)) return null;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(current, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      current = new URL(loc, current).toString();
      continue;
    }
    return res.ok ? res : null;
  }
  return null;
}

function sniffedMime(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (buf.length >= 4 && buf.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return "audio/mpeg";
  if (buf.length >= 5 && buf.toString("ascii", 0, 4) === "%PDF") return "application/pdf";
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") return "video/mp4";
  return "";
}

export async function downloadMetaAttachment(
  url: string,
  filename: string,
  accessToken: string | null
): Promise<{ bytes: Buffer; mime: string; filename: string } | null> {
  if (!isMetaCdnUrl(url)) return null;
  let res = await fetchAllowlisted(url, accessToken);
  if (!res && accessToken) res = await fetchAllowlisted(url, null);
  if (!res) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length || buf.length > MAX || dangerousMediaBytes(buf)) return null;
  const claimed = sniffedMime(buf) || (res.headers.get("content-type") || "").split(";")[0].trim();
  const named = safeMediaFilename(filename, "file");
  const classified = classifyInboxUpload(named, claimed, buf.length);
  if (!classified.ok || buf.length > INBOX_MEDIA_LIMITS[classified.kind]) return null;
  return { bytes: buf, mime: classified.mime, filename: classified.filename };
}

async function pageToken(
  tenantId: string,
  provider: "FACEBOOK" | "INSTAGRAM",
  assetId: string
): Promise<string | null> {
  const connector = await getMetaConnector(tenantId);
  if (!connector || connector.status === "DISCONNECTED") return null;
  const page = findMetaPageForThread(connector.metaJson, provider, assetId);
  if (!page) return null;
  try {
    return decryptSecret(page.tokenEnc);
  } catch {
    return null;
  }
}

export async function storeMetaInboxFile(opts: {
  externalId: string;
  tenantId: string;
  provider: "FACEBOOK" | "INSTAGRAM";
  assetId: string;
  url: string;
  filename: string;
}): Promise<boolean> {
  await prisma.waMessage.update({
    where: { externalId: opts.externalId },
    data: { mediaCloudId: opts.url, mediaFilename: safeMediaFilename(opts.filename, "") },
  });
  const token = await pageToken(opts.tenantId, opts.provider, opts.assetId);
  const media = await downloadMetaAttachment(opts.url, opts.filename, token);
  if (!media) return false;
  await prisma.waMessage.update({
    where: { externalId: opts.externalId },
    data: {
      mediaImage: media.bytes,
      mediaMime: media.mime,
      mediaFilename: media.filename,
      mediaCloudId: opts.url,
      inboxImage: true,
    },
  });
  return true;
}

export async function ensureMetaInboxFile(row: {
  id: string;
  mediaImage: Uint8Array | Buffer | null;
  mediaMime: string;
  mediaFilename: string;
  mediaCloudId: string;
  mediaPurgedAt?: Date | null;
  tenantId: string;
  provider: string;
  sessionId: string;
}): Promise<{ bytes: Uint8Array; mime: string; filename: string } | null> {
  if (row.mediaPurgedAt) return null;
  if (row.provider !== "FACEBOOK" && row.provider !== "INSTAGRAM") return null;
  if (row.mediaImage?.length && inboxMediaKind(row.mediaMime) && !dangerousMediaBytes(row.mediaImage)) {
    return { bytes: row.mediaImage, mime: row.mediaMime, filename: row.mediaFilename || "file" };
  }
  if (!isMetaCdnUrl(row.mediaCloudId)) return null;
  const token = await pageToken(row.tenantId, row.provider, row.sessionId);
  const media = await downloadMetaAttachment(row.mediaCloudId, row.mediaFilename, token);
  if (!media) return null;
  await prisma.waMessage.update({
    where: { id: row.id },
    data: {
      mediaImage: media.bytes,
      mediaMime: media.mime,
      mediaFilename: media.filename,
      inboxImage: true,
    },
  });
  return media;
}
