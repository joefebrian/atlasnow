import sharp from "sharp";

const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_IN = 8 * 1024 * 1024;

export async function compressReceiptPhoto(
  bytes: Buffer,
  mimeRaw: string
): Promise<{ ok: true; jpeg: Buffer } | { ok: false; error: string }> {
  const mime = (mimeRaw || "").toLowerCase();
  if (!ALLOWED.has(mime) && !/\.(jpe?g|png|webp)$/i.test(mime)) {
    return { ok: false, error: "Foto struk: JPEG, PNG, atau WebP." };
  }
  if (!bytes.length) return { ok: false, error: "Foto struk wajib." };
  if (bytes.length > MAX_IN) return { ok: false, error: "Foto struk max 8 MB." };
  try {
    const jpeg = await sharp(bytes)
      .rotate()
      .resize({ width: 1600, height: 2200, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    return { ok: true, jpeg };
  } catch {
    return { ok: false, error: "Foto struk tidak bisa dibaca." };
  }
}

export async function preprocessForOcr(jpeg: Buffer): Promise<Buffer> {
  return sharp(jpeg).grayscale().normalize().sharpen().png().toBuffer();
}
