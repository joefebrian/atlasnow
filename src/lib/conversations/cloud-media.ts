import { META_GRAPH } from "@/lib/meta/oauth";

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
