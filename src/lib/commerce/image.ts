import sharp from "sharp";

export const PRODUCT_IMAGE_MAX_UPLOAD = 4_000_000;
export const PRODUCT_IMAGE_OK_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function compressProductImage(input: Buffer): Promise<{ buf: Buffer; mime: "image/webp" }> {
  const img = sharp(input, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) {
    throw Object.assign(new Error("image_type"), { code: "image_type" });
  }
  const buf = await img
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return { buf, mime: "image/webp" };
}

export function readProductImageFile(file: File): Promise<{ buf: Buffer } | { error: "image_required" | "image_too_large" | "image_type" }> {
  return readProductImageFileSync(file);
}

function readProductImageFileSync(file: File): Promise<{ buf: Buffer } | { error: "image_required" | "image_too_large" | "image_type" }> {
  if (file.size < 40) return Promise.resolve({ error: "image_required" });
  if (file.size > PRODUCT_IMAGE_MAX_UPLOAD) return Promise.resolve({ error: "image_too_large" });
  const mime = (file.type || "").toLowerCase();
  if (!PRODUCT_IMAGE_OK_MIME.has(mime)) return Promise.resolve({ error: "image_type" });
  return file.arrayBuffer().then((buf) => ({ buf: Buffer.from(buf) }));
}
