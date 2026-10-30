import { prisma } from "@/lib/db";
import { META_GRAPH } from "@/lib/meta/oauth";
import { getCloudHqConfig } from "./cloud-hq";
import {
  classifyInboxUpload,
  dangerousMediaBytes,
  inboxMediaKind,
  INBOX_MEDIA_LIMITS,
  safeMediaFilename,
  type InboxMediaKind,
} from "./inbox-media";

const MAX = 8 * 1024 * 1024;

export async function downloadWhatsAppMedia(
  accessToken: string,
  mediaId: string
): Promise<{ bytes: Buffer; mime: string } | null> {
  const id = (mediaId || "").trim();
  if (!id || !accessToken) return null;
  const metaRes = await fetch(`${META_GRAPH}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) return null;
  const meta = (await metaRes.json().catch(() => null)) as { url?: string; mime_type?: string } | null;
  const url = meta?.url;
  if (!url) return null;
  const binRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!binRes.ok) return null;
  const buf = Buffer.from(await binRes.arrayBuffer());
  if (!buf.length || buf.length > MAX) return null;
  const mime = (meta?.mime_type || binRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(mime)) return null;
  return { bytes: buf, mime };
}

export async function downloadInboxMedia(
  accessToken: string,
  mediaId: string,
  filename: string
): Promise<{ bytes: Buffer; mime: string; filename: string; kind: InboxMediaKind } | null> {
  const id = (mediaId || "").trim();
  if (!id || !accessToken) return null;
  const metaRes = await fetch(`${META_GRAPH}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) return null;
  const meta = (await metaRes.json().catch(() => null)) as {
    url?: string;
    mime_type?: string;
  } | null;
  if (!meta?.url) return null;
  const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!binRes.ok) return null;
  const buf = Buffer.from(await binRes.arrayBuffer());
  if (!buf.length || dangerousMediaBytes(buf)) return null;
  const claimed = (meta.mime_type || binRes.headers.get("content-type") || "").split(";")[0].trim();
  const named = safeMediaFilename(filename, "file");
  const classified = classifyInboxUpload(named, claimed, buf.length);
  if (!classified.ok) return null;
  if (buf.length > INBOX_MEDIA_LIMITS[classified.kind]) return null;
  return { bytes: buf, mime: classified.mime, filename: classified.filename, kind: classified.kind };
}

export async function storeInboxMedia(opts: {
  externalId: string;
  accessToken: string;
  mediaId: string;
  filename: string;
}): Promise<boolean> {
  await prisma.waMessage.update({
    where: { externalId: opts.externalId },
    data: { mediaCloudId: opts.mediaId, mediaFilename: safeMediaFilename(opts.filename, "") },
  });
  const media = await downloadInboxMedia(opts.accessToken, opts.mediaId, opts.filename);
  if (!media) return false;
  await prisma.waMessage.update({
    where: { externalId: opts.externalId },
    data: {
      mediaImage: media.bytes,
      mediaMime: media.mime,
      mediaFilename: media.filename,
      mediaCloudId: opts.mediaId,
      inboxImage: true,
    },
  });
  return true;
}

export async function ensureInboxMedia(row: {
  id: string;
  mediaImage: Uint8Array | Buffer | null;
  mediaMime: string;
  mediaFilename: string;
  mediaCloudId: string;
  mediaPurgedAt?: Date | null;
  tenantId: string;
}): Promise<{ bytes: Uint8Array; mime: string; filename: string } | null> {
  if (row.mediaPurgedAt) return null;
  if (row.mediaImage?.length && inboxMediaKind(row.mediaMime) && !dangerousMediaBytes(row.mediaImage)) {
    return {
      bytes: row.mediaImage,
      mime: row.mediaMime,
      filename: row.mediaFilename || "file",
    };
  }
  if (!row.mediaCloudId) return null;
  const hq = await getCloudHqConfig(row.tenantId);
  if (!hq) return null;
  const media = await downloadInboxMedia(hq.accessToken, row.mediaCloudId, row.mediaFilename);
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
